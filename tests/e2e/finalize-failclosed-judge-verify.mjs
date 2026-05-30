import puppeteer from 'puppeteer';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';

const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker' && target.url().endsWith('background.js'),
    { timeout: 30000 }
  );
  const worker = await workerTarget.worker();
  if (!worker) throw new Error('service worker handle unavailable');
  const extensionId = await worker.evaluate(() => chrome.runtime.id);
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  const result = await page.evaluate(async () => {
    const stopPhraseOnly = `Blueprint ok\n${'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN'}\nNo envelope here`;
    const parseStopPhraseOnly = window.__vsbrainRecovery.parseTerminationEnvelope(stopPhraseOnly);

    const nonce = await window.__vsbrainRecovery.newFinalizeNonce();
    const envOk = window.__vsbrainRecovery.parseTerminationEnvelope(`\`\`\`vsbrain-termination
status: ready_to_finalize
session_nonce: ${nonce}
should_continue: false
critical_remaining: false
\`\`\``);
    const envContinue = window.__vsbrainRecovery.parseTerminationEnvelope(`\`\`\`vsbrain-termination
status: ready_to_finalize
session_nonce: ${nonce}
should_continue: true
critical_remaining: false
\`\`\``);

    const judgeNoVeto = window.__vsbrainJudgeGate.parseVerdict(`\`\`\`vsbrain-judge
verdict: no_veto
reason: safe_to_export
confidence: 9
\`\`\``);
    const judgeReview = window.__vsbrainJudgeGate.parseVerdict(`\`\`\`vsbrain-judge
verdict: review_required
reason: human_review_needed
confidence: 7
\`\`\``);
    const judgeVeto = window.__vsbrainJudgeGate.parseVerdict(`\`\`\`vsbrain-judge
verdict: veto
reason: unresolved_blocker
confidence: 9
\`\`\``);
    const judgeMissing = window.__vsbrainJudgeGate.parseVerdict('plain text no judge envelope');

    const detOk = { ok: true, code: 'OK_DETERMINISTIC_GATE' };
    const detFail = { ok: false, code: 'ERR_DETERMINISTIC_GATE_FAILED' };

    const decideNoVeto = window.__vsbrainJudgeGate.decide(judgeNoVeto, detOk);
    const decideReview = window.__vsbrainJudgeGate.decide(judgeReview, detOk);
    const decideVeto = window.__vsbrainJudgeGate.decide(judgeVeto, detOk);
    const decideParseFail = window.__vsbrainJudgeGate.decide(judgeMissing, detOk);
    const decideDetFail = window.__vsbrainJudgeGate.decide(judgeNoVeto, detFail);

    return {
      stopPhraseOnlyRejected: parseStopPhraseOnly.code,
      envOk: envOk.ok,
      envContinueTrue: envContinue.ok && envContinue.envelope.should_continue === true,
      decideNoVetoOk: decideNoVeto.ok,
      decideReviewCode: decideReview.code,
      decideVetoCode: decideVeto.code,
      decideParseFailCode: decideParseFail.code,
      decideDetFailCode: decideDetFail.code
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
