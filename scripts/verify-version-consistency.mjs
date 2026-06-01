#!/usr/bin/env node
// verify-version-consistency.mjs — Guard against the build-marker drift class.
// Asserts that the version string is identical across every place the policy requires:
//   apps/extension/manifest.json (semver), popup.html badge, and popup.js RUNTIME_VERSION.
// Also asserts the live-source duplicate of the signin guard exists in BOTH popup.js and
// page-helpers.js (the realm-split that caused fixes to land in one file but run from the other).
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const src = (rel) => fs.readFileSync(path.join(repoRoot, 'apps/extension', rel), 'utf8');

const manifest = JSON.parse(src('manifest.json'));
const semver = manifest.version;                       // e.g. 0.8.66
const popupHtml = src('popup.html');
const popupJs = src('popup.js');
const helpers = src('page-helpers.js');

const htmlBadge = (popupHtml.match(/class="version">v?([^<]+)</) || [])[1] || '';
const jsVersion = (popupJs.match(/VS_BRAIN_RUNTIME_VERSION="v?([^"]+)"/) || [])[1] || '';

// badge/js may carry a -marker suffix; the semver prefix must match manifest exactly.
const semverPrefix = (s) => String(s).split('-')[0];

const checks = [
  ['manifest semver present', !!semver],
  ['popup.html badge matches manifest semver', semverPrefix(htmlBadge) === semver],
  ['popup.js RUNTIME_VERSION matches manifest semver', semverPrefix(jsVersion) === semver],
  ['popup.html badge and popup.js version label identical', htmlBadge === jsVersion],
  // realm-split guard: signin classification must be gated on missing latest answer in BOTH realms
  ['popup.js signin guarded by &&!d', /chatgpt\/.test\(t\)&&!d&&\/log in/.test(popupJs)],
  ['page-helpers.js signin guarded by &&!d', /chatgpt\/.test\(t\)&&!d&&\/log in/.test(helpers)],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) fail++;
}
console.log(`\nmanifest=${semver}  html=${htmlBadge}  js=${jsVersion}`);
if (fail) { console.error(`\nFAIL ${fail} version-consistency check(s)`); process.exit(1); }
console.log('PASS_ALL verify-version-consistency');
