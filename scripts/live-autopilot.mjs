#!/usr/bin/env node
/**
 * live-autopilot.mjs — Full-control live runner cho VS Brain.
 *
 * Puppeteer pipe mode (KHÔNG dùng CDP TCP port -> không dính rào Chrome 148).
 * Tự nạp extension hiện tại (apps/extension) => mỗi lần launch = code mới nhất.
 *
 * Khả năng:
 *  - launch Chrome riêng + nạp extension VS Brain
 *  - mở/điều khiển 2 tab ChatGPT + Gemini (mở đề tài mới)
 *  - điều khiển side panel: refresh, set rounds, Start, Stop
 *  - canh loop tới khi dừng, đọc stop reason + version + counters
 *  - phân loại kết quả, ghi artifact JSON, exit code theo verdict
 *
 * Gate người: profile bền cần login ChatGPT/Gemini 1 lần. Khi chưa login,
 * script GIỮ browser mở và chờ login (poll) tối đa LOGIN_WAIT_MS.
 *
 * Args:
 *  --topic "<đề tài>"     đề tài mới gửi vào cả 2 tab (mặc định: đề tài test)
 *  --rounds <n>           số vòng tối đa (mặc định 60)
 *  --loop-timeout <s>     trần chờ loop dừng (mặc định 1200s)
 *  --keep-open            không đóng browser khi xong (để Sếp xem / login)
 *  --login-only           chỉ mở browser + chờ login rồi thoát (setup login lần đầu)
 *
 * Exit code: 0 CONSENSUS | 2 BUG_* | 3 MAXED/INCONCLUSIVE | 4 NEEDS_LOGIN | 1 infra
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
const userDataDir = process.env.VSBRAIN_PROFILE || '/home/phuong/.cache/vsbrain-controlled-profile';
const artDir = path.join(repoRoot, 'artifacts', 'live-autopilot');
fs.mkdirSync(artDir, { recursive: true });

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def;
}
const TOPIC = arg('topic', 'Phản biện kế hoạch ra mắt một extension trình duyệt nhỏ: nêu rủi ro UX, bảo mật, và tính khả thi. Khi cả hai đồng thuận hoàn toàn, kết bằng đúng cụm: CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN');
const ROUNDS = Number(arg('rounds', 60));
const LOOP_TIMEOUT_MS = Number(arg('loop-timeout', 1200)) * 1000;
const KEEP_OPEN = !!arg('keep-open', false);
const LOGIN_ONLY = !!arg('login-only', false);
const LOGIN_WAIT_MS = Number(arg('login-wait', 600)) * 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const result = { stamp, topic: TOPIC, rounds: ROUNDS };

async function safeEval(page, fn, ...a) {
  try { return await page.evaluate(fn, ...a); }
  catch (e) {
    const m = String(e?.message || e || '');
    if (/detached frame|context was destroyed|Cannot find context|Target closed|Promise was collected/i.test(m)) return null;
    throw e;
  }
}

async function detectLogin(page, provider) {
  return await safeEval(page, (prov) => {
    const body = String(document.body?.innerText || '');
    const hasInput = !!document.querySelector('textarea, [contenteditable="true"], div.ProseMirror, rich-textarea');
    const loginWall = /log in|sign up for free|sign in|create account|đăng nhập|meet gemini/i.test(body.slice(0, 1500));
    return { provider: prov, url: location.href, title: document.title, hasInput, loginWall, bodyHead: body.slice(0, 200) };
  }, provider);
}

async function openTopic(page, topic) {
  // navigate to fresh chat then seed
  const home = page.url().includes('gemini') ? 'https://gemini.google.com/app' : 'https://chatgpt.com/';
  await page.goto(home, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(4000);
  const selectors = ['textarea', 'rich-textarea [contenteditable="true"]', '[contenteditable="true"]', 'div[contenteditable="true"][role="textbox"]', 'div.ProseMirror'];
  for (const sel of selectors) {
    const ok = await safeEval(page, async (selector, text) => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      const el = document.querySelector(selector);
      if (!el) return false;
      el.focus(); el.click?.();
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
      await s(500);
      const btn = [...document.querySelectorAll('button')].find(b => {
        const t = `${b.innerText || ''} ${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''}`.toLowerCase();
        const r = b.getBoundingClientRect?.();
        return r && r.width > 0 && r.height > 0 && !b.disabled && /(send|gửi|submit|run|arrow)/i.test(t);
      });
      if (btn) { btn.click(); return true; }
      return false;
    }, sel, topic);
    if (ok) return sel;
  }
  return null;
}

let browser;
try {
  browser = await puppeteer.launch({
    headless: false, pipe: true, userDataDir,
    // Strip automation fingerprints so Google does not block login ("browser may not be secure")
    ignoreDefaultArgs: ['--enable-automation'],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`,
      '--no-first-run', '--no-default-browser-check', '--disable-default-apps',
      '--disable-component-extensions-with-background-pages',
      '--disable-blink-features=AutomationControlled']
  });

  // 1. service worker / extensionId
  let sw = null;
  for (let i = 0; i < 12; i++) {
    await sleep(2000);
    sw = browser.targets().find(t => t.type() === 'service_worker' && /background\.js$/.test(t.url()));
    if (sw) break;
  }
  if (!sw) throw new Error('extension service worker not found');
  const extensionId = sw.url().split('/')[2];
  result.extensionId = extensionId;

  // 2. open 2 provider tabs
  const chatgpt = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const gemini = await browser.newPage();
  await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000);

  // 3. login gate — reload first so freshly-applied login cookies reflect in DOM
  async function loginStatus(reload = false) {
    if (reload) {
      await chatgpt.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await gemini.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(4000);
    }
    const c = await detectLogin(chatgpt, 'chatgpt');
    const g = await detectLogin(gemini, 'gemini');
    return { chatgpt: c, gemini: g, ok: !!(c && g && c.hasInput && !c.loginWall && g.hasInput && !g.loginWall) };
  }
  let ls = await loginStatus(true);
  if (!ls.ok) {
    result.needsLogin = true;
    result.loginStatus = ls;
    console.log(JSON.stringify({ phase: 'NEEDS_LOGIN', hint: 'Đăng nhập ChatGPT + Gemini trong cửa sổ này. Sẽ tự tiếp tục khi xong.', loginStatus: ls }, null, 2));
    const start = Date.now();
    while (Date.now() - start < LOGIN_WAIT_MS) {
      await sleep(5000);
      ls = await loginStatus(true);
      if (ls.ok) { result.needsLogin = false; break; }
    }
  }
  if (!ls.ok) {
    result.verdict = 'NEEDS_LOGIN';
    fs.writeFileSync(path.join(artDir, `${stamp}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ verdict: 'NEEDS_LOGIN', loginStatus: ls }, null, 2));
    if (!KEEP_OPEN) await browser.close();
    process.exit(4);
  }
  result.loginOk = true;

  if (LOGIN_ONLY) {
    console.log(JSON.stringify({ verdict: 'LOGIN_OK', extensionId }, null, 2));
    fs.writeFileSync(path.join(artDir, `${stamp}.json`), JSON.stringify(result, null, 2));
    if (!KEEP_OPEN) await browser.close();
    process.exit(0);
  }

  // 4. open new topic both tabs
  result.chatSeedSel = await openTopic(chatgpt, TOPIC);
  await sleep(2000);
  result.gemSeedSel = await openTopic(gemini, TOPIC);
  await sleep(6000);

  // 5. open panel, configure, start
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2000);
  result.panelVersion = await safeEval(popup, () => document.querySelector('.version')?.textContent || null);
  await safeEval(popup, () => document.querySelector('#refreshTabsBtn')?.click());
  await sleep(3000);
  // set rounds
  await safeEval(popup, (n) => {
    const el = document.querySelector('#loopMaxSteps'); if (el) { el.value = String(n); el.dispatchEvent(new Event('change', { bubbles: true })); }
    const sl = document.querySelector('#stepsSlider'); if (sl) { sl.value = String(n); sl.dispatchEvent(new Event('input', { bubbles: true })); }
  }, ROUNDS);
  result.beforeStart = await safeEval(popup, () => ({
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    startDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    status: document.querySelector('#status')?.textContent || ''
  }));
  // start (auto-send + startLoop)
  await safeEval(popup, () => {
    const a = document.querySelector('#autoSendToggle'); if (a) a.checked = true;
    document.querySelector('#startLoopBtn')?.click();
  });
  await sleep(4000);

  // 6. wait for stop
  const startTs = Date.now();
  let stopped = false, lastLog = '';
  while (Date.now() - startTs < LOOP_TIMEOUT_MS) {
    lastLog = await safeEval(popup, () => document.querySelector('#log')?.textContent || '') || '';
    if (/auto-loop stopped:/.test(lastLog) || /final blueprint bundle saved/.test(lastLog)) { stopped = true; break; }
    await sleep(5000);
  }
  result.stopped = stopped;
  result.elapsedMs = Date.now() - startTs;

  // 7. read result
  const stopM = [...lastLog.matchAll(/auto-loop stopped:\s*(.+)/g)].map(m => m[1].trim());
  const lastStop = stopM.length ? stopM[0] : null; // newest-first in #log
  const qLines = [...lastLog.matchAll(/quality tab=\S+ step=(\d+).*?critical=(\d+) criticalStall=(\d+) shouldContinue=(\w+)/g)];
  const lastQ = qLines.length ? qLines[0] : null;
  result.lastStop = lastStop;
  result.lastQuality = lastQ ? { step: +lastQ[1], critical: +lastQ[2], criticalStall: +lastQ[3], shouldContinue: lastQ[4] } : null;
  result.logTail = lastLog.split('\n').slice(0, 25).join('\n');

  let verdict = 'INCONCLUSIVE', code = 3;
  if (!stopped) { verdict = 'TIMEOUT'; code = 3; }
  else if (/cả 2 tab đã chốt|một tab đã chốt|CHỐT_ĐỒNG_THUẬN|đồng thuận/i.test(lastStop || '') || /final blueprint bundle saved/.test(lastLog)) { verdict = 'CONSENSUS'; code = 0; }
  else if (/quality_guard|hard.?stop/i.test(lastStop || '')) { verdict = 'BUG_QUALITY_GUARD'; code = 2; }
  else if (/auto_handoff_failed/i.test(lastStop || '')) { verdict = 'BUG_HANDOFF'; code = 2; }
  else if (/state_invalid/i.test(lastStop || '')) { verdict = 'BUG_STATE'; code = 2; }
  else if (/đạt số bước tối đa|max/i.test(lastStop || '')) { verdict = 'MAXED_OUT'; code = 3; }
  else { verdict = 'OTHER_STOP'; code = 3; }
  result.verdict = verdict;

  fs.writeFileSync(path.join(artDir, `${stamp}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ verdict, panelVersion: result.panelVersion, lastStop, lastQuality: result.lastQuality, elapsedMs: result.elapsedMs }, null, 2));
  if (!KEEP_OPEN) await browser.close();
  process.exit(code);
} catch (e) {
  result.error = String(e?.stack || e).slice(0, 500);
  fs.writeFileSync(path.join(artDir, `${stamp}.error.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ verdict: 'INFRA_ERROR', error: result.error }, null, 2));
  try { if (browser && !KEEP_OPEN) await browser.close(); } catch {}
  process.exit(1);
}
