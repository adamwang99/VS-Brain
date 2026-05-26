let currentScan = null;

const $ = (id) => document.getElementById(id);
const debugLines = [];
const log = (msg) => {
  const line = `${new Date().toLocaleTimeString()} ${msg}`;
  debugLines.unshift(line);
  if (debugLines.length > 300) debugLines.pop();
  $('log').textContent = debugLines.join('\n');
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
  log(`quét provider=${currentScan.platform} thấy=${currentScan.messages.length} mới=${newMessages.length} checkpoint=${cp?.lastSeenMessageKey ? 'có' : 'chưa'}`);
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
    log(`đã xuất JSONL: ${messages.length} tin`);
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
    log(`đã xuất Markdown: ${messages.length} tin`);
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
    log(`đã xuất lại toàn bộ JSONL: ${messages.length} tin`);
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
    log(`đã xuất lại toàn bộ Markdown: ${messages.length} tin`);
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
    log('đã xóa mốc đã lưu');
    await scan();
  } catch (e) { log(e.message); }
});

$('checkpointBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    await setCheckpoint(currentScan, currentScan.messages);
    log('đã đánh dấu mốc');
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
      log(`fallback chọn mặc định: nguồn=${aiTabs[0].provider} → đích=${fallbackTarget.provider}`);
    }
  }
  syncGlassSelectLabels();
  log(`đã quét tab AI: ${aiTabs.length}`);
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
  log(`tự chọn: nguồn=${source.provider} hash=${source.contentHash}${fresh.length ? ' mới' : ' đã relay trước'} → đích=${target.provider}`);
  return { source, target };
}


function getActionDelayMs() {
  return Math.max(300, Math.min(10000, Number($('actionDelayMs')?.value || 1200)));
}

async function executeRelay(sourceOverride, targetOverride) {
  let sourceId = Number(sourceOverride || $('sourceTab').value) || 0;
  let targetId = Number(targetOverride || $('targetTab').value) || 0;
  if (!sourceId || !targetId || sourceId === targetId) {
    log('dropdown chưa hợp lệ, tự dò tìm nguồn/đích...');
    const picked = await autoPickNewestDirection();
    sourceId = picked.source.tabId;
    targetId = picked.target.tabId;
  }
  const kind = 'comprehensive';
  const mode = $('relayMode').value;
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Không tự dò được nguồn/đích');
  log(`relay chuẩn bị: source=${sourceId} target=${targetId} autoSend=${$('autoSendToggle')?.checked ? 'ON' : 'OFF'}`);

  const [{ result: source }] = await chrome.scripting.executeScript({
    target: { tabId: sourceId },
    func: extractLatestResponseInPage,
    args: [mode]
  });
  if (!source?.content) throw new Error(mode === 'selection' ? 'Chưa bôi chọn đoạn nào trong tab nguồn' : 'Không lấy được câu trả lời mới nhất từ tab nguồn');
  log(`relay nguồn đọc được: provider=${source.platform} chars=${source.content.length}`);

  const contentHash = hashText(source.content);
  const key = await relayStateKey(sourceId, targetId, kind, mode);
  const prev = await getRelayState(key);
  if (prev?.contentHash === contentHash) {
    log('chưa có phản hồi mới từ tab nguồn; đã chặn dán trùng');
    return { pasted: false, reason: 'duplicate' };
  }

  const stopPhrase = $('stopPhrase')?.value?.trim() || defaultStopPhrase();
  const prompt = buildRelayPrompt(kind, source, $('extraInstruction')?.value || '', stopPhrase, getLang());
  await chrome.tabs.update(targetId, { active: true });
  await new Promise((r) => setTimeout(r, getActionDelayMs()));
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: targetId }, func: fillPromptInPage, args: [prompt] });
  if (!result?.ok) throw new Error(result?.error || 'Không dán được prompt');
  let sendResult = null;
  if ($('autoSendToggle')?.checked) {
    const [{ result: sr }] = await chrome.scripting.executeScript({ target: { tabId: targetId }, func: clickSendInPage });
    sendResult = sr;
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
  const hasExtra = ($('extraInstruction')?.value || '').trim() ? ' có yêu cầu bổ sung' : '';
  const sendText = $('autoSendToggle')?.checked ? ` autoSend=${sendResult?.ok ? 'ok' : 'fail'}` : '; Sếp bấm gửi thủ công';
  log(`đã dán nội dung mới hash=${contentHash}${hasExtra} method=${result.method || '?'} selector=${result.selector || '?'}${sendText}`);
  return { pasted: true, contentHash, autoSent: !!sendResult?.ok };
}


function buildFinalMarkdown(source, lang = getLang()) {
  const stamp = new Date().toISOString();
  const stop = $('stopPhrase')?.value || defaultStopPhrase(lang);
  if (lang === 'en') {
    return `# VS Brain Final Unified Report

- Saved: ${stamp}
- Provider: ${source.platform}
- Source title: ${source.title || ''}
- URL: ${source.url || ''}
- Stop phrase: ${stop}
- Final agreement detected: ${source.content.includes(stop) ? 'yes' : 'no'}

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

function buildFinalJson(source, lang = getLang()) {
  const stop = $('stopPhrase')?.value || defaultStopPhrase(lang);
  return JSON.stringify({
    app: 'VS Brain',
    version: '0.6.4',
    language: lang,
    saved_at: new Date().toISOString(),
    provider: source.platform,
    title: source.title,
    url: source.url,
    stop_phrase: stop,
    final_agreement: source.content.includes(stop),
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

  const prompt = buildFinalizePrompt(source, getLang());
  await chrome.tabs.update(tabId, { active: true });
  await new Promise((r) => setTimeout(r, getActionDelayMs()));
  const [{ result: fill }] = await chrome.scripting.executeScript({ target: { tabId }, func: fillPromptInPage, args: [prompt] });
  if (!fill?.ok) throw new Error(fill?.error || 'Không dán được prompt chốt');
  const [{ result: sent }] = await chrome.scripting.executeScript({ target: { tabId }, func: clickSendInPage });
  if (!sent?.ok) throw new Error(sent?.error || 'Không bấm gửi được prompt chốt');

  log('đã gửi prompt chốt, đang chờ blueprint cuối...');
  const waited = await waitForTabNewResponse(tabId, oldHash, 180000, 2000);
  if (!waited.changed && !waited.stop) throw new Error(`timeout chờ blueprint cuối: ${waited.reason}`);

  const [{ result: finalSource }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractLatestResponseInPage, args: ['latest'] });
  if (!finalSource?.content) throw new Error('Không lấy được blueprint cuối để lưu');
  const base = `vs-brain/final-blueprint-${safeName(finalSource.platform)}-${Date.now()}`;
  await downloadText(`${base}.md`, buildFinalMarkdown(finalSource, getLang()), 'text/markdown');
  await downloadText(`${base}.json`, buildFinalJson(finalSource, getLang()), 'application/json');
  await downloadText(`${base}-prompt.md`, prompt, 'text/markdown');
  log(`đã tạo blueprint cuối & lưu provider=${finalSource.platform} chars=${finalSource.content.length}`);
}

$('langMode')?.addEventListener('change', () => {
  ensureStopPhraseForLang();
  applyUiLang();
  if ($('promptTemplate')) { $('promptTemplate').value = ''; $('promptTemplate').placeholder = defaultPromptTemplate(getLang(), $('stopPhrase')?.value || defaultStopPhrase()); }
  log(`đổi ngôn ngữ prompt: ${getLang().toUpperCase()}`);
});


function initPromptTemplate() {
  if ($('promptTemplate')) {
    $('promptTemplate').value = '';
    $('promptTemplate').placeholder = defaultPromptTemplate(getLang(), $('stopPhrase')?.value || defaultStopPhrase());
  }
}

$('resetPromptBtn')?.addEventListener('click', () => {
  initPromptTemplate();
  log('đã reset prompt mặc định');
});

$('finalizeBtn')?.classList.remove('glow-save');
$('finalizeBtn')?.addEventListener('click', async () => {
  try { await finalizeAndSave(); } catch (e) { log(e.message); }
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
  `;
}

$('helpBtn')?.addEventListener('click', () => {
  renderHelpModal();
  $('helpModal')?.classList.remove('hidden');
});

$('closeHelpBtn')?.addEventListener('click', () => $('helpModal')?.classList.add('hidden'));
$('helpModal')?.addEventListener('click', (e) => { if (e.target?.id === 'helpModal') $('helpModal')?.classList.add('hidden'); });

$('stepsSlider')?.addEventListener('input', syncSliderStep);
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
  if (!source || !target || source === target) return log('không thể đổi: nguồn/đích chưa hợp lệ');
  $('sourceTab').value = target;
  $('targetTab').value = source;
  log('đã đổi nguồn ↔ đích');
});

$('resetRelayBtn')?.addEventListener('click', async () => {
  try {
    const n = await clearRelayStates();
    log(`đã xóa ${n} mốc relay`);
  } catch (e) { log(e.message); }
});


let loopTimer = null;
let loopState = null;

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
  if (loopTimer) clearTimeout(loopTimer);
  const lastMax = loopState?.maxSteps || Number($('loopMaxSteps')?.value || 100);
  const lastStep = loopState?.step || 0;
  loopTimer = null;
  loopState = null;
  setLoopRunning(false);
  updateLoopCounter(lastStep, lastMax);
  stopTimer();
  $('finalizeBtn')?.classList.add('glow-save');
  log(`auto-loop dừng: ${reason}`);
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
      const [{ result: hasStop }] = await chrome.scripting.executeScript({ target: { tabId }, func: latestResponseContainsStopPhrase, args: [stopPhrase] });
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
  const stopPhrase = $('stopPhrase')?.value?.trim() || defaultStopPhrase();
  for (const tabId of [loopState.a, loopState.b]) {
    try {
      const [{ result: hasStop }] = await chrome.scripting.executeScript({ target: { tabId }, func: latestResponseContainsStopPhrase, args: [stopPhrase] });
      if (hasStop) return stopLoop(`gặp cụm từ chốt trong phản hồi mới nhất: ${stopPhrase}`);
    } catch (_) {}
  }
  if (loopState.step >= loopState.maxSteps) return stopLoop('đạt số bước tối đa');

  const sourceId = loopState.currentSource;
  const targetId = loopState.currentTarget;
  const targetOldHash = await getLatestContentHash(targetId);

  loopState.step += 1;
  updateLoopCounter(loopState.step, loopState.maxSteps);
  log(`auto-loop bước ${loopState.step}/${loopState.maxSteps}: ${sourceId} → ${targetId}`);
  let relayResult = null;
  try {
    relayResult = await executeRelay(sourceId, targetId);
  } catch (e) {
    log(`auto-loop lỗi: ${e.message}`);
  }

  // Sau khi dán/gửi sang target, target phải trở thành source cho bước kế tiếp.
  loopState.currentSource = targetId;
  loopState.currentTarget = sourceId;
  $('sourceTab').value = String(loopState.currentSource);
  $('targetTab').value = String(loopState.currentTarget);

  if ($('autoSendToggle')?.checked && relayResult?.autoSent) {
    log(`đang chờ tab ${targetId} trả lời mới...`);
    const waited = await waitForTabNewResponse(targetId, targetOldHash, loopState.waitMs);
    if (waited.stop) return stopLoop(waited.reason);
    if (!waited.changed) {
      log(`chưa có phản hồi mới từ tab ${targetId}: ${waited.reason}; vẫn thử bước kế sau delay`);
    } else {
      log(`đã thấy phản hồi mới từ tab ${targetId} hash=${waited.contentHash}`);
    }
  }

  loopTimer = setTimeout(loopStep, loopState.delayMs);
}



function syncSliderStep() {
  const slider = $('stepsSlider');
  const input = $('loopMaxSteps');
  const display = $('sliderValue');
  if (!slider || !input) return;
  const val = Number(slider.value) || 1;
  const current = Number($('loopCounter')?.textContent?.split('/')[0] || 0);
  // block reduce if loop is running
  if (loopState && val < current) {
    slider.value = String(loopState.maxSteps);
    if (display) display.textContent = String(loopState.maxSteps);
    input.value = String(loopState.maxSteps);
    if ($('loopCounter')) $('loopCounter').textContent = `${current}/${loopState.maxSteps}`;
    log(`không thể kéo xuống dưới số vòng đang chạy: ${current}`);
    return;
  }
  input.value = String(val);
  if (display) display.textContent = String(val);
  if (loopState) loopState.maxSteps = val;
  if ($('loopCounter')) $('loopCounter').textContent = `${current}/${val}`;
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
      log('dropdown chưa hợp lệ, tự dò tìm nguồn/đích...');
      const picked = await autoPickNewestDirection();
      a = picked.source.tabId;
      b = picked.target.tabId;
    }
    if (!a || !b || a === b) throw new Error('Không tự dò được nguồn/đích');
    loopState = {
      a,
      b,
      currentSource: a,
      currentTarget: b,
      step: 0,
      maxSteps: Math.max(1, Math.min(100, Number($('loopMaxSteps').value || 100))),
      delayMs: Math.max(3, Math.min(120, Number($('loopDelaySec').value || 12))) * 1000,
      waitMs: Math.max(15, Math.min(300, Number($('loopDelaySec').value || 12) * 5)) * 1000
    };
    setLoopRunning(true);
    updateLoopCounter(0, loopState.maxSteps);
    startTimer();
    $('finalizeBtn')?.classList.remove('glow-save');
    log(`auto-loop bắt đầu: max=${loopState.maxSteps}, delay=${loopState.delayMs / 1000}s. autoSend=${$('autoSendToggle')?.checked ? 'ON' : 'OFF'}`);
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
      ...debugLines
    ].join('\n');
    await downloadText(`vs-brain/debug-log-${Date.now()}.txt`, text, 'text/plain');
    log('đã xuất log debug');
  } catch (e) { log(e.message); }
});



initGlassSelects();
applyUiLang();
updateLoopCounter();
initPromptTemplate();
refreshTabs().catch(() => {});
