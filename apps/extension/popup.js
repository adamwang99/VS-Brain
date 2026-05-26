let currentScan = null;

const $ = (id) => document.getElementById(id);
const debugLines = [];
const LOG_MAX_LINES = 120;
const LOG_TTL_MS = 30 * 60 * 1000;
const log = (msg) => {
  const now = Date.now();
  debugLines.unshift({ ts: now, line: `${new Date(now).toLocaleTimeString()} ${msg}` });
  while (debugLines.length > LOG_MAX_LINES || (debugLines.length && now - debugLines[debugLines.length - 1].ts > LOG_TTL_MS)) debugLines.pop();
  $('log').textContent = debugLines.map((x) => x.line).join('\n');
};
const setStatus = (msg) => { $('status').textContent = msg; };

const I18N = {
  vi: {
    subtitle: 'AI debate relay · archive · checkpoint',
    critique: 'Phản biện',
    scanTabs: 'Quét tab',
    source: 'Nguồn',
    target: 'Đích',
    autoPick: 'Tự chọn',
    swap: '↔ Đổi',
    pasteCritique: 'Dán phản biện →',
    steps: 'Steps',
    delay: 'Delay',
    autoSend: 'Auto-send',
    autoLoop: 'Auto A↔B',
    stop: 'Dừng',
    finalize: 'Chốt & lưu',
    handoff: 'Handoff ngữ cảnh',
    resetRelay: 'Reset relay',
    advanced: 'Tuỳ chọn nâng cao',
    stopPhraseLabel: 'Cụm chốt dừng',
    promptTemplateLabel: 'Prompt phản biện',
    resetPrompt: 'Reset prompt mặc định',
    archive: 'Lưu trữ',
    scanChat: 'Quét chat',
    logDebug: 'Log / debug',
    exportLog: 'Xuất log',
    helpTitle: 'Hướng dẫn VS Brain',
    close: 'Đóng',
    ready: 'Sẵn sàng',
    oneClickTitle: 'Tự động phản biện giữa các AI',
    oneClickHint: 'Mở 2 tab AI, bấm bắt đầu. VS Brain tự chọn nguồn/đích, tự gửi, tự dừng khi đồng thuận.',
    startAuto: 'Bắt đầu tự động',
    running: 'Đang chạy…',
    autoModeNote: 'Mặc định: Auto source/target · Latest · Auto-send · 100 steps',
    manualMode: 'Manual / tuỳ chỉnh',
    loopCounterLabel: 'vòng',
    actionDelayLabel: 'Delay thao tác (ms)',
    auto: 'Auto',
    noAiTabs: 'Không thấy tab AI',
    jsonlNew: 'JSONL mới',
    mdNew: 'MD mới',
    jsonlFull: 'JSONL full',
    mdFull: 'MD full',
    markCheckpoint: 'Đánh mốc',
    clearCheckpoint: 'Xoá mốc'
  },
  en: {
    subtitle: 'AI debate relay · archive · checkpoint',
    critique: 'Critique',
    scanTabs: 'Scan tabs',
    source: 'Source',
    target: 'Target',
    autoPick: 'Auto pick',
    swap: '↔ Swap',
    pasteCritique: 'Paste critique →',
    steps: 'Steps',
    delay: 'Delay',
    autoSend: 'Auto-send',
    autoLoop: 'Auto A↔B',
    stop: 'Stop',
    finalize: 'Finalize & save',
    handoff: 'Context handoff',
    resetRelay: 'Reset relay',
    advanced: 'Advanced options',
    stopPhraseLabel: 'Stop phrase',
    promptTemplateLabel: 'Critique prompt',
    resetPrompt: 'Reset default prompt',
    archive: 'Archive',
    scanChat: 'Scan chat',
    logDebug: 'Log / debug',
    exportLog: 'Export log',
    helpTitle: 'VS Brain guide',
    close: 'Close',
    ready: 'Ready',
    oneClickTitle: 'Automatic AI-to-AI critique',
    oneClickHint: 'Open 2 AI tabs, press start. VS Brain auto-picks source/target, sends, and stops on agreement.',
    startAuto: 'Start auto',
    running: 'Running…',
    autoModeNote: 'Default: Auto source/target · Latest · Auto-send · 100 steps',
    manualMode: 'Manual / custom',
    loopCounterLabel: 'rds',
    actionDelayLabel: 'Action delay (ms)',
    auto: 'Auto',
    noAiTabs: 'No AI tabs',
    jsonlNew: 'New JSONL',
    mdNew: 'New MD',
    jsonlFull: 'Full JSONL',
    mdFull: 'Full MD',
    markCheckpoint: 'Mark checkpoint',
    clearCheckpoint: 'Clear checkpoint'
  }
};

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function applyUiLang() {
  const lang = getLang();
  const t = I18N[lang] || I18N.vi;
  document.documentElement.lang = lang;
  qsa('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });

  $('exportJsonlBtn').textContent = t.jsonlNew;
  $('exportMdBtn').textContent = t.mdNew;
  $('exportAllJsonlBtn').textContent = t.jsonlFull;
  $('exportAllMdBtn').textContent = t.mdFull;
  $('checkpointBtn').textContent = t.markCheckpoint;
  $('clearCheckpointBtn').textContent = t.clearCheckpoint;
  $('status').textContent = t.ready;
  qsa('[data-placeholder-vi]').forEach((el) => { el.placeholder = el.dataset[`placeholder${lang === 'en' ? 'En' : 'Vi'}`] || el.placeholder; });
  qsa('option[data-label-vi]').forEach((opt) => { opt.textContent = opt.dataset[`label${lang === 'en' ? 'En' : 'Vi'}`] || opt.textContent; });
  const h = $('helpBtn'); if (h) h.title = lang === 'en' ? 'Help' : 'Hướng dẫn sử dụng';
  updateRunButtonState(!!loopState);
  syncGlassSelectLabels();
}

function initGlassSelects() {
  qsa('select.glass-select').forEach((sel) => {
    if (sel.dataset.glassReady === '1') return;
    sel.dataset.glassReady = '1';
    const wrap = document.createElement('div');
    wrap.className = 'glass-select-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'glass-select-btn';
    const menu = document.createElement('div');
    menu.className = 'glass-select-menu hidden';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    document.body.appendChild(menu);
    sel._glassMenu = menu;
    sel._glassButton = btn;
    sel.classList.add('native-hidden');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      qsa('.glass-select-menu').forEach((m) => { if (m !== menu) m.classList.add('hidden'); });
      rebuildGlassSelect(sel);
      positionGlassMenu(sel);
      menu.classList.toggle('hidden');
    });
    sel.addEventListener('change', () => { syncOneGlassSelect(sel); });
  });
  document.addEventListener('click', () => qsa('.glass-select-menu').forEach((m) => m.classList.add('hidden')));
  window.addEventListener('resize', () => qsa('.glass-select-menu').forEach((m) => m.classList.add('hidden')));
  window.addEventListener('scroll', () => qsa('.glass-select-menu').forEach((m) => m.classList.add('hidden')), true);
  syncGlassSelectLabels();
}


function positionGlassMenu(sel) {
  const btn = sel._glassButton;
  const menu = sel._glassMenu;
  if (!btn || !menu) return;
  const r = btn.getBoundingClientRect();
  const width = Math.min(r.width, window.innerWidth - 16);
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
  const below = r.bottom + 6;
  const maxH = Math.min(260, window.innerHeight - 20);
  const top = below + 80 < window.innerHeight ? below : Math.max(8, r.top - maxH - 6);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${maxH}px`;
}

function rebuildGlassSelect(sel) {
  const menu = sel._glassMenu;
  if (!menu) return;
  menu.innerHTML = '';
  Array.from(sel.options).forEach((opt) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'glass-select-item';
    if (opt.value === sel.value) item.classList.add('active');
    item.textContent = opt.textContent;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      menu.classList.add('hidden');
    });
    menu.appendChild(item);
  });
}

function syncOneGlassSelect(sel) {
  const btn = sel._glassButton;
  if (!btn) return;
  const opt = sel.selectedOptions?.[0];
  btn.textContent = opt?.textContent || 'Auto';
  rebuildGlassSelect(sel);
}

function syncGlassSelectLabels() {
  qsa('select.glass-select').forEach(syncOneGlassSelect);
}


async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return tab;
}

async function runInPage(fn) {
  const tab = await activeTab();
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn });
  return result;
}

function pageScanner() {
  const url = location.href;
  const host = location.hostname;
  const platform = host.includes('gemini.google.com') ? 'gemini' : host.includes('chatgpt.com') || host.includes('chat.openai.com') ? 'chatgpt' : 'unknown';
  const title = document.title.replace(/\s*[|-]\s*(ChatGPT|Gemini).*$/i, '').trim() || document.title || 'Untitled';
  const conversationId = platform + ':' + (location.pathname || '/').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'current';

  function cleanText(text) {
    return (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function roleFromNode(node, idx) {
    const text = (node.getAttribute('data-message-author-role') || node.getAttribute('aria-label') || node.getAttribute('data-testid') || node.className || '').toString().toLowerCase();
    if (text.includes('user') || text.includes('you') || text.includes('human')) return 'user';
    if (text.includes('assistant') || text.includes('model') || text.includes('chatgpt') || text.includes('gemini') || text.includes('bot')) return 'assistant';
    return idx % 2 === 0 ? 'user' : 'assistant';
  }

  let nodes = [];
  if (platform === 'chatgpt') {
    nodes = Array.from(document.querySelectorAll('[data-message-author-role], [data-testid^="conversation-turn-"], article, main [class*="group"], .markdown'));
  } else if (platform === 'gemini') {
    nodes = Array.from(document.querySelectorAll('user-query, model-response, message-content, .conversation-container [class*="query"], .conversation-container [class*="response"]'));
  }
  if (!nodes.length) nodes = Array.from(document.querySelectorAll('main article, main [role="article"], main .markdown, main p')).slice(-100);

  const seen = new Set();
  const messages = [];
  nodes.forEach((node, idx) => {
    const content = cleanText(node.innerText || node.textContent || '');
    if (!content || content.length < 2) return;
    const contentHash = hash(content);
    const role = roleFromNode(node, idx);
    const messageKey = `${platform}:${conversationId}:${role}:${contentHash}`;
    if (seen.has(messageKey)) return;
    seen.add(messageKey);
    messages.push({
      platform,
      conversationId,
      conversationTitle: title,
      role,
      content,
      contentHash,
      messageKey,
      exportedAt: new Date().toISOString()
    });
  });

  return { platform, conversationId, title, url, messages };
}

async function getCheckpoint(scan) {
  const key = `checkpoint:${scan.platform}:${scan.conversationId}`;
  const obj = await chrome.storage.local.get(key);
  return obj[key] || null;
}

async function setCheckpoint(scan, messages) {
  const key = `checkpoint:${scan.platform}:${scan.conversationId}`;
  const last = messages[messages.length - 1];
  const checkpoint = {
    platform: scan.platform,
    conversationId: scan.conversationId,
    lastExportedAt: new Date().toISOString(),
    lastSeenMessageKey: last?.messageKey,
    messageCount: messages.length,
    tailHashes: messages.slice(-5).map((m) => m.contentHash)
  };
  await chrome.storage.local.set({ [key]: checkpoint });
  return checkpoint;
}

async function filterNew(scan) {
  const checkpoint = await getCheckpoint(scan);
  if (!checkpoint?.lastSeenMessageKey) return scan.messages;
  const idx = scan.messages.findIndex((m) => m.messageKey === checkpoint.lastSeenMessageKey);
  if (idx < 0) return scan.messages;
  return scan.messages.slice(idx + 1);
}

function safeName(s) {
  return (s || 'conversation').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'conversation';
}

async function downloadText(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  await chrome.downloads.download({ url, filename, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function toJsonl(messages) {
  return messages.map((m) => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : '');
}

function toMarkdown(scan, messages) {
  const lines = [`# ${scan.title}`, '', `- Provider: ${scan.platform}`, `- URL: ${scan.url}`, `- Exported: ${new Date().toISOString()}`, ''];
  for (const m of messages) {
    lines.push(`## ${m.role}`, '', m.content, '');
  }
  return lines.join('\n');
}

function estimateTokens(text) {
  const raw = String(text || '');
  if (!raw) return 0;
  const nonAscii = (raw.match(/[^\x00-\x7F]/g) || []).length;
  const ratio = nonAscii / Math.max(1, raw.length);
  const charsPerToken = ratio > 0.2 ? 2.8 : 4;
  return Math.ceil(raw.length / charsPerToken);
}

function estimateScanTokens(scan) {
  const text = (scan?.messages || []).map((m) => `${m.role}: ${m.content}`).join('\n\n');
  return { chars: text.length, tokens_est: estimateTokens(text) };
}

function extractQualitySignals(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const confidenceMatch = lower.match(/confidence\s*[:：]?\s*(\d+(?:\.\d+)?)/i) || lower.match(/điểm tin cậy\s*[:：]?\s*(\d+(?:\.\d+)?)/i);
  const confidence = confidenceMatch ? Math.max(0, Math.min(10, Number(confidenceMatch[1]))) : null;
  const shouldContinue = /should_continue\s*[:：]?\s*true/i.test(t) || /tiếp tục\s*[:：]?\s*(có|true)/i.test(lower);
  const noNewIssues = /(no new issues|không có lỗi mới|không còn lỗi mới|no material issues)/i.test(t);
  const contradiction = /(contradiction|mâu thuẫn|inconsistent|không nhất quán)/i.test(t);
  const critical = /(critical issues?\s*[:：]\s*(?!none|không)|lỗi nghiêm trọng\s*[:：]\s*(?!không)|blocker|chặn)/i.test(t);
  return { confidence, shouldContinue, noNewIssues, contradiction, critical };
}

function updateQualityGuard(tabId, contentHash, content) {
  if (!loopState) return { ok: true };
  if (!loopState.quality) loopState.quality = { hashes: [], repeatedCount: 0, noNewIssuesCount: 0, lowConfidenceCount: 0, contradictionCount: 0, criticalCount: 0 };
  const q = loopState.quality;
  const prev = q.hashes[q.hashes.length - 1];
  if (contentHash && prev === contentHash) q.repeatedCount += 1;
  else if (contentHash) q.hashes.push(contentHash);
  if (q.hashes.length > 8) q.hashes.shift();
  const sig = extractQualitySignals(content);
  if (sig.noNewIssues) q.noNewIssuesCount += 1; else q.noNewIssuesCount = 0;
  if (sig.confidence != null && sig.confidence < 7) q.lowConfidenceCount += 1; else if (sig.confidence != null) q.lowConfidenceCount = 0;
  if (sig.contradiction) q.contradictionCount += 1;
  if (sig.critical) q.criticalCount += 1;
  q.last = { tabId, contentHash, ...sig, checkedAt: new Date().toISOString() };
  log(`quality tab=${tabId} repeat=${q.repeatedCount} noNew=${q.noNewIssuesCount} lowConf=${q.lowConfidenceCount} contradiction=${q.contradictionCount} critical=${q.criticalCount}`);
  if (q.repeatedCount >= 2) return { ok: false, reason: 'quality_guard_repeated_hash' };
  if (q.contradictionCount >= 2) return { ok: false, reason: 'quality_guard_contradiction' };
  if (q.lowConfidenceCount >= 2) return { ok: false, reason: 'quality_guard_low_confidence' };
  return { ok: true };
}

async function checkLatestQuality(tabId) {
  const latest = await executeInAiTab(tabId, extractLatestResponseInPage, ['latest'], 'quality-tab');
  if (!latest?.content) return { ok: true };
  let h = null;
  try { h = await getLatestContentHash(tabId); } catch (_) {}
  return updateQualityGuard(tabId, h, latest.content);
}

function buildHandoffState(scan, reason = 'manual_context_handoff') {
  const latest = (scan.messages || [])[scan.messages.length - 1] || null;
  const est = estimateScanTokens(scan);
  const limit = 128000;
  return {
    schema: 'vs-brain.context_handoff.v1',
    created_at: new Date().toISOString(),
    reason,
    provider: scan.platform,
    title: scan.title,
    url: scan.url,
    conversation_id: scan.conversationId,
    message_count: scan.messages.length,
    context_estimate: {
      visible_context_chars: est.chars,
      visible_context_tokens_est: est.tokens_est,
      context_limit_assumption: limit,
      usage_pct_est: Math.round((est.tokens_est / limit) * 1000) / 10,
      confidence: 'low_web_ui_estimate'
    },
    loop: {
      step: Number($('loopCounter')?.textContent?.split('/')[0] || 0),
      max_steps: Number($('loopMaxSteps')?.value || 100),
      stop_reason: lastStopReason || 'unknown'
    },
    latest_answer: latest ? { role: latest.role, content: latest.content, content_hash: latest.contentHash } : null,
    compressed_state_template: {
      requirements: [],
      decisions: [],
      resolved_issues: [],
      unresolved_issues: [],
      next_critique_focus: $('extraInstruction')?.value || ''
    }
  };
}

function buildHandoffMarkdown(state) {
  return `# VS Brain Context Handoff

- Created: ${state.created_at}
- Reason: ${state.reason}
- Provider: ${state.provider}
- Title: ${state.title}
- URL: ${state.url}
- Messages: ${state.message_count}
- Visible context chars: ${state.context_estimate.visible_context_chars}
- Estimated tokens: ${state.context_estimate.visible_context_tokens_est}
- Estimated usage: ${state.context_estimate.usage_pct_est}% of ${state.context_estimate.context_limit_assumption}
- Estimate confidence: ${state.context_estimate.confidence}
- Loop: ${state.loop.step}/${state.loop.max_steps}
- Stop reason: ${state.loop.stop_reason}

## What this solves

This handoff resets the provider session without losing the useful state. Do not paste the full old debate. Use this compressed state as the new source-of-truth.

## Required compressed state

Before continuing, distill the old debate into a clean state. Do not copy the whole history. Extract only durable facts:

### Requirements / invariants
- Extract hard requirements that must remain true.

### Decisions already accepted
- Extract decisions that are no longer disputed.

### Resolved issues
- Extract issues that were fixed or explicitly accepted.

### Unresolved issues / blockers
- Extract remaining blockers, contradictions, missing evidence, or assumptions.

### Quality guard
- If confidence is below 9/10, or blockers remain, do not write the final agreement stop phrase.
- If the latest answer contradicts any invariant, mark it as unresolved.

### Latest answer to continue from

${state.latest_answer?.content || ''}

## Bootstrap prompt for new tab

Continue the VS Brain critique from this compressed handoff. Treat the sections above as source-of-truth. Do not rely on previous chat history. First, reconstruct a concise state with exactly these sections: requirements, decisions, resolved issues, unresolved issues, quality risks. Then continue critique only on unresolved issues and the latest answer. If no unresolved issue remains, perform one final verification pass before writing any stop phrase. Do not write the final agreement stop phrase unless confidence is >= 9/10, there are no contradictions, no critical blockers, and no missing evidence that changes the decision.
`;
}

async function createContextHandoff(reason = 'manual_context_handoff') {
  const tab = await activeTab();
  const [{ result: scan }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageScanner });
  if (!scan?.messages?.length) throw new Error('Không có chat để tạo handoff');
  const state = buildHandoffState(scan, reason);
  const base = `vs-brain/context-handoff-${safeName(state.provider)}-${Date.now()}`;
  await downloadText(`${base}.md`, buildHandoffMarkdown(state), 'text/markdown');
  await downloadText(`${base}.json`, JSON.stringify(state, null, 2), 'application/json');
  await chrome.storage.local.set({ latestContextHandoff: state });
  log(`context handoff created provider=${state.provider} tokens_est=${state.context_estimate.tokens_est} usage=${state.context_estimate.usage_pct_est}%`);
  if (window.confirm(getLang() === 'en' ? 'Open a new AI tab for this handoff?' : 'Mở tab AI mới để tiếp tục từ handoff?')) {
    await chrome.tabs.create({ url: state.url });
  }
  return state;
}

async function scanTabForHandoff(tabId) {
  const [{ result: scan }] = await chrome.scripting.executeScript({ target: { tabId: Number(tabId) }, func: pageScanner });
  return scan;
}

function buildHandoffBootstrapPrompt(state) {
  return buildHandoffMarkdown(state).replace(/^# VS Brain Context Handoff/, '# VS Brain Auto Handoff Bootstrap');
}

async function openReplacementAiTab(url) {
  const tab = await chrome.tabs.create({ url, active: true });
  await new Promise((r) => setTimeout(r, Math.max(2500, getActionDelayMs())));
  return tab;
}

async function autoHandoffIfNeeded() {
  if (!loopState || loopState.handoffInProgress) return false;
  const threshold = 70;
  const candidates = [loopState.currentSource, loopState.currentTarget].filter(Boolean);
  for (const tabId of candidates) {
    let scan = null;
    try { scan = await scanTabForHandoff(tabId); } catch (e) { log(`auto-handoff scan fail tab=${tabId}: ${e.message}`); continue; }
    if (!scan?.messages?.length) continue;
    const state = buildHandoffState(scan, 'auto_context_threshold');
    const pct = Number(state.context_estimate?.usage_pct_est || 0);
    if (pct < threshold) continue;

    loopState.handoffInProgress = true;
    log(`auto-handoff triggered tab=${tabId} usage=${pct}% threshold=${threshold}%`);
    const base = `vs-brain/context-handoff-auto-${safeName(state.provider)}-${Date.now()}`;
    await downloadText(`${base}.md`, buildHandoffMarkdown(state), 'text/markdown');
    await downloadText(`${base}.json`, JSON.stringify(state, null, 2), 'application/json');
    await chrome.storage.local.set({ latestContextHandoff: state });

    const newTab = await openReplacementAiTab(state.url);
    const prompt = buildHandoffBootstrapPrompt(state);
    const oldHash = await getLatestContentHash(newTab.id).catch(() => '');
    const fill = await fillTargetSafely(newTab.id, prompt);
    if (!fill?.ok) throw new Error('auto-handoff không inject được bootstrap prompt');
    if ($('autoSendToggle')?.checked) {
      const sent = await executeInAiTab(newTab.id, clickSendInPage, [], 'handoff-new-tab');
      if (!sent?.ok) throw new Error(`auto-handoff không gửi được bootstrap: ${sent?.error || 'unknown'}`);
      log(`auto-handoff bootstrap sent newTab=${newTab.id}; waiting first response`);
      const waited = await waitForTabNewResponse(newTab.id, oldHash, Math.max(60000, loopState.waitMs), 2000);
      if (!waited.changed && !waited.stop) log(`auto-handoff no new response yet: ${waited.reason}`);
    }

    if (loopState.a === tabId) loopState.a = newTab.id;
    if (loopState.b === tabId) loopState.b = newTab.id;
    if (loopState.currentSource === tabId) loopState.currentSource = newTab.id;
    if (loopState.currentTarget === tabId) loopState.currentTarget = newTab.id;
    $('sourceTab').value = String(loopState.currentSource);
    $('targetTab').value = String(loopState.currentTarget);
    loopState.handoffInProgress = false;
    log(`auto-handoff completed: ${tabId} → ${newTab.id}; resuming loop`);
    return true;
  }
  return false;
}


async function scan() {
  setStatus('Đang quét...');
  currentScan = await runInPage(pageScanner);
  $('provider').textContent = currentScan.platform;
  $('title').textContent = currentScan.title;
  $('count').textContent = String(currentScan.messages.length);
  const cp = await getCheckpoint(currentScan);
  const newMessages = await filterNew(currentScan);
  $('exportJsonlBtn').disabled = !newMessages.length;
  $('exportMdBtn').disabled = !newMessages.length;
  $('exportAllJsonlBtn').disabled = !currentScan.messages.length;
  $('exportAllMdBtn').disabled = !currentScan.messages.length;
  $('checkpointBtn').disabled = !currentScan.messages.length;
  $('clearCheckpointBtn').disabled = !cp;
  setStatus(`Tìm thấy ${currentScan.messages.length} tin, mới ${newMessages.length} tin.`);
  log(`scan provider=${currentScan.platform} found=${currentScan.messages.length} new=${newMessages.length} checkpoint=${cp?.lastSeenMessageKey ? 'yes' : 'no'}`);
}

$('scanBtn').addEventListener('click', async () => {
  try { await scan(); } catch (e) { setStatus('Quét thất bại.'); log(e.message); }
});

$('exportJsonlBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    const messages = await filterNew(currentScan);
    const filename = `vs-brain/${currentScan.platform}/${safeName(currentScan.title)}-${Date.now()}.jsonl`;
    await downloadText(filename, toJsonl(messages), 'application/jsonl');
    await setCheckpoint(currentScan, currentScan.messages);
    log(`exported JSONL: ${messages.length} messages`);
    await scan();
  } catch (e) { log(e.message); }
});

$('exportMdBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    const messages = await filterNew(currentScan);
    const filename = `vs-brain/${currentScan.platform}/${safeName(currentScan.title)}-${Date.now()}.md`;
    await downloadText(filename, toMarkdown(currentScan, messages), 'text/markdown');
    await setCheckpoint(currentScan, currentScan.messages);
    log(`exported Markdown: ${messages.length} messages`);
    await scan();
  } catch (e) { log(e.message); }
});


$('exportAllJsonlBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    const messages = currentScan.messages;
    const filename = `vs-brain/${currentScan.platform}/${safeName(currentScan.title)}-FULL-${Date.now()}.jsonl`;
    await downloadText(filename, toJsonl(messages), 'application/jsonl');
    await setCheckpoint(currentScan, currentScan.messages);
    log(`exported full JSONL: ${messages.length} messages`);
    await scan();
  } catch (e) { log(e.message); }
});

$('exportAllMdBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    const messages = currentScan.messages;
    const filename = `vs-brain/${currentScan.platform}/${safeName(currentScan.title)}-FULL-${Date.now()}.md`;
    await downloadText(filename, toMarkdown(currentScan, messages), 'text/markdown');
    await setCheckpoint(currentScan, currentScan.messages);
    log(`exported full Markdown: ${messages.length} messages`);
    await scan();
  } catch (e) { log(e.message); }
});

async function clearCheckpoint(scan) {
  const key = `checkpoint:${scan.platform}:${scan.conversationId}`;
  await chrome.storage.local.remove(key);
}

$('clearCheckpointBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    await clearCheckpoint(currentScan);
    log('checkpoint cleared');
    await scan();
  } catch (e) { log(e.message); }
});

$('checkpointBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    await setCheckpoint(currentScan, currentScan.messages);
    log('checkpoint marked');
    await scan();
  } catch (e) { log(e.message); }
});

scan().catch((e) => log(e.message));

const AI_HOSTS = [
  ['chatgpt', ['chatgpt.com', 'chat.openai.com']],
  ['gemini', ['gemini.google.com']],
  ['deepseek', ['chat.deepseek.com']],
  ['claude', ['claude.ai']],
  ['perplexity', ['perplexity.ai']],
  ['grok', ['grok.com', 'x.com/i/grok']]
];

function providerFromUrl(url = '') {
  for (const [name, hosts] of AI_HOSTS) if (hosts.some((h) => url.includes(h))) return name;
  return 'unknown';
}

let aiTabs = [];

async function refreshTabs() {
  const tabs = await chrome.tabs.query({});
  aiTabs = tabs
    .filter((t) => providerFromUrl(t.url) !== 'unknown')
    .map((t) => ({ id: t.id, title: t.title || 'Untitled', url: t.url || '', provider: providerFromUrl(t.url) }));
  const html = aiTabs.map((t) => `<option value="${t.id}">${t.provider} — ${escapeHtml(t.title).slice(0, 70)}</option>`).join('');
  const t = I18N[getLang()] || I18N.vi;
  const autoOpt = `<option value="auto">${t.auto}</option>`;
  $('sourceTab').innerHTML = aiTabs.length ? autoOpt + html : `<option value="">${t.noAiTabs}</option>`;
  $('targetTab').innerHTML = aiTabs.length ? autoOpt + html : `<option value="">${t.noAiTabs}</option>`;
  $('relayBtn').disabled = aiTabs.length < 2;
  $('startLoopBtn').disabled = aiTabs.length < 2;
  $('autoPickBtn').disabled = aiTabs.length < 2;
  $('swapTabsBtn').disabled = aiTabs.length < 2;

  if (aiTabs.length >= 2) {
    try {
      await autoPickNewestDirection();
    } catch (_) {
      $('sourceTab').value = String(aiTabs[0].id);
      const fallbackTarget = aiTabs.find((t) => t.id !== aiTabs[0].id) || aiTabs[1];
      $('targetTab').value = String(fallbackTarget.id);
      log(`fallback default pick: source=${aiTabs[0].provider} → target=${fallbackTarget.provider}`);
    }
  }
  syncGlassSelectLabels();
  log(`AI tabs scanned: ${aiTabs.length}`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function extractLatestResponseInPage(mode = 'latest') {
  function cleanText(text) {
    return (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (mode === 'selection') {
    const selected = cleanText(String(window.getSelection?.() || ''));
    if (selected) return { platform: 'selection', title: document.title, url: location.href, content: selected };
  }
  const host = location.hostname;
  const platform = host.includes('gemini.google.com') ? 'gemini'
    : host.includes('deepseek.com') ? 'deepseek'
    : host.includes('claude.ai') ? 'claude'
    : host.includes('perplexity.ai') ? 'perplexity'
    : host.includes('chatgpt.com') || host.includes('chat.openai.com') ? 'chatgpt'
    : 'unknown';

  const selectors = platform === 'chatgpt'
    ? ['[data-message-author-role="assistant"]', '[data-testid^="conversation-turn-"] [class*="markdown"]', '[data-testid^="conversation-turn-"] .markdown', 'article .markdown', '.markdown', 'article']
    : platform === 'gemini'
      ? ['model-response', 'message-content', '.model-response-text']
      : platform === 'deepseek'
        ? ['.ds-markdown', '[class*="message"]', '[class*="answer"]']
        : platform === 'claude'
          ? ['[data-testid*="assistant"]', '.font-claude-message', '[class*="assistant"]']
          : platform === 'perplexity'
            ? ['[data-testid*="answer"]', '.prose', '[class*="answer"]']
            : ['main article', '.markdown', 'p'];

  let candidates = [];
  for (const sel of selectors) candidates.push(...Array.from(document.querySelectorAll(sel)));
  candidates = candidates
    .map((node) => cleanText(node.innerText || node.textContent || ''))
    .filter((text) => text && text.length > 30)
    .filter((text, idx, arr) => arr.indexOf(text) === idx);
  const content = candidates[candidates.length - 1] || '';
  return { platform, title: document.title, url: location.href, content };
}

async function fillPromptInPage(prompt, autoSend = false) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function visible(el) {
    const r = el.getBoundingClientRect?.();
    return !!r && r.width > 0 && r.height > 0;
  }

  async function setByClipboard(el, value) {
    try {
      el.focus();
      el.click();
      await navigator.clipboard.writeText(value);
      const ok = document.execCommand?.('paste');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: value }));
      await sleep(80);
      return ok || (el.innerText || el.value || '').includes(value.slice(0, 40));
    } catch (_) {
      return false;
    }
  }

  function setValue(el, value) {
    el.scrollIntoView?.({ block: 'center' });
    el.focus();
    el.click();
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
      el.textContent = '';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      return (el.innerText || el.textContent || '').includes(value.slice(0, 40));
    }
    if ('value' in el) {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return (el.value || '').includes(value.slice(0, 40));
    }
    return false;
  }

  const selectors = [
    'rich-textarea .ql-editor',
    '.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea[placeholder]',
    'textarea',
    '[role="textbox"]',
    'div.ProseMirror'
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const sel of selectors) {
      const els = Array.from(document.querySelectorAll(sel)).filter((el) => !el.disabled && visible(el));
      const el = els[els.length - 1];
      if (!el) continue;
      if (setValue(el, prompt)) return { ok: true, method: 'setValue', selector: sel };
      if (await setByClipboard(el, prompt)) return { ok: true, method: 'clipboard', selector: sel };
    }
    await sleep(250);
  }
  return { ok: false, error: 'Không tìm thấy hoặc không set được ô nhập chat. Hãy click vào ô chat Gemini rồi thử lại.' };
}

async function clickSendInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Gửi" i]',
    'button[aria-label*="Submit" i]',
    'button.send-button',
    'button:has(mat-icon)',
    'button'
  ];
  await sleep(250);
  for (const sel of selectors) {
    let buttons = [];
    try { buttons = Array.from(document.querySelectorAll(sel)); } catch (_) { continue; }
    buttons = buttons.filter((b) => {
      const txt = `${b.innerText || ''} ${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''}`.toLowerCase();
      const r = b.getBoundingClientRect?.();
      return r && r.width > 0 && r.height > 0 && !b.disabled && (txt.includes('send') || txt.includes('gửi') || txt.includes('submit') || txt.includes('arrow') || txt.includes('send-button'));
    });
    const btn = buttons[buttons.length - 1];
    if (btn) { btn.click(); return { ok: true, selector: sel }; }
  }
  return { ok: false, error: 'Không tìm thấy nút gửi' };
}

function latestResponseContainsStopPhrase(stopPhrase) {
  const latest = extractLatestResponseInPage('latest');
  return !!latest?.content && latest.content.includes(stopPhrase);
}



function getLang() {
  return $('langMode')?.value || 'vi';
}

function defaultStopPhrase(lang = getLang()) {
  return lang === 'en' ? 'VS_BRAIN_FULL_AGREEMENT' : 'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN';
}

function ensureStopPhraseForLang() {
  const el = $('stopPhrase');
  if (!el) return;
  const lang = getLang();
  const vi = 'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN';
  const en = 'VS_BRAIN_FULL_AGREEMENT';
  if (!el.value || el.value === vi || el.value === en) el.value = defaultStopPhrase(lang);
}

function defaultPromptTemplate(lang = getLang(), stopPhrase = defaultStopPhrase(lang)) {
  if (lang === 'en') {
    return `You are a senior multi-angle critique agent. Use deep reasoning and review the NEW CONTENT below as a panel: systems architect, implementation engineer, UX reviewer, security/privacy reviewer, fact/evidence checker, and product manager.

Rules:
- Critique only the NEW CONTENT below. Do not repeat old history.
- Do not agree socially. Agree only when there are no material issues left.
- Separate critical issues, medium gaps, and minor notes.
- If fixes are needed, make them specific and actionable.

Review checklist:
1. Logic: contradictions, leaps, invalid conclusions.
2. Technical feasibility: edge cases, implementation limits, browser/provider constraints.
3. Facts/evidence: weak assumptions, missing verification.
4. Product/UX: clarity, recovery path, error states.
5. Security/privacy: overbroad permissions, auto-send risk, sensitive storage/clipboard.
6. Context/performance: repeated copying, prompt bloat, infinite loop risk, weak stop gates.
7. Operations: logging, versioning, rollback, compatibility, user guidance.
8. Finality: is it ready to stop or does another provider need to critique?

Required output:
- Verdict: PASS / PARTIAL / FAIL
- Critical issues:
- Missing pieces:
- Minor notes:
- Suggested fixes:
- Confidence: 0-10
- should_continue: true/false

FULL AGREEMENT STOP CONDITIONS:
You may write the stop phrase only if ALL are true:
1. No critical issues remain.
2. No missing pieces that change the conclusion/product.
3. No unresolved security/operational risk.
4. No logical contradiction or unclear requirement remains.
5. Confidence >= 9/10.
6. should_continue=false.

If and only if all 6 conditions are true, write EXACTLY this phrase on the final line:
${stopPhrase}

If any condition is not met, never write the stop phrase.`;
  }
  return `Bạn là AI phản biện tổng hợp cấp cao. Hãy kích hoạt suy luận sâu, kiểm tra đa góc nhìn, phản biện như hội đồng gồm: kiến trúc sư hệ thống, kỹ sư triển khai, chuyên gia UX, chuyên gia bảo mật, kiểm định fact/evidence, và quản lý sản phẩm.

Nguyên tắc bắt buộc:
- Chỉ phản biện NỘI DUNG MỚI bên dưới, không lặp lại lịch sử cũ.
- Không đồng ý xã giao. Chỉ đồng ý khi thật sự không còn lỗi đáng kể.
- Tách rõ lỗi nghiêm trọng, thiếu sót vừa, góp ý nhỏ.
- Nếu cần sửa, nêu sửa cụ thể, không nói chung chung.
- Nếu nội dung đã ổn, vẫn phải kiểm tra lần cuối các điều kiện chốt.

Checklist phản biện đa góc nhìn:
1. Logic: mâu thuẫn, nhảy bước, kết luận không theo tiền đề, vòng lặp lập luận.
2. Kỹ thuật: tính khả thi, edge case, lỗi triển khai, dependency, giới hạn nền tảng/browser/provider.
3. Fact/evidence: giả định chưa chứng minh, thiếu nguồn, điểm có thể sai hoặc cần kiểm chứng.
4. Product/UX: thao tác có dễ hiểu không, có undo/recovery không, có trạng thái lỗi rõ không.
5. Security/privacy: quyền quá rộng, auto-send nguy hiểm, rò dữ liệu, clipboard/storage nhạy cảm.
6. Hiệu suất/context: copy lặp, prompt phình, tốn token, vòng lặp vô hạn, stop gate yếu.
7. Vận hành: log/debug, versioning, rollback, compatibility, hướng dẫn người dùng.
8. Kết quả cuối: có đủ tiêu chí để dừng chưa, còn cần provider khác phản biện không.

Output bắt buộc bằng tiếng Việt, ngắn nhưng đủ sắc:
- Kết luận: PASS / PARTIAL / FAIL
- Lỗi nghiêm trọng: ...
- Thiếu sót cần bổ sung: ...
- Góp ý nhỏ: ...
- Sửa đề xuất: ...
- Điểm tin cậy: 0-10
- should_continue: true/false

ĐIỀU KIỆN ĐỂ ĐƯỢC CHỐT ĐỒNG THUẬN HOÀN TOÀN:
Chỉ được ghi cụm từ chốt nếu TẤT CẢ điều kiện sau đều đúng:
1. Không còn lỗi nghiêm trọng.
2. Không còn thiếu sót làm thay đổi kết luận/sản phẩm.
3. Không còn rủi ro bảo mật/vận hành chưa có cách xử lý.
4. Không còn mâu thuẫn logic hoặc yêu cầu chưa rõ.
5. Điểm tin cậy >= 9/10.
6. should_continue=false.

Nếu và chỉ nếu đồng ý hoàn toàn theo 6 điều kiện trên, hãy ghi CHÍNH XÁC cụm từ sau ở dòng cuối cùng:
${stopPhrase}

Nếu chưa đạt đủ 6 điều kiện, tuyệt đối không ghi cụm từ chốt.`;
}

function buildRelayPrompt(kind, source, extraInstruction = '', stopPhrase = defaultStopPhrase(), lang = getLang()) {
  const content = source.content;
  const extra = extraInstruction.trim();
  const custom = ($('promptTemplate')?.value || '').trim() || defaultPromptTemplate(lang, stopPhrase);
  const extraBlock = lang === 'en'
    ? (extra ? `\n\nUSER EXTRA INSTRUCTIONS:\n${extra}` : '')
    : (extra ? `\n\nYÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG:\n${extra}` : '');
  const sourceLabel = lang === 'en' ? 'Source' : 'Nguồn';
  const contentLabel = lang === 'en' ? 'NEW CONTENT' : 'NỘI DUNG MỚI';
  return `${custom}\n\n${sourceLabel}: ${source.platform}${extraBlock}\n\n${contentLabel}:\n${content}`;
}

function hashText(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function relayStateKey(sourceId, targetId, kind, mode) {
  return `relay:${sourceId}:${targetId}:${kind}:${mode}`;
}

async function getRelayState(key) {
  const obj = await chrome.storage.local.get(key);
  return obj[key] || null;
}

async function setRelayState(key, state) {
  await chrome.storage.local.set({ [key]: state });
}

async function clearRelayStates() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('relay:'));
  if (keys.length) await chrome.storage.local.remove(keys);
  return keys.length;
}


async function getLatestHashForTab(tabId) {
  try {
    const [{ result: source }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractLatestResponseInPage,
      args: ['latest']
    });
    if (!source?.content) return null;
    return {
      tabId,
      provider: source.platform,
      title: source.title,
      contentHash: hashText(source.content),
      preview: source.content.slice(0, 120)
    };
  } catch (_) {
    return null;
  }
}

async function autoPickNewestDirection() {
  if (aiTabs.length < 2) throw new Error('Cần ít nhất 2 tab AI');
  const currentSource = Number($('sourceTab').value) || 0;
  const currentTarget = Number($('targetTab').value) || 0;
  const preferred = [currentSource, currentTarget].filter(Boolean);
  const candidates = (preferred.length >= 2 ? aiTabs.filter((t) => preferred.includes(t.id)) : aiTabs).slice(0, 6);
  const states = (await Promise.all(candidates.map((t) => getLatestHashForTab(t.id)))).filter(Boolean);
  if (states.length < 2) throw new Error('Không đọc được đủ 2 tab để tự chọn');

  const allStore = await chrome.storage.local.get(null);
  const usedHashes = new Set(Object.values(allStore)
    .filter((v) => v && typeof v === 'object' && v.contentHash && v.relayedAt)
    .map((v) => v.contentHash));

  const fresh = states.filter((s) => !usedHashes.has(s.contentHash));
  const source = fresh[0] || states[0];
  let target = states.find((s) => s.tabId !== source.tabId && s.tabId === currentTarget)
    || states.find((s) => s.tabId !== source.tabId && s.tabId === currentSource)
    || states.find((s) => s.tabId !== source.tabId);
  if (!target) throw new Error('Không tìm được tab đích khác nguồn');

  $('sourceTab').value = String(source.tabId);
  $('targetTab').value = String(target.tabId);
  log(`auto-pick: source=${source.provider} hash=${source.contentHash}${fresh.length ? ' fresh' : ' already relayed'} → target=${target.provider}`);
  return { source, target };
}


function getActionDelayMs() {
  return Math.max(300, Math.min(10000, Number($('actionDelayMs')?.value || 1200)));
}


async function getTabChecked(tabId, role = 'tab') {
  let tab = null;
  try { tab = await chrome.tabs.get(Number(tabId)); } catch (_) {}
  if (!tab?.id) throw new Error(`${role} không còn tồn tại: tab=${tabId}`);
  const provider = providerFromUrl(tab.url || '');
  if (provider === 'unknown') throw new Error(`${role} không còn là tab AI hợp lệ: tab=${tabId}`);
  return { tab, provider };
}

async function revealRunningTab(tabId, reason = 'restore') {
  const { tab, provider } = await getTabChecked(tabId, 'target');
  if (tab.windowId && chrome.windows?.update) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  }
  await chrome.tabs.update(tab.id, { active: true });
  await new Promise((r) => setTimeout(r, getActionDelayMs()));
  log(`restore tab ${tab.id} (${provider}) reason=${reason}`);
  return tab;
}

async function executeInAiTab(tabId, func, args = [], role = 'tab') {
  await getTabChecked(tabId, role);
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: Number(tabId) }, func, args });
  return result;
}

async function fillTargetSafely(targetId, prompt) {
  await revealRunningTab(targetId, 'before-fill');
  let result = await executeInAiTab(targetId, fillPromptInPage, [prompt], 'target');
  if (result?.ok) return result;
  log(`fill failed first attempt tab=${targetId}: ${result?.error || 'unknown'}; retrying restore/rebind once`);
  await revealRunningTab(targetId, 'fill-retry');
  result = await executeInAiTab(targetId, fillPromptInPage, [prompt], 'target');
  if (result?.ok) return result;
  throw new Error(`${result?.error || 'Không dán được prompt'}; đã pause để tránh ghi sai tab`);
}

async function executeRelay(sourceOverride, targetOverride) {
  let sourceId = Number(sourceOverride || $('sourceTab').value) || 0;
  let targetId = Number(targetOverride || $('targetTab').value) || 0;
  if (!sourceId || !targetId || sourceId === targetId) {
    log('invalid dropdown, auto-detecting source/target...');
    const picked = await autoPickNewestDirection();
    sourceId = picked.source.tabId;
    targetId = picked.target.tabId;
  }
  const kind = 'comprehensive';
  const mode = $('relayMode').value;
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Không tự dò được nguồn/đích');
  log(`relay preparing: source=${sourceId} target=${targetId} autoSend=${$('autoSendToggle')?.checked ? 'ON' : 'OFF'}`);

  const [{ result: source }] = await chrome.scripting.executeScript({
    target: { tabId: sourceId },
    func: extractLatestResponseInPage,
    args: [mode]
  });
  if (!source?.content) throw new Error(mode === 'selection' ? 'Chưa bôi chọn đoạn nào trong tab nguồn' : 'Không lấy được câu trả lời mới nhất từ tab nguồn');
  log(`relay source read: provider=${source.platform} chars=${source.content.length}`);

  const contentHash = hashText(source.content);
  const key = await relayStateKey(sourceId, targetId, kind, mode);
  const prev = await getRelayState(key);
  if (prev?.contentHash === contentHash) {
    log('no new source response; duplicate paste blocked');
    return { pasted: false, reason: 'duplicate' };
  }

  const stopPhrase = $('stopPhrase')?.value?.trim() || defaultStopPhrase();
  const prompt = buildRelayPrompt(kind, source, $('extraInstruction')?.value || '', stopPhrase, getLang());
  const result = await fillTargetSafely(targetId, prompt);
  let sendResult = null;
  if ($('autoSendToggle')?.checked) {
    sendResult = await executeInAiTab(targetId, clickSendInPage, [], 'target');
    if (!sendResult?.ok) log(`auto-send fail: ${sendResult?.error || 'unknown'}`);
    else log(`auto-send ok selector=${sendResult.selector || '?'}`);
  }

  await setRelayState(key, {
    sourceId,
    targetId,
    kind,
    mode,
    provider: source.platform,
    contentHash,
    relayedAt: new Date().toISOString(),
    preview: source.content.slice(0, 180)
  });
  const hasExtra = ($('extraInstruction')?.value || '').trim() ? ' with extra instruction' : '';
  const sendText = $('autoSendToggle')?.checked ? ` autoSend=${sendResult?.ok ? 'ok' : 'fail'}` : '; manual send required';
  log(`new content pasted hash=${contentHash}${hasExtra} method=${result.method || '?'} selector=${result.selector || '?'}${sendText}`);
  return { pasted: true, contentHash, autoSent: !!sendResult?.ok };
}


function buildFinalMarkdown(source, lang = getLang(), meta = {}) {
  const stamp = new Date().toISOString();
  const stop = $('stopPhrase')?.value || defaultStopPhrase(lang);
  const finalizationMode = meta.finalizationMode || (source.content.includes(stop) ? 'confirmed' : 'draft_forced');
  const stopReason = meta.stopReason || lastStopReason || 'unknown';
  if (lang === 'en') {
    return `# VS Brain Final Unified Report

- Saved: ${stamp}
- Provider: ${source.platform}
- Source title: ${source.title || ''}
- URL: ${source.url || ''}
- Stop phrase: ${stop}
- Final agreement detected: ${source.content.includes(stop) ? 'yes' : 'no'}
- Finalization mode: ${finalizationMode}
- Stop reason: ${stopReason}

## 1. Final conclusion

The debate session reached the latest available final response below. Treat it as the current unified answer unless remaining risks are listed inside the content.

## 2. Unified final answer

${source.content}

## 3. Resolved critique points

Extract from the final answer above: issues marked fixed, accepted, or no longer blocking.

## 4. Remaining assumptions / limits

If the final answer contains assumptions, constraints, or unresolved risks, review them before execution.

## 5. Next actions

Use the final answer as the execution-ready baseline. If implementation is required, convert it into tasks/checklist.

## 6. Audit trail

Generated by VS Brain v0.6.1 from the latest provider response.
`;
  }
  return `# VS Brain - Báo cáo thống nhất cuối

- Lưu lúc: ${stamp}
- Provider: ${source.platform}
- Tiêu đề nguồn: ${source.title || ''}
- URL: ${source.url || ''}
- Cụm chốt: ${stop}
- Đã phát hiện đồng thuận cuối: ${source.content.includes(stop) ? 'có' : 'không'}
- Chế độ chốt: ${finalizationMode}
- Lý do dừng: ${stopReason}

## 1. Kết luận cuối cùng

Phiên phản biện đã lấy phản hồi mới nhất bên dưới làm bản thống nhất hiện tại. Chỉ coi là sẵn sàng thực thi nếu phần nội dung không còn liệt kê rủi ro chặn.

## 2. Bản trả lời thống nhất

${source.content}

## 3. Các điểm phản biện đã được xử lý

Trích từ bản cuối ở trên: các lỗi đã được sửa, các phản biện đã được hấp thụ, hoặc các điểm không còn là blocker.

## 4. Giả định / giới hạn còn lại

Nếu bản cuối còn nêu giả định, ràng buộc, hoặc rủi ro chưa xử lý, cần kiểm tra trước khi triển khai.

## 5. Việc cần làm tiếp theo

Dùng bản thống nhất làm baseline thực thi. Nếu cần triển khai, chuyển thành task/checklist cụ thể.

## 6. Audit trail

Tạo bởi VS Brain v0.6.1 từ phản hồi mới nhất của provider.
`;
}

function buildFinalJson(source, lang = getLang(), meta = {}) {
  const stop = $('stopPhrase')?.value || defaultStopPhrase(lang);
  const finalAgreement = source.content.includes(stop);
  const finalizationMode = meta.finalizationMode || (finalAgreement ? 'confirmed' : 'draft_forced');
  const stopReason = meta.stopReason || lastStopReason || 'unknown';
  return JSON.stringify({
    app: 'VS Brain',
    version: '0.6.4',
    language: lang,
    saved_at: new Date().toISOString(),
    provider: source.platform,
    title: source.title,
    url: source.url,
    stop_phrase: stop,
    final_agreement: finalAgreement,
    finalization_mode: finalizationMode,
    stop_reason: stopReason,
    require_final_confirm: true,
    final_report_schema: 'vs-brain.final_report.v1',
    sections: {
      final_conclusion: lang === 'en' ? 'Latest provider response is saved as current unified answer.' : 'Phản hồi mới nhất được lưu làm bản thống nhất hiện tại.',
      unified_final_answer: source.content,
      resolved_critique_points: [],
      remaining_assumptions_or_limits: [],
      next_actions: []
    },
    raw_final_content: source.content
  }, null, 2);
}

function buildFinalizePrompt(source, lang = getLang()) {
  if (lang === 'en') return `You are the VS Brain final-session secretary. Stop critiquing. Stop debating. Produce the final unified blueprint/report from the agreed content below.

Output must be detailed, structured, execution-ready, and not a short summary.

Required structure:
# Final Unified Blueprint

## 1. Executive conclusion
## 2. Final agreed blueprint / answer
## 3. Key decisions
| Decision | Rationale | Impact |
## 4. Resolved critiques
| Issue | How it was resolved | Evidence from final answer |
## 5. Remaining assumptions / limits
| Assumption or limit | Risk | Mitigation |
## 6. Implementation checklist / next actions
| Step | Owner/User action | Expected result |
## 7. Confidence score
## 8. Final notes

Do not include debate history. Do not ask questions. If information is missing, list it as an assumption/limit.

AGREED FINAL RESPONSE:
${source.content}`;
  return `Bạn là thư ký chốt phiên VS Brain. Dừng phản biện. Dừng tranh luận. Hãy tạo BẢN BLUEPRINT / BÁO CÁO THỐNG NHẤT CUỐI từ nội dung đã đồng thuận bên dưới.

Output phải chi tiết, có cấu trúc, đủ để người dùng lưu lại và thực thi. Không viết tóm tắt ngắn.

Cấu trúc bắt buộc:
# Blueprint thống nhất cuối

## 1. Kết luận điều hành
## 2. Bản thống nhất / câu trả lời cuối cùng
## 3. Các quyết định chính
| Quyết định | Lý do | Tác động |
## 4. Các phản biện đã được xử lý
| Vấn đề | Cách đã xử lý | Bằng chứng trong bản cuối |
## 5. Giả định / giới hạn còn lại
| Giả định hoặc giới hạn | Rủi ro | Cách giảm thiểu |
## 6. Checklist triển khai / việc cần làm tiếp theo
| Bước | Hành động của người dùng | Kết quả kỳ vọng |
## 7. Điểm tin cậy
## 8. Ghi chú cuối

Không lặp lịch sử tranh luận. Không hỏi lại. Nếu thiếu thông tin, đưa vào mục giả định/giới hạn.

PHẢN HỒI CUỐI ĐÃ ĐỒNG THUẬN:
${source.content}`;
}

async function finalizeAndSave() {
  ensureStopPhraseForLang();
  let tabId = Number($('sourceTab').value) || 0;
  if (!tabId) {
    const picked = await autoPickNewestDirection();
    tabId = picked.source.tabId;
  }
  const oldHash = await getLatestContentHash(tabId);
  const [{ result: source }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractLatestResponseInPage, args: ['latest'] });
  if (!source?.content) throw new Error('Không lấy được phản hồi cuối để tạo prompt chốt');

  const stop = $('stopPhrase')?.value || defaultStopPhrase(getLang());
  const hasFinalAgreement = source.content.includes(stop);
  const stopReason = lastStopReason || 'unknown';
  let finalizationMode = 'confirmed';
  if (!hasFinalAgreement) {
    const msg = getLang() === 'en'
      ? `No final agreement phrase found. Stop reason: ${stopReason}. Create a DRAFT blueprint anyway?`
      : `Chưa có cụm đồng thuận cuối. Lý do dừng: ${stopReason}. Vẫn tạo DRAFT blueprint?`;
    if (!window.confirm(msg)) {
      log('finalize canceled: missing final agreement');
      return;
    }
    finalizationMode = 'draft_forced';
    log(`draft_forced finalize: missing final agreement; stop_reason=${stopReason}`);
  }

  const prompt = buildFinalizePrompt(source, getLang());
  await chrome.tabs.update(tabId, { active: true });
  await new Promise((r) => setTimeout(r, getActionDelayMs()));
  const [{ result: fill }] = await chrome.scripting.executeScript({ target: { tabId }, func: fillPromptInPage, args: [prompt] });
  if (!fill?.ok) throw new Error(fill?.error || 'Không dán được prompt chốt');
  const [{ result: sent }] = await chrome.scripting.executeScript({ target: { tabId }, func: clickSendInPage });
  if (!sent?.ok) throw new Error(sent?.error || 'Không bấm gửi được prompt chốt');

  log('finalize prompt sent; waiting final blueprint...');
  const waited = await waitForTabNewResponse(tabId, oldHash, 180000, 2000);
  if (!waited.changed && !waited.stop) throw new Error(`timeout chờ blueprint cuối: ${waited.reason}`);

  const [{ result: finalSource }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractLatestResponseInPage, args: ['latest'] });
  if (!finalSource?.content) throw new Error('Không lấy được blueprint cuối để lưu');
  const base = `vs-brain/final-blueprint-${safeName(finalSource.platform)}-${Date.now()}`;
  const finalMeta = { finalizationMode, stopReason };
  await downloadText(`${base}.md`, buildFinalMarkdown(finalSource, getLang(), finalMeta), 'text/markdown');
  await downloadText(`${base}.json`, buildFinalJson(finalSource, getLang(), finalMeta), 'application/json');
  await downloadText(`${base}-prompt.md`, prompt, 'text/markdown');
  log(`final blueprint created and saved provider=${finalSource.platform} chars=${finalSource.content.length}`);
}

$('langMode')?.addEventListener('change', () => {
  ensureStopPhraseForLang();
  applyUiLang();
  if ($('promptTemplate')) { $('promptTemplate').value = ''; $('promptTemplate').placeholder = defaultPromptTemplate(getLang(), $('stopPhrase')?.value || defaultStopPhrase()); }
  log(`prompt language changed: ${getLang().toUpperCase()}`);
});


function initPromptTemplate() {
  if ($('promptTemplate')) {
    $('promptTemplate').value = '';
    $('promptTemplate').placeholder = defaultPromptTemplate(getLang(), $('stopPhrase')?.value || defaultStopPhrase());
  }
}

$('resetPromptBtn')?.addEventListener('click', () => {
  initPromptTemplate();
  log('default prompt reset');
});

$('finalizeBtn')?.classList.remove('glow-save');
$('finalizeBtn')?.addEventListener('click', async () => {
  try { await finalizeAndSave(); } catch (e) { log(e.message); }
});

$('handoffBtn')?.addEventListener('click', async () => {
  try { await createContextHandoff('manual_context_handoff'); } catch (e) { log(e.message); }
});


function buildHelpText() {
  if (getLang() === 'en') return `# VS Brain Full Guide\n\n1. Open 2 AI tabs, e.g. ChatGPT and Gemini.\n2. Click Scan tabs. Source/Target can stay Auto.\n3. Optional: add extra instruction.\n4. Click Paste critique to do one assisted relay.\n5. For automatic debate: enable Auto-send, set Steps, click Auto A↔B.\n6. The loop stops when the latest response contains the stop phrase: VS_BRAIN_FULL_AGREEMENT, or when max steps is reached.\n7. Click Finalize & Save to export MD + JSON.\n8. If something breaks, open Log/debug and export log.\n\nModes:\n- Latest: send only latest assistant reply.\n- Selection: send selected text only.\n\nSafety:\nAuto-send is optional. Stop phrase is only accepted in the latest response.`;
  return `# Hướng dẫn đầy đủ VS Brain\n\n1. Mở 2 tab AI, ví dụ ChatGPT và Gemini.\n2. Bấm Quét tab. Nguồn/Đích có thể để Auto.\n3. Nếu cần, nhập Yêu cầu bổ sung.\n4. Bấm Dán phản biện để chạy 1 lượt hỗ trợ.\n5. Muốn tự động: bật Auto-send, đặt Steps, bấm Auto A↔B.\n6. Vòng lặp dừng khi phản hồi mới nhất có cụm chốt: CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN, hoặc đạt số bước tối đa.\n7. Bấm Chốt & lưu để xuất MD + JSON.\n8. Nếu lỗi, mở Log/debug và Xuất log.\n\nChế độ:\n- Latest: chỉ gửi phản hồi mới nhất.\n- Selection: chỉ gửi đoạn đang bôi chọn.\n\nAn toàn:\nAuto-send là tuỳ chọn. Cụm chốt chỉ được kiểm tra trong phản hồi mới nhất.`;
}


function renderHelpModal() {
  const en = getLang() === 'en';
  $('helpContent').innerHTML = en ? `
    <h3>What VS Brain does</h3>
    <p>VS Brain connects open AI tabs and relays only the latest answer for structured critique, revision, agreement detection, and final export.</p>
    <h3>Quick start</h3>
    <ol>
      <li>Open two AI tabs, e.g. ChatGPT and Gemini.</li>
      <li>Click <b>Scan tabs</b>. Source/Target may stay <b>Auto</b>.</li>
      <li>Add optional extra instruction.</li>
      <li>Click <b>Paste critique →</b> for one manual relay.</li>
      <li>Enable <b>Auto-send</b> and click <b>Auto A↔B</b> for automatic debate.</li>
    </ol>
    <h3>Main controls</h3>
    <ul>
      <li><b>Auto source/target</b>: app detects the latest unreplayed answer.</li>
      <li><b>Latest</b>: sends only latest assistant reply.</li>
      <li><b>Selection</b>: sends only selected text.</li>
      <li><b>Steps</b>: maximum loop count.</li>
      <li><b>Delay</b>: wait time between loop attempts.</li>
      <li><b>Finalize & Save</b>: exports final MD + JSON.</li>
    </ul>
    <h3>Stop condition</h3>
    <p>The loop stops when the latest response contains <code>VS_BRAIN_FULL_AGREEMENT</code> or max steps is reached.</p>
    <h3>Troubleshooting</h3>
    <p>If auto-send or paste fails, open <b>Log/debug</b> and export the log.</p>
    <h3>About VS Brain</h3>
    <p><b>VS Brain</b> is a product initiated, directed, and owned by <b>Adam Wang</b>. It was created from the practical need for a system that can coordinate multiple AIs through a structured process of critique, refinement, and convergence toward an output that is clear, usable, and suitable for real execution.</p>
    <p>In that process, <b>Phuong COO</b> — an <b>evolved Agent entity</b> operating within the <b>Evo-Core</b> system — has served as a direct force in developing the product, shaping its operating logic, challenging its architecture, and progressively refining VS Brain under the original direction and initiating requirements of <b>Adam Wang</b>.</p>
    <p>The philosophy behind VS Brain goes beyond simply “asking AI for answers.” It is designed to support a higher-order workflow: <b>from initial idea → multi-angle critique → distilled blueprint/spec/execution packet ready for implementation.</b></p>
    <p>This version may be shared as an early trial build for practical user feedback while the product continues to evolve.<br><b>VS Brain is proprietary software owned by Adam Wang. All rights reserved.</b></p>
  ` : `
    <h3>VS Brain làm gì?</h3>
    <p>VS Brain kết nối các tab AI đang mở, chỉ lấy phản hồi mới nhất để dán sang provider khác cho phản biện có cấu trúc, tự dừng khi đồng thuận, và lưu bản cuối.</p>
    <h3>Bắt đầu nhanh</h3>
    <ol>
      <li>Mở hai tab AI, ví dụ ChatGPT và Gemini.</li>
      <li>Bấm <b>Quét tab</b>. Nguồn/Đích có thể để <b>Auto</b>.</li>
      <li>Nhập <b>Yêu cầu bổ sung</b> nếu cần.</li>
      <li>Bấm <b>Dán phản biện →</b> để chạy một lượt.</li>
      <li>Bật <b>Auto-send</b> rồi bấm <b>Auto A↔B</b> để chạy tự động.</li>
    </ol>
    <h3>Ý nghĩa nút chính</h3>
    <ul>
      <li><b>Auto nguồn/đích</b>: app tự dò tab có phản hồi mới nhất chưa chuyển.</li>
      <li><b>Latest</b>: chỉ gửi phản hồi assistant mới nhất.</li>
      <li><b>Selection</b>: chỉ gửi đoạn đang bôi chọn.</li>
      <li><b>Steps</b>: số bước tối đa trước khi dừng.</li>
      <li><b>Delay</b>: thời gian chờ giữa các bước.</li>
      <li><b>Chốt & lưu</b>: xuất file MD + JSON của bản cuối.</li>
    </ul>
    <h3>Điều kiện dừng</h3>
    <p>Auto-loop dừng khi phản hồi mới nhất có <code>CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN</code> hoặc đạt Steps tối đa.</p>
    <h3>Khi lỗi</h3>
    <p>Mở <b>Log/debug</b> và bấm <b>Xuất log</b> gửi lại để kiểm tra selector/paste/send.</p>
    <h3>Về VS Brain</h3>
    <p><b>VS Brain</b> là sản phẩm được <b>Adam Wang</b> khởi tạo, định hướng và sở hữu. Ứng dụng ra đời từ nhu cầu xây dựng một hệ thống có thể phối hợp nhiều AI theo quy trình phản biện, chắt lọc và hội tụ dần về một kết quả có cấu trúc, rõ ràng và đủ hữu dụng cho triển khai thực tế.</p>
    <p>Trong quá trình đó, <b>Phương COO</b> — một <b>tác nhân Agent tiến hóa</b> thuộc hệ điều hành <b>Evo-Core</b> — là lực lượng trực tiếp đồng hành trong việc phát triển sản phẩm, tổ chức logic vận hành, phản biện kiến trúc và từng bước hoàn thiện VS Brain theo yêu cầu và định hướng khởi tạo từ <b>Adam Wang</b>.</p>
    <p>Triết lý của VS Brain không dừng ở việc “hỏi AI để lấy câu trả lời”, mà hướng tới một quy trình cao hơn: <b>từ ý tưởng ban đầu → phản biện đa chiều → kết tinh thành blueprint/spec/execution packet có thể triển khai.</b></p>
    <p>Phiên bản này có thể được chia sẻ như một bản dùng thử sớm nhằm tiếp nhận phản hồi thực tế từ người dùng trong quá trình tiếp tục hoàn thiện sản phẩm.<br><b>VS Brain is proprietary software owned by Adam Wang. All rights reserved.</b></p>
  `;
}

$('helpBtn')?.addEventListener('click', () => {
  renderHelpModal();
  $('helpModal')?.classList.remove('hidden');
});

$('closeHelpBtn')?.addEventListener('click', () => $('helpModal')?.classList.add('hidden'));
$('helpModal')?.addEventListener('click', (e) => { if (e.target?.id === 'helpModal') $('helpModal')?.classList.add('hidden'); });

$('stepsSlider')?.addEventListener('input', syncSliderStep);
$('loopMaxSteps')?.addEventListener('change', () => setRoundLimit($('loopMaxSteps').value, 'input'));
$('roundDecBtn')?.addEventListener('click', () => setRoundLimit((Number($('loopMaxSteps')?.value || 100) - 10), '-10'));
$('roundIncBtn')?.addEventListener('click', () => setRoundLimit((Number($('loopMaxSteps')?.value || 100) + 10), '+10'));
qsa('.round-preset').forEach((btn) => btn.addEventListener('click', () => setRoundLimit(btn.dataset.round, 'preset')));

$('refreshTabsBtn')?.addEventListener('click', async () => {
  try { await refreshTabs(); } catch (e) { log(e.message); }
});

$('relayBtn')?.addEventListener('click', async () => {
  try { await executeRelay(); } catch (e) { log(e.message); }
});

$('autoPickBtn')?.addEventListener('click', async () => {
  try { await autoPickNewestDirection(); } catch (e) { log(e.message); }
});

$('swapTabsBtn')?.addEventListener('click', () => {
  const source = $('sourceTab').value;
  const target = $('targetTab').value;
  if (!source || !target || source === target) return log('cannot swap: invalid source/target');
  $('sourceTab').value = target;
  $('targetTab').value = source;
  log('swapped source ↔ target');
});

$('resetRelayBtn')?.addEventListener('click', async () => {
  try {
    const n = await clearRelayStates();
    log(`cleared ${n} relay states`);
  } catch (e) { log(e.message); }
});


let loopTimer = null;
let loopState = null;
let lastStopReason = 'not_started';

function updateRunButtonState(running) {
  const t = I18N[getLang()] || I18N.vi;
  if ($('oneClickStartBtn')) {
    $('oneClickStartBtn').textContent = running ? t.running : t.startAuto;
    $('oneClickStartBtn').disabled = !!running;
    $('oneClickStartBtn').classList.toggle('running', !!running);
    $('loopCounter')?.closest('.loop-counter')?.classList.toggle('running', !!running);
  }
}

function setLoopRunning(running) {
  $('startLoopBtn').disabled = running || aiTabs.length < 2;
  $('stopLoopBtn').disabled = !running;
  updateRunButtonState(running);
}

function updateLoopCounter(step = 0, max = Number($('loopMaxSteps')?.value || 100)) {
  if ($('loopCounter')) $('loopCounter').textContent = `${step}/${max}`;
}


let timerInterval = null;
let elapsedSeconds = 0;

function startTimer() {
  elapsedSeconds = 0;
  updateTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => { elapsedSeconds++; updateTimer(); }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimer() {
  const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const s = String(elapsedSeconds % 60).padStart(2, '0');
  if ($('elapsedTimer')) $('elapsedTimer').textContent = `${m}:${s}`;
}

function stopLoop(reason = 'stopped') {
  lastStopReason = reason;
  if (loopTimer) clearTimeout(loopTimer);
  const lastMax = loopState?.maxSteps || Number($('loopMaxSteps')?.value || 100);
  const lastStep = loopState?.step || 0;
  loopTimer = null;
  loopState = null;
  setLoopRunning(false);
  updateLoopCounter(lastStep, lastMax);
  stopTimer();
  $('finalizeBtn')?.classList.add('glow-save');
  log(`auto-loop stopped: ${reason}`);
}


async function getLatestContentHash(tabId) {
  const latest = await getLatestHashForTab(tabId);
  return latest?.contentHash || null;
}

async function waitForTabNewResponse(tabId, oldHash, timeoutMs, intervalMs = 1500) {
  const started = Date.now();
  while (loopState && Date.now() - started < timeoutMs) {
    const stopPhrase = $('stopPhrase')?.value?.trim() || defaultStopPhrase();
    try {
      const hasStop = await executeInAiTab(tabId, latestResponseContainsStopPhrase, [stopPhrase], 'loop-tab');
      if (hasStop) return { stop: true, reason: `gặp cụm từ chốt trong phản hồi mới nhất: ${stopPhrase}` };
    } catch (_) {}
    const h = await getLatestContentHash(tabId);
    if (h && h !== oldHash) return { changed: true, contentHash: h };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { changed: false, reason: 'timeout chờ phản hồi mới' };
}

async function loopStep() {
  if (!loopState) return;
  try { await autoHandoffIfNeeded(); } catch (e) { return stopLoop(`auto_handoff_failed: ${e.message}`); }
  if (!loopState) return;
  const stopPhrase = $('stopPhrase')?.value?.trim() || defaultStopPhrase();
  for (const tabId of [loopState.a, loopState.b]) {
    try {
      const hasStop = await executeInAiTab(tabId, latestResponseContainsStopPhrase, [stopPhrase], 'loop-tab');
      if (hasStop) return stopLoop(`gặp cụm từ chốt trong phản hồi mới nhất: ${stopPhrase}`);
    } catch (_) {}
  }
  if (loopState.step >= loopState.maxSteps) return stopLoop('đạt số bước tối đa');

  const sourceId = loopState.currentSource;
  const targetId = loopState.currentTarget;
  const targetOldHash = await getLatestContentHash(targetId);

  loopState.step += 1;
  updateLoopCounter(loopState.step, loopState.maxSteps);
  log(`auto-loop step ${loopState.step}/${loopState.maxSteps}: ${sourceId} → ${targetId}`);
  let relayResult = null;
  try {
    relayResult = await executeRelay(sourceId, targetId);
  } catch (e) {
    return stopLoop(`needs_attention: ${e.message}`);
  }

  // Sau khi dán/gửi sang target, target phải trở thành source cho bước kế tiếp.
  loopState.currentSource = targetId;
  loopState.currentTarget = sourceId;
  $('sourceTab').value = String(loopState.currentSource);
  $('targetTab').value = String(loopState.currentTarget);

  if ($('autoSendToggle')?.checked && relayResult?.autoSent) {
    log(`waiting tab ${targetId} new response...`);
    const waited = await waitForTabNewResponse(targetId, targetOldHash, loopState.waitMs);
    if (waited.stop) return stopLoop(waited.reason);
    if (!waited.changed) {
      log(`no new response from tab ${targetId}: ${waited.reason}; will try next step after delay`);
    } else {
      log(`new response detected tab ${targetId} hash=${waited.contentHash}`);
      const q = await checkLatestQuality(targetId);
      if (!q.ok) return stopLoop(q.reason);
    }
  }

  loopTimer = setTimeout(loopStep, loopState.delayMs);
}



function setRoundLimit(raw, reason = 'manual') {
  const slider = $('stepsSlider');
  const input = $('loopMaxSteps');
  const display = $('sliderValue');
  const current = Number($('loopCounter')?.textContent?.split('/')[0] || 0);
  let val = Math.max(1, Math.min(1000, Number(raw) || 1));
  if (loopState && val < current) {
    val = loopState.maxSteps;
    log(`cannot reduce below current round: ${current}`);
  }
  if (input) input.value = String(val);
  if (slider) slider.value = String(Math.round(val / 10) * 10 || 1);
  if (display) display.textContent = String(val);
  if (loopState) loopState.maxSteps = val;
  if ($('loopCounter')) $('loopCounter').textContent = `${current}/${val}`;
  qsa('.round-preset').forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.round) === val));
  if (reason !== 'slider') log(`round limit set=${val} (${reason})`);
}

function syncSliderStep() {
  setRoundLimit(Number($('stepsSlider')?.value || 100), 'slider');
}
$('oneClickStartBtn')?.addEventListener('click', async () => {
  try {
    await refreshTabs();
    $('sourceTab').value = 'auto';
    $('targetTab').value = 'auto';
    $('relayMode').value = 'latest';
    $('autoSendToggle').checked = true;
    $('loopMaxSteps').value = '100';
    if ($('stepsSlider')) $('stepsSlider').value = '100';
    syncSliderStep();
    syncGlassSelectLabels();
    $('startLoopBtn').click();
  } catch (e) { log(e.message); }
});

$('startLoopBtn')?.addEventListener('click', async () => {
  try {
    let a = Number($('sourceTab').value) || 0;
    let b = Number($('targetTab').value) || 0;
    if (!a || !b || a === b) {
      log('invalid dropdown, auto-detecting source/target...');
      const picked = await autoPickNewestDirection();
      a = picked.source.tabId;
      b = picked.target.tabId;
    }
    if (!a || !b || a === b) throw new Error('Không tự dò được nguồn/đích');
    lastStopReason = 'running';
    loopState = {
      a,
      b,
      currentSource: a,
      currentTarget: b,
      step: 0,
      maxSteps: Math.max(1, Math.min(1000, Number($('loopMaxSteps').value || 100))),
      delayMs: Math.max(3, Math.min(120, Number($('loopDelaySec').value || 12))) * 1000,
      waitMs: Math.max(15, Math.min(300, Number($('loopDelaySec').value || 12) * 5)) * 1000
    };
    setLoopRunning(true);
    updateLoopCounter(0, loopState.maxSteps);
    startTimer();
    $('finalizeBtn')?.classList.remove('glow-save');
    log(`auto-loop started: max=${loopState.maxSteps}, delay=${loopState.delayMs / 1000}s. autoSend=${$('autoSendToggle')?.checked ? 'ON' : 'OFF'}`);
    await loopStep();
  } catch (e) { log(e.message); }
});

$('stopLoopBtn')?.addEventListener('click', () => stopLoop('Sếp bấm dừng'));


$('exportLogBtn')?.addEventListener('click', async () => {
  try {
    const text = [
      `VS Brain debug log`,
      `version: v0.2.2`,
      `time: ${new Date().toISOString()}`,
      '',
      ...debugLines.map((x) => x.line)
    ].join('\n');
    await downloadText(`vs-brain/debug-log-${Date.now()}.txt`, text, 'text/plain');
    log('debug log exported');
  } catch (e) { log(e.message); }
});



initGlassSelects();
applyUiLang();
updateLoopCounter();
initPromptTemplate();
refreshTabs().catch(() => {});
