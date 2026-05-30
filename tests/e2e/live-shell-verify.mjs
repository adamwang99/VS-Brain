import puppeteer from 'puppeteer-core';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const labBase = process.env.VSBRAIN_LAB_BASE || 'http://127.0.0.1:4175';
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

const browser = await puppeteer.launch({ headless: false, executablePath: chromePath, args: ['--no-first-run','--no-default-browser-check'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('PAGE_ERROR=' + err.message));
  await page.goto(`${labBase}/lab/live-popup-shell.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#refreshTabsBtn', { timeout: 30000 });
  await sleep(8000);
  await page.click('#refreshTabsBtn');
  await sleep(5000);
  const state = await page.evaluate(() => ({
    log: document.querySelector('#log')?.textContent || '',
    sourceOptions: document.querySelectorAll('#sourceTab option').length,
    startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    labDebug: window.__vsbrainLab?.debug?.() || null
  }));
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
