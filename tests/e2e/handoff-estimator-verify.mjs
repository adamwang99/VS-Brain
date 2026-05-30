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
    const mk = (count, size) => ({
      messages: Array.from({ length: count }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: `${i} ` + 'x'.repeat(size)
      }))
    });

    const reliableState = window.eval(`(${window.buildHandoffState ? 'buildHandoffState' : 'null'})`);
    const reliable = window.__testReliable = null;

    const allSmall = mk(8, 120);
    const allLargeOld = {
      messages: [...Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ` + 'z'.repeat(4000) })), ...Array.from({ length: 4 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ` + 'a'.repeat(80) }))]
    };

    const estReliable = window.eval(`estimateScanTokens(${JSON.stringify(allSmall)})`);
    const estUnreliable = window.eval(`estimateScanTokens(${JSON.stringify(allLargeOld)})`);
    const handoffUnreliable = window.eval(`buildHandoffState(${JSON.stringify(allLargeOld)}, "auto_context_threshold")`);
    const handoffReliable = window.eval(`buildHandoffState(${JSON.stringify(allSmall)}, "auto_context_threshold")`);

    return {
      reliableStatus: estReliable.estimator_status,
      unreliableStatus: estUnreliable.estimator_status,
      unreliableDomGtLocal: estUnreliable.usage_pct_est_dom > estUnreliable.usage_pct_est_local,
      unreliableDelta: estUnreliable.estimator_delta_pct,
      handoffReliableStatus: handoffReliable.context_estimate.estimator_status,
      handoffUnreliableStatus: handoffUnreliable.context_estimate.estimator_status
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sleep(1000);
  await browser.close();
}
