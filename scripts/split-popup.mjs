/**
 * VS Brain popup.js modular splitter — Step 1 of upgrade plan.
 * Parses the monolithic 130KB popup.js into 10 focused module files.
 *
 * Run: node scripts/split-popup.mjs
 */
import * as acorn from 'acorn';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_DIR = path.resolve(__dirname, '../apps/extension');
const SRC = path.join(EXT_DIR, 'popup.js');

console.log('=== VS Brain Modular Splitter ===\n');

const src = fs.readFileSync(SRC, 'utf8');
console.log(`Source size: ${(src.length/1024).toFixed(1)}KB, ${src.split('\n').length} lines`);

const ast = acorn.parse(src, { ecmaVersion: 2020, sourceType: 'script', locations: true });
console.log(`AST parsed: ${ast.body.length} top-level nodes\n`);

// Module → set of top-level identifier names
const MODULES = {
  core: new Set([
    'VS_BRAIN_RUNTIME_VERSION', 'VS_BRAIN_RUNTIME_MARKER',
    'VS_BRAIN_CONVERGENCE_CRITICAL_BUDGET', 'VS_BRAIN_ROUND_BUDGET',
    'DEMO_MAX_ROUNDS', 'RUNTIME_RECOVERY_KEY',
    'currentScan', '$', 'debugLines', 'LOG_MAX_LINES', 'LOG_TTL_MS',
    'log', 'setStatus', 'qs', 'qsa', 'hashText',
    'I18N', 'getLang',
  ]),
  i18n: new Set([
    'applyUiLang', 'initGlassSelects', 'positionGlassMenu',
    'rebuildGlassSelect', 'syncOneGlassSelect', 'syncGlassSelectLabels',
    'init',
  ]),
  storage: new Set([
    'getCheckpoint', 'setCheckpoint', 'filterNew', 'safeName',
    'inferDownloadMime', 'toBase64Utf8', 'downloadText', 'downloadBundleZip',
    'toJsonl', 'toMarkdown', 'estimateTokens', 'estimateScanTokens',
    'withSessionFolder', 'persistLoopCheckpoint', 'loadLoopCheckpoint',
    'buildSessionSlug', 'currentSessionFolder',
  ]),
  tabs: new Set([
    'activeTab', 'resolveArchiveScanTabId', 'runInPage', 'pageScanner',
    'getActiveAiTab', 'hasUsableLatestResponse', 'hasUsableLatestResponseOrReadyInput',
    'findUsableSourceTab', 'chooseSourceAndTarget', 'refreshTabs', 'aiTabs',
    'getLatestContentHash', 'executeInAiTab', 'waitForTabNewResponse',
    'getLatestHashForTab', 'getTabChecked', 'revealRunningTab',
    'waitForTabNewResponseStandalone',
    '__vsbrainHelperInvoker', 'escapeHtml',
  ]),
  providers: new Set([
    'AI_HOSTS', 'providerFromUrl', 'fillPromptInPage', 'clickSendInPage',
    'latestResponseContainsStopPhrase', 'latestResponseTerminalReady',
    'countAssistantMessagesInPage', 'smokeDetectInPage', 'detectProviderState',
    'fillTargetSafely', 'getActionDelayMs',
    'extractLatestResponseInPage', 'extractQualitySignals',
  ]),
  relay: new Set([
    'executeRelay', 'autoPickDirection', 'autoPickNewestDirection',
    'buildRelayPrompt', 'buildCritiquePrompt', 'buildFinalizePrompt', 'buildLedgerFinalizePrompt',
    'intentFinalizePrompt', 'intentPromptTemplate',
    'updateQualityGuard', 'checkLatestQuality',
    'defaultStopPhrase', 'ensureStopPhraseForLang', 'defaultPromptTemplate',
    'findAgreementInResponse', 'parseTerminationEnvelope',
    'ledgerPayloadBlock', 'validateLedgerQuality',
    'relayStateKey', 'getRelayState', 'setRelayState', 'clearRelayStates',
    'waitForSourceReady', 'waitForTargetIdle',
    'confirmSendAccepted',
    'getIntent', '__vsbrainRelayAbort', 'relayAbortController',
  ]),
  finalize: new Set([
    'finalize', 'buildFinalMarkdown', 'buildFinalJson',
    'getOutputMode', 'applyOutputModeUi', 'applyIntentUi',
    'isDemoBuild', 'applyDemoBuildIfFlagged',
    'setRoundLimit', 'getEvidencePayload',
    'finalizeAndSave',
    'loadRecoveredLoopState', 'clearRecoveredLoopState', 'tryRestoreRecoveredState',
  ]),
  archive: new Set([
    'scan', 'scanTabForHandoff', 'clearCheckpoint',
    'buildHandoffState', 'buildHandoffMarkdown', 'buildHandoffBootstrapPrompt',
    'createContextHandoff', 'autoHandoffIfNeeded', 'openReplacementAiTab',
  ]),
  ui: new Set([
    'loopState', 'lastStopReason',
    'startLoop', 'stopLoop', 'executeSingleRelay',
    'updateRunButtonState', 'handoff',
    'timerInterval', 'elapsedSeconds',
    'startTimer', 'stopTimer', 'updateTimer',
    'stopLeaseRenew', 'startLeaseRenew',
  ]),
  'ui-advanced': new Set([
    'toggleManualPanel', 'toggleAdvancedPanel', 'toggleHelp',
    'exportLog', 'resetPrompt', 'setDefaultStopPhrase',
    'buildHelpText', 'renderHelpModal',
  ]),
};

const NAME_TO_MODULE = {};
for (const [mod, names] of Object.entries(MODULES)) {
  for (const n of names) NAME_TO_MODULE[n] = mod;
}

const chunks = { core: [], i18n: [], storage: [], tabs: [], providers: [],
  relay: [], finalize: [], archive: [], ui: [], 'ui-advanced': [], unknown: [] };

const nodeCode = n => src.slice(n.start, n.end);

function namesOf(node) {
  const results = [];
  if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) {
      if (d.id?.type === 'Identifier') results.push(d.id.name);
    }
  } else if (node.type === 'FunctionDeclaration' && node.id) {
    results.push(node.id.name);
  } else if (node.type === 'ExpressionStatement') {
    const e = node.expression;
    if (e?.type === 'AssignmentExpression' && e.left?.type === 'Identifier') {
      results.push(e.left.name);
    } else if (
      e?.type === 'CallExpression' &&
      e.callee?.type === 'MemberExpression' &&
      e.callee.property?.name === 'set'
    ) {
      // window.__VSBRAIN_DISABLE_AUTO_HANDOFF = ...
    }
  }
  return results;
}

const INIT_LISTENER_RE = /\$\(["']((scanBtn|export|checkpoint|clearCheckpoint|relayBtn|startLoopBtn|autoPickBtn|swapTabsBtn|langMode|outputMode|critiqueIntent|stopPhrase|stepsSlider|loopMaxSteps|evidencePayload|extraInstruction|handoffBtn|resetRelayBtn|stopBtn|finalizeBtn|advancedBtn|manualBtn|helpBtn|exportLogBtn|resetPromptBtn|defaultStopPhraseBtn|autoSendToggle|relayPasteBtn|resumeBtn|langToggleBtn|recoveryGatePanel|bannerExplore|restartLoopBtn|getLicensedBtn))/;

for (const node of ast.body) {
  const code = nodeCode(node);
  const names = namesOf(node);
  const isListener = INIT_LISTENER_RE.test(code);

  let mod = 'unknown';
  for (const n of names) {
    if (NAME_TO_MODULE[n]) { mod = NAME_TO_MODULE[n]; break; }
  }
  if (mod === 'unknown' && isListener) mod = 'ui';

  chunks[mod].push({ code, names });
}

// Print stats
console.log('=== Module separation ===');
let total = 0;
for (const [mod, items] of Object.entries(chunks)) {
  if (mod === 'unknown') continue;
  const chars = items.reduce((s, c) => s + c.code.length, 0);
  console.log(`  ${mod.padEnd(16)} ${items.length.toString().padStart(3)} nodes  ${(chars/1024).toFixed(1)}KB`);
  total += chars;
}
const ukb = chunks.unknown.reduce((s, c) => s + c.code.length, 0) / 1024;
console.log(`  ${'unknown'.padEnd(16)} ${chunks.unknown.length.toString().padStart(3)} nodes  ${ukb.toFixed(1)}KB`);
console.log(`\nClassified: ${(total/1024).toFixed(1)}KB / ${(src.length/1024).toFixed(1)}KB (${(100*total/src.length).toFixed(1)}%)`);

// Show unknowns
if (chunks.unknown.length > 0) {
  console.log('\n=== Unknown (triage needed) ===');
  chunks.unknown.forEach(({ names, code }) => {
    const snip = code.slice(0, 180).replace(/\n/g, '↵');
    console.log(`\n  names: [${names.join(', ') || 'none'}]`);
    console.log(`  code:  ${snip}`);
  });
}

// Write files
console.log('\n=== Writing files ===');
const ORDER = ['core', 'i18n', 'storage', 'tabs', 'providers', 'relay', 'finalize', 'archive', 'ui', 'ui-advanced'];
for (const mod of ORDER) {
  const items = chunks[mod] || [];
  if (!items.length) continue;
  const joined = items.map(c => c.code).join('\n');
  const fp = path.join(EXT_DIR, `${mod}.js`);
  fs.writeFileSync(fp, joined);
  console.log(`  ✅ ${mod}.js  ${(joined.length/1024).toFixed(1)}KB`);
}

console.log('\nDone. Files written to apps/extension/');
