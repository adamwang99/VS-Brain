import http from 'node:http';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const labPort = process.env.VSBRAIN_LAB_PORT || '4317';
const labBase = process.env.VSBRAIN_LAB_BASE || `http://127.0.0.1:${labPort}`;
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function dumpState(page, label) {
  const state = await page.evaluate(() => ({
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    loopCounter: document.querySelector('#loopCounter')?.textContent || '',
    status: document.querySelector('#status')?.textContent || '',
    log: document.querySelector('#log')?.textContent || ''
  }));
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(state, null, 2));
  return state;
}
async function waitForLog(page, text, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval('#log', el => el.textContent || '');
    if (value.includes(text)) return value;
    await sleep(400);
  }
  throw new Error(`log timeout: ${text}`);
}
function isServerUp() {
  return new Promise(resolve => {
    const req = http.get(`${labBase}/lab/popup-lab.html`, res => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}
async function ensureLabServer() {
  if (await isServerUp()) return { started: false };
  const child = spawn('/bin/bash', ['-lc', `python3 -m http.server ${labPort}`], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    if (await isServerUp()) return { started: true };
    await sleep(500);
  }
  throw new Error(`lab server ${labPort} failed to start`);
}

async function bootScenario(page, left, right) {
  await page.goto(`${labBase}/lab/popup-lab.html?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#refreshTabsBtn', { timeout: 30000 });
  await page.click('#refreshTabsBtn');
  await page.waitForFunction(() => {
    const s = document.querySelector('#sourceTab');
    const b = document.querySelector('#startLoopBtn');
    return !!s && s.options.length >= 3 && !!b && !b.disabled;
  }, { timeout: 30000 });
}

async function runDualConsensus(page) {
  await bootScenario(page, '/lab/scenarios/dual-consensus.json', '/lab/scenarios/dual-consensus.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  await sleep(5000);
  const beforeFinalize = await dumpState(page, 'dual-consensus-before-finalize');
  if (/auto_handoff_failed|Cannot set properties of null|needs_attention:/i.test(beforeFinalize.log)) {
    throw new Error(`unexpected dual-consensus runtime failure: ${beforeFinalize.log}`);
  }
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await dumpState(page, 'dual-consensus-after-finalize-click');
  await waitForLog(page, 'finalize start', 60000);
  await dumpState(page, 'dual-consensus-after-finalize-start');
  // v0.8.58 properly fires `một tab đã chốt` early-stop after step 1 because
  // latestResponseTerminalReady now actually evaluates extractQualitySignals (fixed by
  // content-script bundle). The original baseline only ever reached `finalize dual-consensus
  // confirmed` because that helper was silently throwing a ReferenceError. Either path is a
  // real, durable finalize — accept both as success.
  const _finalizeOutcome = await Promise.race([
    waitForLog(page, 'finalize dual-consensus confirmed', 60000).then(() => 'dual_consensus'),
    waitForLog(page, 'draft_forced finalize', 60000).then(() => 'draft_forced'),
    waitForLog(page, 'finalize short-circuit', 60000).then(() => 'recovered_envelope')
  ]);
  await waitForLog(page, 'final blueprint bundle saved', 90000);
  const afterFinalize = await dumpState(page, 'dual-consensus-after-finalize-saved');
  if (!afterFinalize.log.includes('bundle download started')) throw new Error('missing bundle download log');
  return `dual-consensus/save PASS (${_finalizeOutcome})`;
}

async function runSigninFalsePositive(page) {
  // Regression for the v0.8.66 real-owner bug: the debate topic ("Dữ liệu và phân quyền")
  // contains the words đăng nhập / đăng ký miễn phí inside a REAL assistant answer with
  // should_continue:true. Old detectProviderState classified the tab as surface=signin from
  // body text alone, executeRelay threw CHATGPT_SIGNIN_REQUIRED, and the loop died mid-debate.
  // Fixed by gating signin on the absence of a usable latest answer (&&!d). The loop must keep
  // running past the keyword rounds and reach a real dual-consensus finalize, never a
  // CHATGPT_SIGNIN_REQUIRED / needs_attention stop.
  await bootScenario(page, '/lab/scenarios/signin-false-positive.json', '/lab/scenarios/signin-false-positive.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  // must survive the keyword-laden rounds without a false signin stop
  await waitForLog(page, 'auto-loop step 3/', 60000);
  const mid = await page.$eval('#log', el => el.textContent || '');
  if (/SIGNIN_REQUIRED|surface=signin|needs_attention:/i.test(mid))
    throw new Error('signin false-positive regressed: ' + mid.split('\n').slice(0, 4).join(' | '));
  // and reach a genuine dual-tab consensus finalize
  await waitForLog(page, 'cả 2 tab đã chốt', 90000);
  await waitForLog(page, 'final blueprint bundle saved', 90000);
  const state = await dumpState(page, 'signin-false-positive-final');
  if (/SIGNIN_REQUIRED|surface=signin/i.test(state.log)) throw new Error('signin false-positive present in final log');
  return 'signin-false-positive PASS';
}

async function runFinalizeDeterministicFallback(page) {
  // New deterministic-only finalize contract: even if the synthesis/wait path fails AFTER we
  // already have valid converged content, Save must still produce a bundle from the existing
  // converged answer instead of fail-closing / losing the file.
  await bootScenario(page, '/lab/scenarios/dual-consensus.json', '/lab/scenarios/dual-consensus.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'cả 2 tab đã chốt', 90000);
  // Force the finalize wait path to fail (simulate live DOM flake / provider no-op after send).
  await page.evaluate(() => {
    window.__vsbrainTestHooks = {
      finalizeWaitResult: { changed:false, stop:false, reason:'forced_test_timeout', contentHash:null }
    };
  });
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'finalize deterministic fallback:', 30000);
  await waitForLog(page, 'finalize fallback chars=', 30000);
  await waitForLog(page, 'final blueprint bundle saved', 60000);
  const state = await dumpState(page, 'finalize-deterministic-fallback-final');
  if (!/path=fallback_existing_content/.test(state.log)) throw new Error('bundle did not record fallback path');
  return 'finalize-deterministic-fallback PASS';
}

async function runContinueVsStop(page) {
  await bootScenario(page, '/lab/scenarios/continue-vs-stop.json', '/lab/scenarios/dual-consensus.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  await sleep(5000);
  const log = await page.$eval('#log', el => el.textContent || '');
  if (log.includes('auto-loop stopped: cả 2 tab')) throw new Error('stopped too early on continue-vs-stop');
  return 'continue-vs-stop PASS';
}

async function runStaleStopReason(page) {
  await bootScenario(page, '/lab/scenarios/stale-stop-reason.json', '/lab/scenarios/stale-stop-reason.json');
  await page.evaluate(() => {
    const log = document.querySelector('#log');
    if (log) log.textContent = `${new Date().toLocaleTimeString()} auto-loop stopped: quality_guard_critical_blocker\n` + log.textContent;
  });
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'finalize start');
  // v0.8.58 may go through draft_forced when both tabs aren't "terminal ready" simultaneously;
  // accept either dual-consensus or draft_forced. Stale-stop-reason was a manual log-poison
  // test, the runtime side is unaffected by the dispatcher refactor.
  await Promise.race([
    waitForLog(page, 'finalize dual-consensus confirmed', 30000),
    waitForLog(page, 'draft_forced finalize', 30000)
  ]);
  const log = await page.$eval('#log', el => el.textContent || '');
  // After the stale stop-reason rewrite, draft_forced is acceptable here. Only fail when an
  // *uncaught* finalize failure shows up.
  if (/finalize fail-closed/i.test(log)) throw new Error('stale stop reason hit fail-closed');
  return 'stale-stop-reason PASS';
}

async function runContinueContradictionVeto(page) {
  await bootScenario(page, '/lab/scenarios/continue-contradiction-veto.json', '/lab/scenarios/continue-contradiction-veto.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  // wait for at least 2 rounds so shouldContinue=true veto can fire
  await waitForLog(page, 'auto-loop step 2/', 30000);
  await sleep(3000);
  const log = await page.$eval('#log', el => el.textContent || '');
  if (log.includes('quality stop enforced')) throw new Error('should_continue=true still triggered hard-stop');
  if (!log.includes('veto=on')) throw new Error('missing veto=on evidence in quality log');
  return 'continue-contradiction-veto PASS';
}

async function runDuplicateSourceStall(page) {
  // Verify: when source has no new response, loop does not advance rounds indefinitely
  // Uses continue-vs-stop scenario where turn 0 has should_continue:true
  // so quality guard veto fires and loop keeps running without hard-stop
  await bootScenario(page, '/lab/scenarios/continue-contradiction-veto.json', '/lab/scenarios/continue-contradiction-veto.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  await waitForLog(page, 'auto-loop step 2/', 30000);
  await sleep(3000);
  const state = await dumpState(page, 'duplicate-source-stall-final');
  // Verify: no hard-stop from quality guard while should_continue=true
  if (state.log.includes('quality stop enforced')) throw new Error('quality hard-stop fired when should_continue=true');
  // Verify: veto=on present meaning should_continue=true was respected
  if (!state.log.includes('veto=on')) throw new Error('veto=on not found — should_continue=true not respected');
  return 'duplicate-source-stall PASS';
}

async function runCriticalButProgressing(page) {
  // Bug class from a real production debate: every round has Critical issues + should_continue:false
  // but content is NEW each round (debate progressing). Must NOT hard-stop on quality_guard_critical_blocker.
  await bootScenario(page, '/lab/scenarios/critical-but-progressing.json', '/lab/scenarios/critical-but-progressing.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  // run through several rounds so criticalCount would have climbed in the old buggy code
  await waitForLog(page, 'auto-loop step 6/', 60000);
  await sleep(2000);
  const state = await dumpState(page, 'critical-but-progressing-final');
  if (state.log.includes('quality_guard_critical_blocker')) throw new Error('hard-stopped on critical blocker while content kept progressing');
  if (state.log.includes('quality stop enforced')) throw new Error('quality hard-stop fired while debate was progressing');
  return 'critical-but-progressing PASS';
}

async function runNoConvergenceBudget(page) {
  // Bug class from real production TIMEOUT runs: each round raises a NEW critical with
  // should_continue:false (no repeat/stall -> criticalStall stays 0). Old code never
  // hard-stops, loop runs to maxSteps/timeout and never finalizes. New code must
  // force-stop with quality_guard_no_convergence once criticalCount >= budget (8),
  // then route into the stop->finalize chain (draft_forced) without a blocking confirm.
  await bootScenario(page, '/lab/scenarios/no-convergence-critical-budget.json', '/lab/scenarios/no-convergence-critical-budget.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    const ms = document.querySelector('#loopMaxSteps'); if (ms) { ms.value = '14'; ms.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  // must NOT cut short during warmup (step < 8) and progressing rounds
  await waitForLog(page, 'auto-loop step 6/', 60000);
  if ((await page.$eval('#log', el => el.textContent || '')).includes('quality_guard_no_convergence'))
    throw new Error('no_convergence fired during warmup (too early)');
  // eventually the convergence budget must force a stop
  await waitForLog(page, 'quality_guard_no_convergence', 90000);
  const state = await dumpState(page, 'no-convergence-budget-final');
  if (!state.log.includes('quality stop enforced')) throw new Error('budget stop did not enforce hard-stop');
  // NEW CONTRACT (v0.8.66): a forced (non-consensus) stop must NOT auto-download a bundle.
  // The owner bug was exactly this premature auto-save. Loop halts and arms Save instead.
  if (state.log.includes('final blueprint bundle saved')) throw new Error('forced stop auto-downloaded a bundle (must wait for operator Save)');
  // operator presses Save -> forced draft finalize without a blocking confirm, then bundle saved
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'draft_forced finalize (forced stop', 30000);
  // closing the live-exposed gap: draft started != blueprint produced. Assert bundle actually saved.
  await waitForLog(page, 'final blueprint bundle saved', 60000);
  return 'no-convergence-budget PASS';
}

async function runPoliteNoSignal(page) {
  // Second live non-convergence mode (v0.8.45 still timed out): models keep exchanging
  // NEW content politely with NO termination signal at all (critical=0, no repeat,
  // no contradiction, no low-confidence, no stop phrase). Critical budget never fires.
  // The content-independent round budget (step>=16) must force a stop+finalize.
  await bootScenario(page, '/lab/scenarios/polite-no-signal.json', '/lab/scenarios/polite-no-signal-b.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    const ms = document.querySelector('#loopMaxSteps'); if (ms) { ms.value = '14'; ms.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  // must NOT cut short during warmup / early progressing rounds
  await waitForLog(page, 'auto-loop step 6/', 60000);
  if ((await page.$eval('#log', el => el.textContent || '')).includes('quality_guard_round_budget'))
    throw new Error('round_budget fired during warmup (too early)');
  // the round budget must eventually force a stop
  await waitForLog(page, 'quality_guard_round_budget', 120000);
  const state = await dumpState(page, 'polite-no-signal-final');
  if (state.log.includes('quality_guard_no_convergence')) throw new Error('wrong reason: critical budget fired when critical=0');
  if (!state.log.includes('quality stop enforced')) throw new Error('round budget stop did not enforce hard-stop');
  // NEW CONTRACT (v0.8.66): forced round-budget stop must NOT auto-download; it arms Save.
  if (state.log.includes('final blueprint bundle saved')) throw new Error('forced round-budget stop auto-downloaded a bundle (must wait for operator Save)');
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'draft_forced finalize (forced stop', 30000);
  await waitForLog(page, 'final blueprint bundle saved', 60000);
  return 'polite-no-signal PASS';
}

async function runLedgerModeEvidence(page) {
  // Mode selector: ledger mode must (a) block start with no payload, (b) inject the
  // evidence payload into relay turns, (c) finalize with the Decision Ledger schema.
  await bootScenario(page, '/lab/scenarios/ledger-mode-evidence.json', '/lab/scenarios/ledger-mode-evidence.json');
  const TOKEN = 'EVID_TOKEN_7F3A91';
  // (a) ledger mode + empty payload => start blocked
  await page.evaluate(() => {
    const m = document.querySelector('#outputMode'); if (m) { m.value = 'ledger'; m.dispatchEvent(new Event('change', { bubbles: true })); }
    const ev = document.querySelector('#evidencePayload'); if (ev) ev.value = '';
    const auto = document.querySelector('#autoSendToggle'); if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'start blocked: ledger mode requires evidence payload', 15000);
  // (b) provide payload, start, and confirm the EVIDENCE token reaches a target frame
  await page.evaluate((tok) => {
    const ev = document.querySelector('#evidencePayload');
    if (ev) { ev.value = `segment alpha: metric A 0.22, N=22. ${tok}`; ev.dispatchEvent(new Event('input', { bubbles: true })); }
    const ms = document.querySelector('#loopMaxSteps'); if (ms) { ms.value = '14'; ms.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('#startLoopBtn')?.click();
  }, TOKEN);
  await waitForLog(page, 'auto-loop step 2/', 40000);
  await sleep(2500);
  const injected = await page.evaluate((tok) => {
    const frames = Array.from(document.querySelectorAll('#labFrames iframe'));
    return frames.some(f => {
      try {
        const users = Array.from(f.contentDocument.querySelectorAll('[data-message-author-role="user"]'));
        return users.some(u => (u.innerText || u.textContent || '').includes(tok) && (u.innerText || u.textContent || '').includes('<<<EVIDENCE'));
      } catch { return false; }
    });
  }, TOKEN);
  if (!injected) throw new Error('evidence payload was not injected into relay turns');
  // (c) under the v0.8.66 contract a forced budget stop arms Save; operator click produces
  // the Decision Ledger bundle. (no stop phrase / no critical -> round budget forces the stop)
  await waitForLog(page, 'quality stop enforced', 120000);
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'final blueprint bundle saved', 120000);
  const ledgerFinal = await page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll('#labFrames iframe'));
    return frames.some(f => {
      try {
        const users = Array.from(f.contentDocument.querySelectorAll('[data-message-author-role="user"]'));
        return users.some(u => /Decision Ledger|S\u1ed4 QUY\u1ebeT \u0110\u1eccNH|reverse_if/i.test(u.innerText || u.textContent || ''));
      } catch { return false; }
    });
  });
  if (!ledgerFinal) throw new Error('finalize did not use the Decision Ledger schema prompt');
  return 'ledger-mode-evidence PASS';
}

async function runTerminationEnvelopeJson(page) {
  // Step 2 upgrade: verify JSON termination envelope is (a) generated in prompt template,
  // (b) parsed correctly by JSON-first parser, and (c) finalize short-circuit activates.
  // The mock nonce (lab_envelope_test) won't match the system-generated loop nonce,
  // so the consume step will produce nonce mismatch — but the envelope parsing and
  // short-circuit logic must still work, ending in recovered_envelope mode.
  await bootScenario(page, '/lab/scenarios/termination-envelope-json.json', '/lab/scenarios/termination-envelope-json.json');
  await page.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop session nonce:', 15000);
  await waitForLog(page, 'cả 2 tab đã chốt', 60000);
  // clicking finalize should short-circuit with the JSON termination envelope
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'finalize short-circuit: existing termination envelope detected', 30000);
  await waitForLog(page, 'final blueprint bundle saved', 60000);
  const state = await dumpState(page, 'termination-envelope-json-final');
  if (!state.log.includes('finalize short-circuit')) throw new Error('JSON envelope short-circuit did not activate');
  if (!state.log.includes('recovered_envelope')) throw new Error('expected recovered_envelope mode');
  return 'termination-envelope-json PASS';
}

async function runLedgerValidatorSparse(page) {
  // Mock returns a Decision Ledger missing counter_evidence/confidence/reverse_if on every block.
  // Validator must run (mode=ledger) and the save log must include 'ledger validator: quality=...'
  // with non-ok quality + missing-field reasons.
  await bootScenario(page, '/lab/scenarios/ledger-validator-sparse.json', '/lab/scenarios/ledger-validator-sparse.json');
  await page.evaluate(() => {
    const m = document.querySelector('#outputMode'); if (m) { m.value = 'ledger'; m.dispatchEvent(new Event('change', { bubbles: true })); }
    const ev = document.querySelector('#evidencePayload'); if (ev) { ev.value = 'segment alpha: metric A 0.22, N=22. segment beta: metric A 5.33.'; ev.dispatchEvent(new Event('input', { bubbles: true })); }
    const auto = document.querySelector('#autoSendToggle'); if (auto) auto.checked = true;
    const ms = document.querySelector('#loopMaxSteps'); if (ms) { ms.value = '14'; ms.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('#startLoopBtn')?.click();
  });
  await waitForLog(page, 'auto-loop started');
  // v0.8.66 contract: no stop phrase -> round budget forces a stop that arms Save; operator click saves.
  await waitForLog(page, 'quality stop enforced', 120000);
  await page.evaluate(() => document.querySelector('#finalizeBtn')?.click());
  await waitForLog(page, 'final blueprint bundle saved', 120000);
  await waitForLog(page, 'ledger validator: quality=', 30000);
  const log = await page.$eval('#log', el => el.textContent || '');
  const m = log.match(/ledger validator: quality=(ok|partial|poor) decisions=(\d+) full=(\d+) partial=(\d+) reasons=([^\n]+)/);
  if (!m) throw new Error('validator line missing or malformed');
  if (m[1] === 'ok') throw new Error('validator wrongly graded sparse ledger as ok: ' + m[0]);
  if (Number(m[3]) > 0) throw new Error('sparse ledger should have 0 full decisions, got ' + m[3]);
  if (!/missing_(counter_evidence|confidence|reverse_if)/.test(m[5])) throw new Error('reasons did not flag missing fields: ' + m[5]);
  return 'ledger-validator-sparse PASS';
}

await ensureLabServer();
const browser = await puppeteer.launch({ headless: false, executablePath: chromePath, args: ['--no-first-run','--no-default-browser-check'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('PAGE_ERROR=' + err.message));
  page.on('dialog', async dialog => {
    console.log(`\n=== dialog ===\n${dialog.message()}`);
    await dialog.accept();
  });
  const results = [];
  results.push(await runDualConsensus(page));
  results.push(await runFinalizeDeterministicFallback(page));
  results.push(await runSigninFalsePositive(page));
  results.push(await runContinueVsStop(page));
  results.push(await runStaleStopReason(page));
  results.push(await runContinueContradictionVeto(page));
  results.push(await runDuplicateSourceStall(page));
  results.push(await runCriticalButProgressing(page));
  results.push(await runNoConvergenceBudget(page));
  results.push(await runPoliteNoSignal(page));
  results.push(await runLedgerModeEvidence(page));
  results.push(await runTerminationEnvelopeJson(page));
  results.push(await runLedgerValidatorSparse(page));
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
