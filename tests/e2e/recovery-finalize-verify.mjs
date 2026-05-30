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
    const sessionId = await window.__vsbrainActionJournal.ensureSessionId();
    const lease = await window.__vsbrainLease.acquire({ sessionId, ownerId: 'popup:test', currentPhase: 4 });
    window.__testHook = { loopState: null };
    await window.__vsbrainRecovery.saveCheckpoint({
      sessionId,
      leaseToken: lease.lease?.leaseToken || null,
      a: 11,
      b: 22,
      currentSource: 11,
      currentTarget: 22,
      step: 3,
      maxSteps: 10,
      delayMs: 12000,
      waitMs: 60000,
      autoSend: true,
      stopPhrase: 'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN',
      phase: 'runtime_loop',
      status: 'running'
    });
    const restored = await window.__vsbrainRecovery.loadCheckpoint();

    const nonce = await window.__vsbrainRecovery.newFinalizeNonce();
    const parsedOk = window.__vsbrainRecovery.parseTerminationEnvelope(`abc\n\n\
\`\`\`vsbrain-termination
status: ready_to_finalize
session_nonce: ${nonce}
should_continue: false
critical_remaining: false
\`\`\``);
    const parsedBadMulti = window.__vsbrainRecovery.parseTerminationEnvelope(`\`\`\`vsbrain-termination\nstatus: ready_to_finalize\nsession_nonce: a\nshould_continue: false\ncritical_remaining: false\n\`\`\`\n\`\`\`vsbrain-termination\nstatus: ready_to_finalize\nsession_nonce: b\nshould_continue: false\ncritical_remaining: false\n\`\`\``);
    const parsedBadMissing = window.__vsbrainRecovery.parseTerminationEnvelope(`hello world`);
    const consumeOk = await window.__vsbrainRecovery.consumeFinalizeNonce(nonce);
    const consumeAgain = await window.__vsbrainRecovery.consumeFinalizeNonce(nonce);

    return {
      recoveryStored: restored?.status === 'running' && restored?.currentSource === 11,
      parseOk: parsedOk.ok && parsedOk.envelope.session_nonce === nonce,
      parseContinueFalse: parsedOk.ok && parsedOk.envelope.should_continue === false,
      parseCriticalFalse: parsedOk.ok && parsedOk.envelope.critical_remaining === false,
      parseBadMulti: parsedBadMulti.code,
      parseBadMissing: parsedBadMissing.code,
      consumeOk: consumeOk.ok,
      consumeAgain: consumeAgain.code
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
