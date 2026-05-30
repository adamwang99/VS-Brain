import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
const provider = process.argv[2] || 'chatgpt';
const url = provider === 'gemini' ? 'https://gemini.google.com/app' : 'https://chatgpt.com/';
const seed = `Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_SEED_${provider.toUpperCase()}_20260528`;
const outPath = path.join(repoRoot, `live-seed-${provider}.json`);
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function write(obj){ fs.writeFileSync(outPath, JSON.stringify(obj, null, 2)); }

async function fillAndSend(page) {
  const selectors = provider === 'gemini'
    ? ['textarea','rich-textarea [contenteditable="true"]','[contenteditable="true"]']
    : ['textarea','[contenteditable="true"]'];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (!el) continue;
    try {
      await el.click({ clickCount: 1 });
      await el.type(seed, { delay: 10 });
      await page.keyboard.press('Enter');
      return sel;
    } catch {}
  }
  return null;
}

async function dump(page, phase, selectorUsed = null) {
  const state = await page.evaluate((phase, selectorUsed, provider) => {
    const norm = (s) => String(s || '').replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
    return {
      phase,
      selectorUsed,
      provider,
      url: location.href,
      title: document.title,
      bodyHasSeed: document.body.innerText.includes('TEST_SEED_'),
      bodyPreview: norm(document.body.innerText).slice(0, 1500),
      textareas: Array.from(document.querySelectorAll('textarea')).length,
      contenteditables: Array.from(document.querySelectorAll('[contenteditable="true"]')).length
    };
  }, phase, selectorUsed, provider);
  await write(state);
  return state;
}

const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  await dump(page, 'opened');
  const selector = await fillAndSend(page);
  await dump(page, 'sent', selector);
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const state = await dump(page, `wait_${i}`, selector);
    if (state.bodyHasSeed) break;
  }
} finally {
  await browser.close();
}
