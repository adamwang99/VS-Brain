import puppeteer from 'puppeteer';

const browserURL = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function safeEval(page, fn, ...args) {
  try { return await page.evaluate(fn, ...args); }
  catch (err) {
    const msg = String(err?.message || err || '');
    if (/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null;
    throw err;
  }
}
async function fillAndSend(page, seed) {
  const selectors = ['textarea','rich-textarea [contenteditable="true"]','[contenteditable="true"]','div[contenteditable="true"][role="textbox"]','div.ProseMirror'];
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
      await sleep(400);
      const btn = [...document.querySelectorAll('button')].find(b => {
        const s = `${b.innerText||''} ${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''}`.toLowerCase();
        const r = b.getBoundingClientRect?.();
        return r && r.width > 0 && r.height > 0 && !b.disabled && /(send|gửi|submit|run|arrow)/i.test(s);
      });
      if (btn) { btn.click(); return true; }
      return false;
    }, sel, seed);
    if (ok) return sel;
  }
  return null;
}
async function waitForBodyText(page, needle, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = await safeEval(page, n => String(document.body?.innerText || '').includes(n), needle);
    if (hit) return true;
    await sleep(1000);
  }
  return false;
}

const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
try {
  const pages = await browser.pages();
  let popup = pages.find(p => p.url().startsWith('chrome-extension://') && p.url().includes('/popup.html')) || null;
  let chatgpt = pages.find(p => p.url().includes('chatgpt.com')) || null;
  let gemini = pages.find(p => p.url().includes('gemini.google.com')) || null;

  if (!chatgpt) {
    chatgpt = await browser.newPage();
    await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  }
  if (!gemini) {
    gemini = await browser.newPage();
    await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  }
  await sleep(6000);

  const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_ATTACH_EXISTING_POPUP_20260529';
  const chatSel = await fillAndSend(chatgpt, seed);
  const gemSel = await fillAndSend(gemini, seed);
  const chatHit = await waitForBodyText(chatgpt, 'TEST_ATTACH_EXISTING_POPUP_20260529', 25000);
  const gemHit = await waitForBodyText(gemini, 'TEST_ATTACH_EXISTING_POPUP_20260529', 25000);

  if (!popup) {
    const refreshed = await browser.pages();
    popup = refreshed.find(p => p.url().startsWith('chrome-extension://') && p.url().includes('/popup.html')) || null;
  }
  if (!popup) throw new Error('existing popup page not found on attached browser');

  await popup.bringToFront();
  await sleep(2000);
  await popup.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(3000);
  await popup.click('#refreshTabsBtn');
  await sleep(3000);

  const before = await popup.evaluate(() => ({
    sourceOptions: [...document.querySelectorAll('#sourceTab option')].map(o => ({ value: o.value, text: o.textContent })),
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    log: document.querySelector('#log')?.textContent || '',
    status: document.querySelector('#status')?.textContent || ''
  }));

  await popup.evaluate(() => {
    const auto = document.querySelector('#autoSendToggle');
    if (auto) auto.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await sleep(5000);
  const after = await popup.evaluate(() => ({
    startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    stopReasonVisible: (document.querySelector('#log')?.textContent || '').includes('auto-loop stopped'),
    log: document.querySelector('#log')?.textContent || '',
    status: document.querySelector('#status')?.textContent || ''
  }));

  console.log(JSON.stringify({
    chatSel, gemSel, chatHit, gemHit,
    pages: (await browser.pages()).map(p => p.url()),
    before, after
  }, null, 2));
} finally {
  await browser.disconnect();
}
