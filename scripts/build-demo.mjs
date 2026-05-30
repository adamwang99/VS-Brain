#!/usr/bin/env node
// build-demo.mjs — Extract a demo build of the VS Brain extension from the canonical source.
// Rule: source-of-truth is apps/extension/. Demo is a write-once artifact under exports/demo/.
// We copy, set <body data-demo="1" data-demo-max-steps="30">, bump version label to *-demo,
// then zip. Source files are not modified.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const srcDir = path.join(repoRoot, 'apps/extension');
const manifestPath = path.join(srcDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const demoSuffix = process.argv.includes('--suffix') ? process.argv[process.argv.indexOf('--suffix') + 1] : 'demo';
const demoVersion = `${manifest.version}-${demoSuffix}`;
const outRoot = path.join(repoRoot, 'exports/demo');
const outDir = path.join(outRoot, `vs-brain-${demoVersion}`);
const zipPath = path.join(outRoot, `vs-brain-${demoVersion}.zip`);

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
const SKIP_BASENAME_RE = /\.bak(-|$)|\.DS_Store$/i;
// Files that exist in the source tree but are not referenced anywhere by the extension runtime.
// Keep this list tight; verified once via grep in the canonical source.
const ORPHAN_FILES = new Set(['icons/vs-brain.png']);
function copyDir(from, to, rel = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_BASENAME_RE.test(entry.name)) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (ORPHAN_FILES.has(relPath)) continue;
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d, relPath);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

console.log(`[demo] source: ${srcDir}`);
console.log(`[demo] target: ${outDir}`);
rmrf(outDir);
copyDir(srcDir, outDir);

// 1) flip <body> -> demo flagged
const popupHtmlPath = path.join(outDir, 'popup.html');
let popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
const beforeBody = popupHtml.match(/<body[^>]*>/);
if (!beforeBody) throw new Error('popup.html missing <body>');
popupHtml = popupHtml.replace(beforeBody[0], '<body data-demo="1" data-demo-max-steps="30">');

// 2) version label in panel header -> append -demo
popupHtml = popupHtml.replace(/<span class="version">[^<]+<\/span>/, `<span class="version">v${demoVersion}</span>`);
fs.writeFileSync(popupHtmlPath, popupHtml);

// 3) manifest version + name -> demo
const demoManifest = { ...manifest, version: manifest.version, name: `${manifest.name} (Demo)`, description: `${manifest.description} — demo build, capped at 30 rounds, advanced controls hidden.` };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(demoManifest, null, 2));

// 4) write a small README inside the demo dir
fs.writeFileSync(path.join(outDir, 'DEMO_README.md'), `# VS Brain — Demo build\n\nVersion: ${demoVersion}\nBuilt from canonical source: apps/extension/ at this repo HEAD.\n\nDemo constraints applied at runtime (data-demo flag in popup.html):\n- Round count is capped at 30 (slider + Steps input).\n- Manual / Advanced panels are hidden.\n- Round budget auto-stop (12) is unchanged; loop still always finalizes.\n\nLoad locally:\n1. Chrome → chrome://extensions → enable Developer mode.\n2. "Load unpacked" → select this folder.\n3. Open the side panel and start a debate.\n\nNot a final product. Bug reports + feedback go to the canonical repo.\n`);

// 5) zip
rmrf(zipPath);
execSync(`cd "${outRoot}" && zip -qr "${path.basename(zipPath)}" "${path.basename(outDir)}"`, { stdio: 'inherit' });
const zipSize = fs.statSync(zipPath).size;
console.log(`[demo] zip:    ${zipPath}  (${zipSize} bytes)`);
console.log(`[demo] OK. Source untouched.`);
