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

  const initial = await page.evaluate(() => ({
    text: document.getElementById('status')?.textContent,
    state: document.getElementById('status')?.dataset.state,
    archiveNotes: Array.from(document.querySelectorAll('.archive-note')).map(x => x.textContent?.trim())
  }));

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      [window.__vsbrainRecovery.STORE_KEY]: {
        sessionId: 'sess_status_polish',
        leaseToken: 'lease_status_polish',
        a: 1,
        b: 2,
        currentSource: 1,
        currentTarget: 2,
        step: 7,
        maxSteps: 10,
        delayMs: 12000,
        waitMs: 60000,
        autoSend: true,
        stopPhrase: 'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN',
        phase: 'runtime_loop',
        status: 'running'
      }
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1600);

  const recovered = await page.evaluate(() => ({
    text: document.getElementById('status')?.textContent,
    state: document.getElementById('status')?.dataset.state
  }));

  console.log(JSON.stringify({ initial, recovered }, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
