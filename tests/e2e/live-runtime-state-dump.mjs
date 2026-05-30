import path from 'node:path';
import puppeteer from 'puppeteer';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function safeEval(page, fn, ...args) {
  try { return await page.evaluate(fn, ...args); }
  catch (err) {
    const msg = String(err?.message || err || '');
    if (/detached frame|context was destroyed|Cannot find context/i.test(msg)) return null;
    throw err;
  }
}
async function fillAndSend(page, seed) {
  const selectors = ['textarea','rich-textarea [contenteditable="true"]','[contenteditable="true"]','div[contenteditable="true"][role="textbox"]'];
  for (const sel of selectors) {
    const ok = await safeEval(page, async (selector, text) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const el = document.querySelector(selector);
      if (!el) return false;
      el.focus();
      if ('value' in el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        document.execCommand?.('selectAll', false);
        document.execCommand?.('insertText', false, text);
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      }
      await sleep(300);
      const btn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Gửi" i]');
      if (btn && !btn.disabled) { btn.click(); return true; }
      return false;
    }, sel, seed);
    if (ok) return sel;
  }
  return null;
}
async function dump(page, provider){
  return await safeEval(page, (provider) => {
    function norm(s){ return String(s || '').replace(/\s+/g,' ').trim(); }
    function visible(el){ const r = el?.getBoundingClientRect?.(); return !!r && r.width > 0 && r.height > 0; }
    const selectors = provider === 'chatgpt'
      ? ['[data-message-author-role="assistant"]','[data-testid^="conversation-turn-"] [class*="markdown"]','[data-testid^="conversation-turn-"] .markdown','main [data-message-author-role="assistant"]','article .markdown','article','.markdown']
      : ['model-response','message-content','.model-response-text','main .markdown','article','.markdown'];
    const samples = selectors.map(sel => {
      const els = Array.from(document.querySelectorAll(sel));
      return {
        selector: sel,
        count: els.length,
        tail: els.slice(-3).map(el => ({ text: norm(el.innerText || el.textContent || '').slice(0,400), len: norm(el.innerText || el.textContent || '').length, visible: visible(el), tag: el.tagName, cls: String(el.className || '').slice(0,120) }))
      };
    });
    const body = norm(document.body?.innerText || '');
    const textareas = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')).slice(0,10).map(el => ({ tag: el.tagName, role: el.getAttribute('role'), aria: el.getAttribute('aria-label'), text: norm(el.value || el.innerText || el.textContent || '').slice(0,200), visible: visible(el) }));
    return { provider, url: location.href, title: document.title, body: body.slice(0,2000), bodyLen: body.length, textareas, samples };
  }, provider);
}
const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const chatgpt = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  const gemini = await browser.newPage();
  await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_RUNTIME_STATE_20260529';
  const chatSel = await fillAndSend(chatgpt, seed);
  const gemSel = await fillAndSend(gemini, seed);
  await sleep(15000);
  const chatDump = await dump(chatgpt, 'chatgpt');
  const gemDump = await dump(gemini, 'gemini');
  console.log(JSON.stringify({ chatSel, gemSel, chatDump, gemDump }, null, 2));
} finally {
  await browser.close();
}
