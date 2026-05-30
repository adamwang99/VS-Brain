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
    document.getElementById('autoSendToggle').checked = false;
    let msg = null;
    try {
      const fn = Function('return startAutoLoopWithTabs')(); await fn(11, 22);
    } catch (e) {
      msg = e?.message || String(e);
    }
    return {
      autoSend: !!document.getElementById('autoSendToggle').checked,
      blockedMessage: msg
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
