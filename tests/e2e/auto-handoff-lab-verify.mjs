import http from 'node:http';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const labPort = process.env.VSBRAIN_LAB_PORT || '4318';
const labBase = process.env.VSBRAIN_LAB_BASE || `http://127.0.0.1:${labPort}`;
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function isServerUp() {
  return new Promise(resolve => {
    const req = http.get(`${labBase}/lab/popup-lab.html`, res => { res.resume(); resolve(res.statusCode && res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}
async function ensureLabServer() {
  if (await isServerUp()) return;
  const child = spawn('/bin/bash', ['-lc', `python3 -m http.server ${labPort}`], { cwd: '/home/phuong/.openclaw/workspace/projects/crosscritic', detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 20; i++) {
    if (await isServerUp()) return;
    await sleep(500);
  }
  throw new Error(`lab server ${labPort} failed to start`);
}
async function waitForLog(page, text, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval('#log', el => el.textContent || '');
    if (value.includes(text)) return value;
    await sleep(500);
  }
  throw new Error(`log timeout: ${text}`);
}

await ensureLabServer();
const browser = await puppeteer.launch({ headless: false, executablePath: chromePath, args: ['--no-first-run','--no-default-browser-check'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('PAGE_ERROR=' + err.message));
  const left = '/lab/scenarios/auto-handoff-overflow.json';
  const right = '/lab/scenarios/dual-consensus.json';
  await page.goto(`${labBase}/lab/popup-lab.html?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#refreshTabsBtn', { timeout: 30000 });
  await page.click('#refreshTabsBtn');
  await page.waitForFunction(() => {
    const s = document.querySelector('#sourceTab');
    const b = document.querySelector('#startLoopBtn');
    return !!s && s.options.length >= 3 && !!b && !b.disabled;
  }, { timeout: 30000 });
  await page.evaluate(() => document.querySelector('#startLoopBtn')?.click());
  await waitForLog(page, 'relay preparing', 60000);
  await sleep(8000);
  const state = await page.evaluate(() => ({
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    loopCounter: document.querySelector('#loopCounter')?.textContent || '',
    log: document.querySelector('#log')?.textContent || '',
    tabs: window.__vsbrainLab?.debug?.().tabs || []
  }));
  if (state.log.includes('auto-handoff triggered')) {
    throw new Error('auto-handoff should not trigger by default after runtime hardening');
  }
  if (state.log.includes('auto_handoff_failed') || state.log.includes('Cannot set properties of null')) {
    throw new Error(`auto-handoff runtime regressed: ${state.log}`);
  }
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
