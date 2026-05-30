import puppeteer from 'puppeteer';

const browserURL = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
const extensionId = process.env.EXTENSION_ID || 'nognolfiidebmcbedcljjhjedefihiib';
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
async function waitForBodyText(page, needle, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = await safeEval(page, n => String(document.body?.innerText || '').includes(n), needle);
    if (hit) return true;
    await sleep(1000);
  }
  return false;
}
async function dumpSurface(page, name) {
  return await safeEval(page, label => ({
    label,
    url: location.href,
    title: document.title,
    body: String(document.body?.innerText || '').slice(0,1500),
    hasInput: !!document.querySelector('textarea,[contenteditable="true"],[role="textbox"],div.ProseMirror'),
    buttons: [...document.querySelectorAll('button')].slice(0,15).map(b => ({
      text: String(b.innerText || '').slice(0,80),
      aria: b.getAttribute('aria-label'),
      testid: b.getAttribute('data-testid'),
      disabled: !!b.disabled
    }))
  }), name);
}
async function waitForLogContains(page, text, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const log = await safeEval(page, () => document.querySelector('#log')?.textContent || '');
    if ((log || '').includes(text)) return log;
    await sleep(500);
  }
  return null;
}

const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
try {
  const chatgpt = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  const gemini = await browser.newPage();
  await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await sleep(8000);

  const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_ATTACH_9222_20260529';
  const chatSel = await fillAndSend(chatgpt, seed);
  const gemSel = await fillAndSend(gemini, seed);
  const chatHit = await waitForBodyText(chatgpt, 'TEST_ATTACH_9222_20260529', 30000);
  const gemHit = await waitForBodyText(gemini, 'TEST_ATTACH_9222_20260529', 30000);

  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await popup.click('#refreshTabsBtn');
  await waitForLogContains(popup, 'AI tabs scanned', 30000);

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
    extensionId,
    chatSel,
    gemSel,
    chatHit,
    gemHit,
    chatDump: await dumpSurface(chatgpt, 'chatgpt'),
    gemDump: await dumpSurface(gemini, 'gemini'),
    before,
    after
  }, null, 2));
} finally {
  await browser.disconnect();
}
