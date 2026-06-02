import { readFileSync } from 'node:fs';
// Post-modularization: export wiring moved from popup.js to ui.js and archive.js.
// Load all module files and merge for checks.
const dir = new URL('../apps/extension/', import.meta.url);
const modules = ['core.js','i18n.js','storage.js','providers.js','tabs.js','relay.js','finalize.js','archive.js','ui.js','ui-advanced.js'];
let s = '';
for (const m of modules) {
  try { s += readFileSync(new URL(m, dir), 'utf8') + '\n'; } catch {}
}
if (!s) { console.error('FAIL no module source found'); process.exit(1); }

const checks = [
  ['bundle button wired', s.includes('$("exportAllBundleBtn")?.addEventListener("click"')],
  ['bundle button disabled on empty scan', s.includes('$("exportAllBundleBtn")&&($("exportAllBundleBtn").disabled=!0)')],
  ['bundle button enabled on messages', s.includes('$("exportAllBundleBtn")&&($("exportAllBundleBtn").disabled=!currentScan.messages.length)')],
  ['new jsonl uses session folder', s.includes('downloadText(withSessionFolder(e),toJsonl(t),"application/jsonl",!1)')],
  ['new md uses session folder', s.includes('downloadText(withSessionFolder(e),toMarkdown(currentScan,t),"text/markdown",!1)')],
  ['full jsonl uses session folder', s.includes('FULL-${Date.now()}.jsonl`;await downloadText(withSessionFolder(e),toJsonl(t),"application/jsonl",!1)')],
  ['full md uses session folder', s.includes('FULL-${Date.now()}.md`;await downloadText(withSessionFolder(e),toMarkdown(currentScan,t),"text/markdown",!1)')],
  ['full bundle uses session folder', s.includes('await downloadBundleZip(withSessionFolder(`${e}-bundle.json.gz`),n,!1)')],
  ['final bundle uses session folder', s.includes('await downloadBundleZip(withSessionFolder(`${g}-bundle.json.gz`),b,!1)')]
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) fail++;
}
if (fail) process.exit(1);
console.log('PASS_ALL verify-full-export-wiring');
