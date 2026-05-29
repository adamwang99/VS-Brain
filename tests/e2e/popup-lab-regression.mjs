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
  await waitForLog(page, 'finalize dual-consensus confirmed', 60000);
  await waitForLog(page, 'final blueprint bundle saved', 90000);
  const afterFinalize = await dumpState(page, 'dual-consensus-after-finalize-saved');
  if (!afterFinalize.log.includes('bundle download started')) throw new Error('missing bundle download log');
  return 'dual-consensus/save PASS';
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
  await waitForLog(page, 'finalize dual-consensus confirmed');
  const log = await page.$eval('#log', el => el.textContent || '');
  if (log.includes('draft_forced finalize')) throw new Error('stale stop reason forced draft');
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
  if (log.includes('quality hard-stop enforced')) throw new Error('should_continue=true still triggered hard-stop');
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
  if (state.log.includes('quality hard-stop enforced')) throw new Error('quality hard-stop fired when should_continue=true');
  // Verify: veto=on present meaning should_continue=true was respected
  if (!state.log.includes('veto=on')) throw new Error('veto=on not found — should_continue=true not respected');
  return 'duplicate-source-stall PASS';
}

async function runCriticalButProgressing(page) {
  // Bug class from live OCTA run: every round has Critical issues + should_continue:false
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
  if (state.log.includes('quality hard-stop enforced')) throw new Error('quality hard-stop fired while debate was progressing');
  return 'critical-but-progressing PASS';
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
  results.push(await runContinueVsStop(page));
  results.push(await runStaleStopReason(page));
  results.push(await runContinueContradictionVeto(page));
  results.push(await runDuplicateSourceStall(page));
  results.push(await runCriticalButProgressing(page));
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
