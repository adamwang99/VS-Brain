#!/usr/bin/env node
/**
 * watch-live-sessions.mjs
 * Quan sát ~/Downloads/vs-brain: phát hiện session live mới, đọc debug-log,
 * trích version + stop reason + quality counters, phân loại kết quả.
 *
 * Không khởi động Chrome, không can thiệp session đang chạy. Chỉ đọc artifact.
 *
 * Output: JSON ra stdout. Exit code:
 *   0 = có session CONSENSUS thật (done signal live)
 *   2 = có session BUG mới (cần fix)
 *   3 = chưa có session mới / chưa kết luận
 *
 * Env:
 *   VSBRAIN_DL_DIR  (default ~/Downloads/vs-brain)
 *   VSBRAIN_SINCE_MS (chỉ xét session có mtime >= mốc này)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dlDir = process.env.VSBRAIN_DL_DIR || path.join(os.homedir(), 'Downloads', 'vs-brain');
const sinceMs = Number(process.env.VSBRAIN_SINCE_MS || 0);

function findDebugLogs(root) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      try {
        for (const f of fs.readdirSync(full)) {
          if (/^debug-log-.*\.txt$/.test(f)) out.push(path.join(full, f));
        }
      } catch { /* ignore */ }
    } else if (e.isFile() && /^debug-log-.*\.txt$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function parseLog(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  // Debug-log is prepended newest-first; the FIRST regex hit is the newest line.
  // Support both export format (`version: vX`) and in-page format (`runtime version: vX`).
  const versionM = text.match(/(?:runtime )?version:\s*(v[0-9][^\s]*)/i);
  const markerM = text.match(/(?:runtime )?marker:\s*([^\s]+)/i);
  const stopM = [...text.matchAll(/auto-loop stopped:\s*(.+)/g)].map(m => m[1].trim());
  const finalizeSaved = /final blueprint bundle saved|bundle download started/i.test(text);
  // newest quality line = first match (file is newest-first)
  const qLines = [...text.matchAll(/quality tab=\S+ step=(\d+).*?critical=(\d+) criticalStall=(\d+) shouldContinue=(\w+)/g)];
  const lastQ = qLines.length ? qLines[0] : null;
  const lastStop = stopM.length ? stopM[0] : null;

  let classification = 'INCONCLUSIVE';
  if (lastStop) {
    if (/cả 2 tab đã chốt|một tab đã chốt|CHỐT_ĐỒNG_THUẬN|đồng thuận/i.test(lastStop)) {
      classification = 'CONSENSUS';
    } else if (/quality_guard|hard.?stop/i.test(lastStop)) {
      classification = 'BUG_QUALITY_GUARD';
    } else if (/auto_handoff_failed/i.test(lastStop)) {
      classification = 'BUG_HANDOFF';
    } else if (/state_invalid/i.test(lastStop)) {
      classification = 'BUG_STATE';
    } else if (/đạt số bước tối đa|max/i.test(lastStop)) {
      classification = 'MAXED_OUT';
    } else {
      classification = 'OTHER_STOP';
    }
  } else if (finalizeSaved) {
    classification = 'CONSENSUS';
  }

  const st = fs.statSync(file);
  return {
    file,
    mtimeMs: st.mtimeMs,
    version: versionM ? versionM[1] : null,
    marker: markerM ? markerM[1] : null,
    lastStop,
    finalizeSaved,
    lastQuality: lastQ ? {
      step: Number(lastQ[1]), critical: Number(lastQ[2]),
      criticalStall: Number(lastQ[3]), shouldContinue: lastQ[4]
    } : null,
    classification
  };
}

const logs = findDebugLogs(dlDir)
  .map(parseLog)
  .filter(Boolean)
  .filter(r => r.mtimeMs >= sinceMs)
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

const result = {
  dlDir,
  sinceMs,
  scanned: logs.length,
  sessions: logs.slice(0, 10),
  verdict: 'NO_NEW'
};

const latest = logs[0] || null;
let code = 3;
if (latest) {
  result.latest = latest;
  if (latest.classification === 'CONSENSUS') { result.verdict = 'CONSENSUS'; code = 0; }
  else if (latest.classification.startsWith('BUG')) { result.verdict = latest.classification; code = 2; }
  else { result.verdict = latest.classification; code = 3; }
}

console.log(JSON.stringify(result, null, 2));
process.exit(code);
