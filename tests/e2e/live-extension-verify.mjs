import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function findExtensionIdFromProfile(userDataDir, extensionPath) {
  const prefCandidates = [path.join(userDataDir, 'Default', 'Preferences'), path.join(userDataDir, 'Default', 'Secure Preferences')];
  for (const prefPath of prefCandidates) {
    if (!fs.existsSync(prefPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      const settings = data?.extensions?.settings || {};
      for (const [id, meta] of Object.entries(settings)) {
        const p = meta?.path || meta?.manifest?.path || '';
        if (String(p).includes(extensionPath)) return id;
      }
    } catch {}
  }
  return null;
}
async function waitForLog(page, text, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval('#log', el => el.textContent || '');
    if (value.includes(text)) return value;
    await sleep(500);
  }
  throw new Error(`log timeout: ${text}`);
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsbrain-live-'));
const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  userDataDir,
  enableExtensions: [extensionPath]
});
try {
  let extensionId = null;
  for (let i = 0; i < 30 && !extensionId; i++) {
    extensionId = findExtensionIdFromProfile(userDataDir, extensionPath);
    if (extensionId) break;
    const all = await browser.targets();
    const ext = all.find(t => t.type() === 'service_worker' && t.url().endsWith('background.js')) || all.find(t => t.type() === 'service_worker' && t.url().includes('chrome-extension://')) || all.find(t => t.url().includes('chrome-extension://'));
    if (ext) extensionId = ext.url().split('/')[2];
    if (!extensionId) await sleep(1000);
  }
  if (!extensionId) {
    const targets = (await browser.targets()).map(t => ({ type: t.type(), url: t.url() }));
    console.error(JSON.stringify({ userDataDir, files: fs.readdirSync(path.join(userDataDir, 'Default'), { withFileTypes: false }).slice(0, 50), targets }, null, 2));
    throw new Error('extension id not discovered');
  }

  const chatgpt = await browser.newPage();
  await chatgpt.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  const gemini = await browser.newPage();
  await gemini.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const liveTabs = await Promise.all([chatgpt, gemini].map(async p => ({ url: p.url(), title: await p.title().catch(() => '') })));

  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.click('#refreshTabsBtn');
  await waitForLog(popup, 'AI tabs scanned');
  const state = await popup.evaluate(() => ({
    sourceOptions: document.querySelectorAll('#sourceTab option').length,
    startLoopDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || ''
  }));
  const sourceTabId = Number(state.sourceVal || 0);
  const targetTabId = Number(state.targetVal || 0);
  const liveScanDump = await popup.evaluate(async ({ sourceTabId, targetTabId }) => {
    const ids = [sourceTabId, targetTabId].filter(Boolean);
    const out = [];
    for (const tabId of ids) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => ({
            href: location.href,
            hostname: location.hostname,
            title: document.title,
            hasChatGptTurns: document.querySelectorAll('[data-message-author-role], [data-testid^="conversation-turn-"]').length,
            hasGeminiTurns: document.querySelectorAll('user-query, model-response, message-content').length,
            bodyHead: String(document.body?.innerText || '').slice(0, 500)
          })
        });
        out.push({ tabId, tabUrl: tab?.url || '', tabTitle: tab?.title || '', injected: result || null });
      } catch (err) {
        out.push({ tabId, error: String(err?.message || err) });
      }
    }
    return out;
  }, { sourceTabId, targetTabId });
  const log = await popup.$eval('#log', el => el.textContent || '');
  console.log(JSON.stringify({ extensionId, liveTabs, state, liveScanDump, log }, null, 2));
} finally {
  await browser.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
