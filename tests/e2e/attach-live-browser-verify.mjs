import puppeteer from 'puppeteer';

const browserURL = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function safeEval(page, fn, ...args){
  try { return await page.evaluate(fn, ...args); }
  catch(err){ const msg=String(err?.message||err||''); if(/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null; throw err; }
}
const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
try {
  const pages = await browser.pages();
  const live = await Promise.all(pages.map(async p => ({ url: p.url(), title: await p.title().catch(()=>''), body: await safeEval(p,()=>String(document.body?.innerText||'').slice(0,400)) })));
  console.log(JSON.stringify({live}, null, 2));
} finally {
  await browser.disconnect();
}
