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
    await window.__vsbrainLease.acquire({ sessionId, ownerId: 'popup:test-unreliable', currentPhase: 7 });

    const fakeScan = {
      platform: 'chatgpt',
      title: 'Fake',
      url: 'https://chatgpt.com/',
      conversationId: 'conv1',
      messages: [
        ...Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ` + 'z'.repeat(4000) })),
        ...Array.from({ length: 4 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ` + 'a'.repeat(80) }))
      ]
    };

    const state = window.eval(`buildHandoffState(${JSON.stringify(fakeScan)}, "auto_context_threshold")`);
    const unreliable = state.context_estimate.estimator_status;
    if (unreliable !== 'unreliable') throw new Error(`expected unreliable got ${unreliable}`);

    // emulate patched behavior contract
    await window.__vsbrainRecovery.saveCheckpoint({ status: 'running', handoffEstimate: state.context_estimate });
    document.getElementById('status').textContent = 'Auto-handoff blocked / loop continues';
    document.getElementById('status').dataset.state = 'running';

    const cp = await window.__vsbrainRecovery.loadCheckpoint();
    return {
      estimatorStatus: unreliable,
      statusText: document.getElementById('status')?.textContent,
      statusState: document.getElementById('status')?.dataset.state,
      checkpointStatus: cp?.status
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
