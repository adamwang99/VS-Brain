import puppeteer from 'puppeteer';

const browserURL = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function waitForLog(page, text, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval('#log', el => el.textContent || '');
    if (value.includes(text)) return value;
    await sleep(500);
  }
  throw new Error(`log timeout: ${text}`);
}
async function safeEval(page, fn, ...args) {
  try { return await page.evaluate(fn, ...args); }
  catch (err) {
    const msg = String(err?.message || err || '');
    if (/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null;
    throw err;
  }
}
async function fillAndSend(page, seed) {
  const selectors = ['textarea','[contenteditable="true"]','div[contenteditable="true"][role="textbox"]','div.ProseMirror'];
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
      if (el.matches('[contenteditable="true"], div.ProseMirror')) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        return true;
      }
      return false;
    }, sel, seed);
    if (ok) return sel;
  }
  return null;
}
async function waitForUsableSurface(page, kind, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const state = await safeEval(page, k => {
      const body = String(document.body?.innerText || '').slice(0, 800);
      return {
        url: location.href,
        title: document.title,
        body,
        hasInput: !!document.querySelector('textarea, [contenteditable="true"], div.ProseMirror'),
        hasChatGptTurns: document.querySelectorAll('[data-message-author-role], [data-testid^="conversation-turn-"]').length,
        hasGeminiTurns: document.querySelectorAll('user-query, model-response, message-content').length,
        loginWall: /log in|sign up for free|sign in|meet gemini/i.test(body)
      };
    }, kind);
    if (state && state.hasInput && (state.hasChatGptTurns > 0 || state.hasGeminiTurns > 0)) return state;
    await sleep(1000);
  }
  return null;
}
async function ensureSeeded(page, provider) {
  const state = await waitForUsableSurface(page, provider, 10000);
  if (state) return { ok: true, seeded: false, state };
  const pre = await safeEval(page, () => ({ url: location.href, title: document.title, body: String(document.body?.innerText || '').slice(0, 1200) }));
  if (/log in|sign up for free|sign in|meet gemini/i.test(String(pre?.body || ''))) {
    return { ok: false, reason: 'LOGIN_REQUIRED_OR_LANDING', state: pre };
  }
  const prompt = provider === 'chatgpt'
    ? 'Reply with exactly 2 short bullet points critiquing browser extension complexity.'
    : 'Reply with exactly 2 short bullet points critiquing browser extension complexity.';
  const sent = await fillAndSend(page, prompt);
  if (!sent) return { ok: false, reason: 'INPUT_NOT_FOUND', state: pre };
  const ready = await waitForUsableSurface(page, provider, 90000);
  return ready ? { ok: true, seeded: true, state: ready } : { ok: false, reason: 'NO_RESPONSE_AFTER_SEED', state: pre };
}

const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
try {
  const targets = await browser.targets();
  const sw = targets.find(t => t.type() === 'service_worker' && /chrome-extension:\/\/[^/]+\/background\.js$/.test(t.url()));
  if (!sw) {
    throw new Error(`extension service worker not found on attached browser; targets=${JSON.stringify(targets.map(t => ({ type: t.type(), url: t.url() })))}`);
  }
  const extensionId = sw.url().split('/')[2];

  const pages = await browser.pages();
  const chatgpt = pages.find(p => p.url().includes('chatgpt.com')) || null;
  const gemini = pages.find(p => p.url().includes('gemini.google.com')) || null;
  if (!chatgpt || !gemini) {
    throw new Error(`required live tabs not found chatgpt=${!!chatgpt} gemini=${!!gemini}`);
  }

  const chatState = await ensureSeeded(chatgpt, 'chatgpt');
  const geminiState = await ensureSeeded(gemini, 'gemini');

  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await popup.click('#refreshTabsBtn');
  await waitForLog(popup, 'AI tabs scanned');
  try { await popup.evaluate(() => document.querySelector('#scanBtn')?.click()); } catch {}
  await sleep(4000);
  const state = await popup.evaluate(() => ({
    sourceOptions: document.querySelectorAll('#sourceTab option').length,
    startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    provider: document.querySelector('#provider')?.textContent || '',
    count: document.querySelector('#count')?.textContent || '',
    log: document.querySelector('#log')?.textContent || ''
  }));
  console.log(JSON.stringify({ extensionId, chatState, geminiState, state }, null, 2));
} finally {
  await browser.disconnect();
}
