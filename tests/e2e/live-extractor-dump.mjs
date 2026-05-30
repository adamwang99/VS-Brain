import path from 'node:path';
import puppeteer from 'puppeteer';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker' && target.url().endsWith('background.js'),
    { timeout: 30000 }
  );
  const worker = await workerTarget.worker();
  const extensionId = await worker.evaluate(() => chrome.runtime.id);

  const chatgpt = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  const gemini = await browser.newPage();
  await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await sleep(8000);

  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.click('#refreshTabsBtn');
  await sleep(3000);
  const vals = await popup.evaluate(() => ({
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || ''
  }));

  const dumpFromPage = async (page, provider) => {
    return await page.evaluate((provider) => {
      const selectors = provider === 'chatgpt'
        ? ['[data-message-author-role="assistant"]','[data-testid^="conversation-turn-"] [class*="markdown"]','[data-testid^="conversation-turn-"] .markdown','main [data-message-author-role="assistant"]','article .markdown','article','.markdown']
        : ['model-response','message-content','.model-response-text','main .markdown','article','.markdown'];
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const norm = (s) => String(s || '').replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
      const out = [];
      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll(sel));
        out.push({ selector: sel, count: els.length, samples: els.slice(-3).map((el, idx) => ({ idx, visible: visible(el), len: norm(el.innerText || el.textContent || '').length, text: norm(el.innerText || el.textContent || '').slice(0,300), cls: String(el.className || '').slice(0,120), tag: el.tagName })) });
      }
      return { url: location.href, title: document.title, provider, out };
    }, provider);
  };

  const chatgptDump = await dumpFromPage(chatgpt, 'chatgpt');
  const geminiDump = await dumpFromPage(gemini, 'gemini');
  console.log(JSON.stringify({ vals, chatgptDump, geminiDump }, null, 2));
} finally {
  await browser.close();
}
