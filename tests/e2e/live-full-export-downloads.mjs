import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const extensionPath = path.join(repoRoot, 'apps/extension');
const labPort = process.env.VSBRAIN_LAB_PORT || '4317';
const labBase = process.env.VSBRAIN_LAB_BASE || `http://127.0.0.1:${labPort}`;
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function isServerUp() {
  return new Promise(resolve => {
    const req = http.get(`${labBase}/lab/mock-chatgpt.html`, res => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}
async function ensureLabServer() {
  if (await isServerUp()) return;
  const child = spawn('/bin/bash', ['-lc', `python3 -m http.server ${labPort}`], { cwd: repoRoot, detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 20; i++) {
    if (await isServerUp()) return;
    await sleep(500);
  }
  throw new Error(`lab server ${labPort} failed to start`);
}
async function waitForLog(page, text, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await page.$eval('#log', el => el.textContent || '');
    if (value.includes(text)) return value;
    await sleep(300);
  }
  throw new Error(`log timeout: ${text}`);
}
async function waitForDownloadCount(dir, minCount, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const files = fs.readdirSync(dir).filter(f => !f.endsWith('.crdownload'));
    if (files.length >= minCount) return files;
    await sleep(300);
  }
  throw new Error(`download timeout waiting for ${minCount} files in ${dir}`);
}

await ensureLabServer();
const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsbrain-downloads-'));
const browser = await puppeteer.launch({ headless: false, pipe: true, enableExtensions: [extensionPath] });
try {
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker' && target.url().endsWith('background.js'),
    { timeout: 30000 }
  );
  const worker = await workerTarget.worker();
  if (!worker) throw new Error('service worker handle unavailable');
  const extensionId = await worker.evaluate(() => chrome.runtime.id);
  if (!extensionId) throw new Error('extension id unavailable from worker');

  const page1 = await browser.newPage();
  const client1 = await page1.target().createCDPSession();
  await client1.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await page1.goto(`${labBase}/lab/mock-chatgpt.html?scenario=/lab/scenarios/dual-consensus.json`, { waitUntil: 'networkidle2' });

  const page2 = await browser.newPage();
  const client2 = await page2.target().createCDPSession();
  await client2.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await page2.goto(`${labBase}/lab/mock-gemini.html?scenario=/lab/scenarios/dual-consensus.json`, { waitUntil: 'networkidle2' });
  await sleep(3000);

  const panel = await browser.newPage();
  const client = await panel.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await panel.goto(`chrome-extension://${extensionId}/popup.html`);
  await panel.waitForSelector('#scanBtn', { timeout: 30000 });
  await panel.evaluate(() => document.querySelector('#scanBtn')?.click());
  await waitForLog(panel, 'archive scan tab=');

  const beforeState = await panel.evaluate(() => ({
    allMdDisabled: document.querySelector('#exportAllMdBtn')?.disabled,
    allBundleDisabled: document.querySelector('#exportAllBundleBtn')?.disabled,
    count: document.querySelector('#count')?.textContent || '',
    provider: document.querySelector('#provider')?.textContent || ''
  }));
  if (beforeState.allMdDisabled || beforeState.allBundleDisabled) {
    throw new Error(`canonical export buttons not enabled: ${JSON.stringify(beforeState)}`);
  }

  await panel.evaluate(() => document.querySelector('#exportAllMdBtn')?.click());
  await waitForLog(panel, 'exported full Markdown');
  await waitForDownloadCount(downloadDir, 1);

  await panel.evaluate(() => document.querySelector('#exportAllBundleBtn')?.click());
  await waitForLog(panel, 'exported canonical archive bundle');
  const files = await waitForDownloadCount(downloadDir, 2);

  const fileInfo = files.sort().map(name => {
    const fp = path.join(downloadDir, name);
    const buf = fs.readFileSync(fp);
    const head = buf.subarray(0, Math.min(buf.length, 160)).toString('utf8');
    return { name, size: buf.length, head };
  });

  const hasMd = fileInfo.some(f => f.head.startsWith('# '));
  const hasBundle = fileInfo.some(f => f.size > 400 && (f.name.endsWith('.json.gz') || f.name.endsWith('.gz') || f.name.endsWith('.txt')));
  const fidelity = {
    mdNamed: fileInfo.some(f => f.name.endsWith('.md')),
    bundleNamed: fileInfo.some(f => f.name.endsWith('.json.gz') || f.name.endsWith('.gz'))
  };

  if (!hasMd || !hasBundle) {
    throw new Error(`missing expected canonical downloads: ${JSON.stringify(fileInfo)}`);
  }

  console.log(JSON.stringify({ extensionId, downloadDir, beforeState, files: fileInfo, summary: { hasMd, hasBundle, fidelity } }, null, 2));
} finally {
  await browser.close();
  fs.rmSync(downloadDir, { recursive: true, force: true });
}
