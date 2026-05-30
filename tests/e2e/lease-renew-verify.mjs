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
    const lease = await window.__vsbrainLease.acquire({ sessionId, ownerId: 'popup:lease-renew', currentPhase: 0 });
    if (!lease.ok) throw new Error('lease acquire failed');
    await window.__vsbrainLease.renew({ sessionId, leaseToken: lease.lease.leaseToken, currentPhase: 1 });
    await new Promise(r => setTimeout(r, 1600));
    const valid1 = await window.__vsbrainLease.validate({ sessionId, leaseToken: lease.lease.leaseToken });
    await window.__vsbrainLease.renew({ sessionId, leaseToken: lease.lease.leaseToken, currentPhase: 2 });
    const valid2 = await window.__vsbrainLease.validate({ sessionId, leaseToken: lease.lease.leaseToken });
    return {
      leaseToken: lease.lease.leaseToken,
      valid1: valid1.ok,
      valid2: valid2.ok
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
