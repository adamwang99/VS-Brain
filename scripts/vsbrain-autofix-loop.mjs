#!/usr/bin/env node
/**
 * vsbrain-autofix-loop.mjs
 * Driver vòng tự trị: regression test -> phân loại -> dừng/đề xuất fix.
 *
 * Script NÀY không tự sửa code (sửa code do agent làm theo diagnose),
 * nó là orchestrator deterministic: chạy test, gom evidence, kết luận trạng thái,
 * và ghi artifact để agent quyết định fix. Tự trị = chạy không cần hỏi;
 * an toàn = không tự ý mutate code bừa.
 *
 * Exit code:
 *   0 = regression PASS (sẵn sàng sang tầng live)
 *   2 = regression FAIL (agent cần fix; có evidence trong artifact)
 *   1 = lỗi hạ tầng (không chạy được test)
 *
 * Env: VSBRAIN_TEST_TIMEOUT (default 320s)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = '/home/phuong/.openclaw/workspace/projects/crosscritic';
const outRoot = path.join(repoRoot, 'artifacts', 'autofix-loop');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outRoot, stamp);
fs.mkdirSync(runDir, { recursive: true });
const timeoutS = process.env.VSBRAIN_TEST_TIMEOUT || '320';

function save(name, data) {
  fs.writeFileSync(path.join(runDir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function run(cmd) {
  const res = spawnSync('/bin/bash', ['-lc', cmd], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  });
  return { cmd, code: res.status ?? 1, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// 1. version đang ở source
let srcVersion = null;
try {
  const popup = fs.readFileSync(path.join(repoRoot, 'apps/extension/core.js'), 'utf8');
  const m = popup.match(/VS_BRAIN_RUNTIME_VERSION="v?([^"]+)"/);
  srcVersion = m ? `v${m[1]}` : null;
} catch { /* ignore */ }

let manifestVersion = null;
try {
  manifestVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/extension/manifest.json'), 'utf8')).version;
} catch { /* ignore */ }

// 2. regression
const reg = run(`timeout ${timeoutS}s npm test`);
save('regression.stdout.log', reg.stdout);
save('regression.stderr.log', reg.stderr);

const joined = `${reg.stdout}\n${reg.stderr}`;
const passLines = [...joined.matchAll(/^(.*PASS)\s*$/gm)].map(m => m[1].trim());
const failSignals = /FAIL|Error:|TimeoutError|throw new Error|log timeout|PAGE_ERROR/i.test(joined);
const allPass = reg.code === 0 && passLines.length >= 6 && !failSignals;

// classify failing scenario if any
let failClass = null;
if (!allPass) {
  if (/log timeout: finalize/i.test(joined)) failClass = 'FINALIZE_CHAIN';
  else if (/quality hard-stop|quality_guard_critical/i.test(joined)) failClass = 'QUALITY_GUARD_FALSE_POSITIVE';
  else if (/stopped too early/i.test(joined)) failClass = 'EARLY_STOP';
  else if (/missing bundle download/i.test(joined)) failClass = 'EXPORT_BUNDLE';
  else if (/auto_handoff_failed|Cannot set properties of null/i.test(joined)) failClass = 'HANDOFF_RUNTIME';
  else if (/lab server .* failed to start|ECONNREFUSED/i.test(joined)) failClass = 'INFRA';
  else failClass = 'UNCLASSIFIED';
}

const summary = {
  createdAt: new Date().toISOString(),
  runDir,
  srcVersion,
  manifestVersion,
  versionMismatch: srcVersion && manifestVersion && !srcVersion.includes(manifestVersion) ? true : false,
  regression: { code: reg.code, passCount: passLines.length, passLines, allPass, failClass }
};
save('summary.json', summary);
console.log(JSON.stringify(summary, null, 2));

if (failClass === 'INFRA') process.exit(1);
process.exit(allPass ? 0 : 2);
