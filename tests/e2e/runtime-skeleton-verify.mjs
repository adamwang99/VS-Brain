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
  await sleep(1500);

  const result = await page.evaluate(async () => {
    const sessionId = await window.__vsbrainActionJournal.ensureSessionId();
    const phase = 3;
    const first = await window.__vsbrainActionJournal.createAction({
      actionType: 'auto_send',
      payloadFingerprint: 'fp_same',
      phaseVersion: phase,
      target: { provider: 'chatgpt', targetId: 1 },
      retryPolicy: 'none',
      meta: { test: 'duplicate' }
    });
    const second = await window.__vsbrainActionJournal.createAction({
      actionType: 'auto_send',
      payloadFingerprint: 'fp_same',
      phaseVersion: phase,
      target: { provider: 'chatgpt', targetId: 1 },
      retryPolicy: 'none',
      meta: { test: 'duplicate' }
    });
    const lease1 = await window.__vsbrainLease.acquire({ sessionId, ownerId: 'popup:tab-1', currentPhase: 1 });
    const lease2 = await window.__vsbrainLease.acquire({ sessionId, ownerId: 'popup:tab-2', currentPhase: 1 });
    if (lease1.ok && lease1.lease?.leaseToken) {
      await window.__vsbrainLease.block({ sessionId, reason: 'test_unknown_commit' });
    }
    const blockedCheck = await window.__vsbrainLease.validate({ sessionId, leaseToken: lease1.lease?.leaseToken || '' });
    return {
      firstCreated: !!first?.created,
      secondCreated: !!second?.created,
      secondReason: second?.reason || null,
      lease1Ok: !!lease1?.ok,
      lease2Ok: !!lease2?.ok,
      lease2Code: lease2?.code || null,
      blockedOk: !blockedCheck?.ok,
      blockedCode: blockedCheck?.code || null
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
