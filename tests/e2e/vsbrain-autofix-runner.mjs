import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const outRoot = path.join(repoRoot, 'artifacts', 'vsbrain-autofix');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outRoot, stamp);
const labPort = process.env.VSBRAIN_LAB_PORT || '4317';
const labBase = `http://127.0.0.1:${labPort}`;
fs.mkdirSync(runDir, { recursive: true });

function sh(cmd, env = {}) {
  const res = spawnSync('/bin/bash', ['-lc', cmd], {
    cwd: repoRoot,
    env: { ...process.env, VSBRAIN_LAB_BASE: labBase, VSBRAIN_LAB_PORT: labPort, ...env },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  return {
    cmd,
    code: res.status ?? (res.signal ? 1 : 0),
    signal: res.signal || null,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    ok: (res.status ?? 0) === 0
  };
}

function save(name, data) {
  fs.writeFileSync(path.join(runDir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function isServerUp() {
  return new Promise(resolve => {
    const req = http.get(`${labBase}/lab/popup-lab.html`, res => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function ensureLabServer() {
  if (await isServerUp()) return { started: false };
  const child = spawn('/bin/bash', ['-lc', `python3 -m http.server ${labPort}`], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    if (await isServerUp()) return { started: true };
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`lab server ${labPort} failed to start`);
}

function classify(resultMap) {
  if (Object.keys(resultMap).length && Object.values(resultMap).every(r => r.ok)) {
    return 'PASS_ALL';
  }
  const joined = Object.values(resultMap).map(r => `${r.stdout}\n${r.stderr}`).join('\n');
  const lower = joined.toLowerCase();
  if (/dual-consensus\/save pass[\s\S]*continue-vs-stop pass[\s\S]*stale-stop-reason pass/i.test(joined) && /live provider session not ready/i.test(joined)) {
    return 'LIVE_PROVIDER_NOT_READY';
  }
  if (/Waiting for selector/i.test(joined) || /title":\s*"Chờ một chút/i.test(joined) || /body":\s*""/i.test(joined)) {
    return 'AUTH_OR_INTERSTITIAL_GATE';
  }
  if (/seed ChatGPT send failed/i.test(joined) || /could not seed ChatGPT prompt/i.test(joined)) {
    return 'SEED_SELECTOR_DRIFT';
  }
  if (/No active tab/i.test(joined) || /AI tabs scanned: 0/i.test(joined)) {
    return 'TAB_DISCOVERY_DRIFT';
  }
  if (/Không lấy được câu trả lời mới nhất từ tab nguồn/i.test(joined)) {
    return 'NO_USABLE_SOURCE_RESPONSE';
  }
  if (/service worker.*not found/i.test(joined) || /extension service worker/i.test(joined)) {
    return 'EXTENSION_LOAD_FAILURE';
  }
  if (/PASS/.test(joined) && !/FAIL|Error:|TimeoutError|timeout/i.test(joined)) {
    return 'PASS_OR_PARTIAL_PASS';
  }
  return 'UNCLASSIFIED';
}

const steps = [
  {
    key: 'regression',
    cmd: 'timeout 180s npm run test:vsbrain:regression'
  },
  {
    key: 'live_provider',
    cmd: 'timeout 180s npm run test:vsbrain:live'
  },
  {
    key: 'live_shell',
    cmd: 'timeout 180s npm run test:vsbrain:live-shell'
  },
  {
    key: 'live_seed_dump',
    cmd: 'timeout 240s xvfb-run -a node tests/e2e/live-seed-and-dump.mjs'
  },
  {
    key: 'live_official',
    cmd: 'timeout 240s npm run test:vsbrain:live-official'
  }
];

const server = await ensureLabServer();
save('lab-server.json', server);

const results = {};
for (const step of steps) {
  const r = sh(step.cmd);
  results[step.key] = r;
  save(`${step.key}.stdout.log`, r.stdout);
  save(`${step.key}.stderr.log`, r.stderr);
  save(`${step.key}.meta.json`, { cmd: r.cmd, code: r.code, signal: r.signal, ok: r.ok });
  if (step.key === 'regression' && !r.ok) break;
}

const summary = {
  runDir,
  createdAt: new Date().toISOString(),
  classification: classify(results),
  steps: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { ok: v.ok, code: v.code, signal: v.signal }]))
};
save('summary.json', summary);

const md = [
  '# VS Brain Autofix Run',
  '',
  `- created_at: ${summary.createdAt}`,
  `- run_dir: ${summary.runDir}`,
  `- classification: ${summary.classification}`,
  '',
  '## Steps',
  ...Object.entries(summary.steps).map(([k, v]) => `- ${k}: ${v.ok ? 'PASS' : 'FAIL'} (code=${v.code}${v.signal ? ` signal=${v.signal}` : ''})`),
  ''
].join('\n');
save('summary.md', md);

console.log(JSON.stringify(summary, null, 2));
if (!Object.values(summary.steps).every(s => s.ok)) process.exit(1);
