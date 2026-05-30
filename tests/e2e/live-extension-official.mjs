import path from 'node:path';
import puppeteer from 'puppeteer';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
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
async function waitForAssistant(page, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const state = await safeEval(page, () => ({
      url: location.href,
      title: document.title,
      hasTurns: document.querySelectorAll('[data-message-author-role="assistant"], [data-testid^="conversation-turn-"]').length > 0,
      hasInput: !!document.querySelector('textarea, [contenteditable="true"]')
    }));
    if (state?.hasTurns) return true;
    await sleep(1000);
  }
  return false;
}
async function ensureChatGptSeeded(page) {
  await page.bringToFront();
  await sleep(5000);
  const prompt = 'Reply with exactly 2 short bullet points critiquing the idea of overengineering browser extensions.';
  const sent = await fillAndSend(page, prompt);
  if (!sent) {
    const dump = await safeEval(page, () => ({ url: location.href, title: document.title, body: String(document.body?.innerText || '').slice(0, 1200) }));
    throw new Error(`could not seed ChatGPT prompt: ${JSON.stringify(dump)}`);
  }
  const ok = await waitForAssistant(page);
  if (!ok) throw new Error('ChatGPT assistant response did not appear after seed');
  await sleep(3000);
}

async function runOnce() {
  const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
  try {
    const workerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().endsWith('background.js'),
      { timeout: 30000 }
    );
    const worker = await workerTarget.worker();
    if (!worker) throw new Error('service worker handle unavailable');

    const chatgpt = await browser.newPage();
    await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
    const gemini = await browser.newPage();
    await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    await ensureChatGptSeeded(chatgpt);

    const extensionId = await worker.evaluate(() => chrome.runtime.id);
    if (!extensionId) throw new Error('extension id unavailable from worker');
    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    await popup.click('#refreshTabsBtn');
    await waitForLog(popup, 'AI tabs scanned');
    const before = await popup.evaluate(() => ({
      sourceOptions: document.querySelectorAll('#sourceTab option').length,
      startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
      sourceVal: document.querySelector('#sourceTab')?.value || '',
      targetVal: document.querySelector('#targetTab')?.value || '',
      log: document.querySelector('#log')?.textContent || ''
    }));
    await popup.evaluate(() => {
      const auto = document.querySelector('#autoSendToggle');
      if (auto) auto.checked = true;
      document.querySelector('#startLoopBtn')?.click();
    });
    await sleep(5000);
    const started = await popup.evaluate(() => ({
      startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
      log: document.querySelector('#log')?.textContent || '',
      status: document.querySelector('#status')?.textContent || ''
    }));
    if (!started.startLoopDisabled && !started.log.includes('auto-loop started')) {
      throw new Error(`start_loop_not_armed: ${JSON.stringify(started)}`);
    }
    await sleep(20000);
    const after = await popup.evaluate(() => ({
      startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
      stopReasonVisible: (document.querySelector('#log')?.textContent || '').includes('auto-loop stopped'),
      log: document.querySelector('#log')?.textContent || '',
      status: document.querySelector('#status')?.textContent || ''
    }));
    try { await popup.evaluate(() => document.querySelector('#stopLoopBtn')?.click()); } catch {}
    console.log(JSON.stringify({ before, after }, null, 2));
  } finally {
    await browser.close();
  }
}

let lastErr = null;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await runOnce();
    process.exit(0);
  } catch (err) {
    lastErr = err;
    const msg = String(err?.message || err || '');
    console.error(`ATTEMPT_${attempt}_FAIL=${msg}`);
    if (!/Promise was collected|context was destroyed|detached frame|Target closed/i.test(msg) || attempt === 3) throw err;
    await sleep(2000);
  }
}
if (lastErr) throw lastErr;
