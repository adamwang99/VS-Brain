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

  const before = await page.evaluate(async () => {
    await chrome.storage.local.remove(window.__vsbrainRecovery.STORE_KEY);
    return {
      initialAutoSend: !!document.getElementById('autoSendToggle')?.checked,
      hint: document.querySelector('.hintline')?.textContent || '',
      runtimePills: Array.from(document.querySelectorAll('.runtime-pill')).map(x => x.textContent?.trim())
    };
  });

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      [window.__vsbrainRecovery.STORE_KEY]: {
        sessionId: 'sess_test_safe_release',
        leaseToken: 'lease_test',
        a: 1,
        b: 2,
        currentSource: 1,
        currentTarget: 2,
        step: 4,
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
  await sleep(1800);

  const after = await page.evaluate(async () => {
    const cp = await window.__vsbrainRecovery.loadCheckpoint();
    return {
      recoveredAutoSend: !!document.getElementById('autoSendToggle')?.checked,
      checkpointAutoSend: cp?.autoSend,
      recoveredStatus: cp?.status
    };
  });

  console.log(JSON.stringify({
    ...before,
    ...after,
    hintHasSafe: /chỉ dán an toàn mặc định/i.test(before.hint)
  }, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
