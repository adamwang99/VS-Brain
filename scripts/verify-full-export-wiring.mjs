import { readFileSync } from 'node:fs';
const s = readFileSync(new URL('../apps/extension/popup.js', import.meta.url), 'utf8');
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
