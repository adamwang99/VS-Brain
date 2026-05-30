import path from 'node:path';
import puppeteer from 'puppeteer';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
const SEED = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_SEED_20260528';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function safeEval(page, fn, ...args) {
  try {
    return await page.evaluate(fn, ...args);
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/detached frame|context was destroyed|Cannot find context/i.test(msg)) return null;
    throw err;
  }
}

async function fillAndSend(page, selectors) {
  for (const sel of selectors) {
    try {
      const ok = await safeEval(page, async (selector, seed) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const el = document.querySelector(selector);
        if (!el) return false;
        el.focus();
        if ('value' in el) {
          el.value = seed;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          document.execCommand?.('selectAll', false);
          document.execCommand?.('insertText', false, seed);
          el.textContent = seed;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: seed, inputType: 'insertText' }));
        }
        await sleep(300);
        const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Gửi" i]');
        if (sendBtn && !sendBtn.disabled) { sendBtn.click(); return true; }
        return false;
      }, sel, SEED);
      if (ok) return sel;
    } catch {}
  }
  return null;
}

async function waitForSeed(page, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = await safeEval(page, () => document.body.innerText.includes('TEST_SEED_20260528'));
    if (hit) return true;
    await sleep(1000);
  }
  return false;
}

async function dumpFromPage(page, provider) {
  return await safeEval(page, (provider) => {
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
    return { url: location.href, title: document.title, provider, out, bodyHit: document.body.innerText.includes('TEST_SEED_20260528') };
  }, provider);
}

const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const chatgpt = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  const gemini = await browser.newPage();
  await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await sleep(8000);

  const chatSel = await fillAndSend(chatgpt, ['textarea','[contenteditable="true"]']);
  const gemSel = await fillAndSend(gemini, ['textarea','rich-textarea [contenteditable="true"]','[contenteditable="true"]']);
  const chatOk = await waitForSeed(chatgpt);
  const gemOk = await waitForSeed(gemini);
  const chatgptDump = await dumpFromPage(chatgpt, 'chatgpt');
  const geminiDump = await dumpFromPage(gemini, 'gemini');
  console.log(JSON.stringify({ chatSel, gemSel, chatOk, gemOk, chatgptDump, geminiDump }, null, 2));
} finally {
  await browser.close();
}
