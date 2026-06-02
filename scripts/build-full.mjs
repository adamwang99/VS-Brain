#!/usr/bin/env node
// build-full.mjs — Generate the FULL export build of the VS Brain extension from canonical source.
// Rule: source-of-truth is apps/extension/. The full export is a write-once artifact under
// exports/full/ — never hand-edited. It is a verbatim copy of the source minus dev-only files
// (*.bak, .DS_Store). Version is taken from apps/extension/manifest.json; no version mutation.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const srcDir = path.join(repoRoot, 'apps/extension');
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outRoot = path.join(repoRoot, 'exports/full');
const outDir = path.join(outRoot, `vs-brain-${version}-full`);

const SKIP_BASENAME_RE = /\.bak(-|$)|\.DS_Store$/i;

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_BASENAME_RE.test(entry.name)) continue;
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

console.log(`[full] source: ${srcDir}`);
console.log(`[full] target: ${outDir}`);
fs.mkdirSync(outRoot, { recursive: true });
rmrf(outDir);
copyDir(srcDir, outDir);

// integrity: critical source files must equal source byte-for-byte
const INTEGRITY_FILES = ['manifest.json', 'popup.html', 'page-helpers.js', 'core.js', 'i18n.js', 'storage.js', 'providers.js', 'tabs.js', 'relay.js', 'finalize.js', 'archive.js', 'ui.js', 'ui-advanced.js', 'action-journal.js', 'ipc-runtime.js', 'lease-runtime.js', 'runtime-recovery.js', 'judge-gate.js', 'provider-registry.js', 'background.js'];
for (const rel of INTEGRITY_FILES) {
  const a = fs.readFileSync(path.join(srcDir, rel));
  const b = fs.readFileSync(path.join(outDir, rel));
  if (!a.equals(b)) throw new Error(`[full] integrity mismatch on ${rel} — copy is not verbatim`);
}

// optional zip if `zip` is available
let zipPath = path.join(outRoot, `vs-brain-${version}-full.zip`);
try {
  rmrf(zipPath);
  execSync(`cd "${outRoot}" && zip -qr "${path.basename(zipPath)}" "${path.basename(outDir)}"`, { stdio: 'ignore' });
  console.log(`[full] zip:    ${zipPath}  (${fs.statSync(zipPath).size} bytes)`);
} catch {
  console.log('[full] zip skipped (zip binary not available)');
}
console.log(`[full] OK version=${version}. Source untouched, copy verbatim.`);
