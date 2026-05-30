import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const extensionPath = path.join(repoRoot, 'apps/extension');
const labBase = 'http://127.0.0.1:4173/lab';

async function openExtensionPage(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extensionId = sw.url().split('/')[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return { page, extensionId };
}

async function waitForLog(page, text) {
  await expect.poll(async () => {
    return await page.locator('#log').textContent();
  }, { timeout: 30000 }).toContain(text);
}

test('dual-consensus should stop without extra relay and finalize should start', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsbrain-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  try {
    const p1 = await context.newPage();
    await p1.goto(`${labBase}/mock-chatgpt.html?scenario=/lab/scenarios/dual-consensus.json`);
    const p2 = await context.newPage();
    await p2.goto(`${labBase}/mock-gemini.html?scenario=/lab/scenarios/dual-consensus.json`);
    const { page } = await openExtensionPage(context);
    await page.click('#refreshTabsBtn');
    await page.click('#startLoopBtn');
    await waitForLog(page, 'auto-loop');
    await expect.poll(async () => await page.locator('#log').textContent(), { timeout: 30000 }).toMatch(/relay skipped: dual-consensus already reached|auto-loop stopped: cả 2 tab đã chốt/);
    await page.click('#finalizeBtn');
    await waitForLog(page, 'finalize start');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
