import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

function findExtensionIdFromProfile(userDataDir, extensionPath) {
  const prefCandidates = [
    path.join(userDataDir, 'Default', 'Preferences'),
    path.join(userDataDir, 'Default', 'Secure Preferences')
  ];
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const extensionPath = path.join(repoRoot, 'apps/extension');
const labBase = 'http://127.0.0.1:4173/lab';
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForLog(page, text, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval('#log', el => el.textContent || '');
    if (value.includes(text)) return value;
    await sleep(500);
  }
  throw new Error(`log timeout: ${text}`);
}

async function run() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsbrain-pp-'));
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    userDataDir,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });
  try {
    const p1 = await browser.newPage();
    await p1.goto(`${labBase}/mock-chatgpt.html?scenario=/lab/scenarios/dual-consensus.json`);
    const p2 = await browser.newPage();
    await p2.goto(`${labBase}/mock-gemini.html?scenario=/lab/scenarios/dual-consensus.json`);

    await sleep(5000);
    let extensionId = findExtensionIdFromProfile(userDataDir, extensionPath);
    if (!extensionId) {
      const targets = await browser.targets();
      const extensionTarget = targets.find(t => t.type() === 'service_worker' && t.url().includes('chrome-extension://')) || targets.find(t => t.url().includes('chrome-extension://'));
      if (extensionTarget) extensionId = extensionTarget.url().split('/')[2];
    }
    if (!extensionId) throw new Error('extension id not found from profile or targets');
    console.error('EXTENSION_ID=' + extensionId);

    const panel = await browser.newPage();
    await panel.goto(`chrome-extension://${extensionId}/popup.html`);
    await panel.click('#refreshTabsBtn');
    await panel.click('#startLoopBtn');
    await waitForLog(panel, 'auto-loop');
    const endLog = await waitForLog(panel, 'auto-loop stopped');
    console.log(endLog);
    await panel.click('#finalizeBtn');
    const finalizeLog = await waitForLog(panel, 'finalize start');
    console.log(finalizeLog);
  } finally {
    // keep browser open on failure for debugging only if requested
    if (!process.env.KEEP_BROWSER_OPEN) await browser.close();
    if (!process.env.KEEP_BROWSER_OPEN) fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
