let currentScan = null;

const $ = (id) => document.getElementById(id);
const log = (msg) => { $('log').textContent = `${new Date().toLocaleTimeString()} ${msg}\n` + $('log').textContent; };
const setStatus = (msg) => { $('status').textContent = msg; };

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
    const filename = `crosscritic/${currentScan.platform}/${safeName(currentScan.title)}-${Date.now()}.jsonl`;
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
    const filename = `crosscritic/${currentScan.platform}/${safeName(currentScan.title)}-${Date.now()}.md`;
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
    const filename = `crosscritic/${currentScan.platform}/${safeName(currentScan.title)}-FULL-${Date.now()}.jsonl`;
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
    const filename = `crosscritic/${currentScan.platform}/${safeName(currentScan.title)}-FULL-${Date.now()}.md`;
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
  $('sourceTab').innerHTML = html || '<option value="">Không thấy tab AI</option>';
  $('targetTab').innerHTML = html || '<option value="">Không thấy tab AI</option>';
  $('relayBtn').disabled = aiTabs.length < 2;
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

function fillPromptInPage(prompt) {
  function setValue(el, value) {
    el.focus();
    if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      return true;
    }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  const selectors = [
    'div[contenteditable="true"]',
    'textarea',
    '[role="textbox"]',
    'div.ProseMirror'
  ];
  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll(sel)).filter((el) => !el.disabled && el.offsetParent !== null);
    const el = els[els.length - 1];
    if (el && setValue(el, prompt)) return { ok: true };
  }
  return { ok: false, error: 'Không tìm thấy ô nhập chat' };
}

function buildRelayPrompt(kind, source) {
  const content = source.content;
  return `Bạn là AI phản biện tổng hợp, nghiêm khắc, không nể ý tưởng gốc.

Nhiệm vụ: chỉ phản biện NỘI DUNG MỚI bên dưới, không lặp lại lịch sử cũ, không viết lan man. Hãy kiểm tra đồng thời tất cả nhóm sau:

1. Logic: mâu thuẫn, nhảy bước, kết luận không theo tiền đề.
2. Kỹ thuật: feasibility, edge case, lỗi triển khai, dependency, giới hạn nền tảng.
3. Fact/evidence: điểm thiếu nguồn, giả định chưa chứng minh, thông tin có thể sai.
4. Product/UX: có dễ dùng không, có lỗi thao tác không, có đường undo/recovery không.
5. Security/privacy: rò dữ liệu, quyền quá rộng, auto-send nguy hiểm, lưu trữ nhạy cảm.
6. Hiệu suất/context: có copy lặp, phình prompt, tốn token, vòng lặp vô hạn không.
7. Cấu trúc output: thiếu schema, thiếu tiêu chí dừng, thiếu bước kiểm chứng.
8. Hành động tiếp theo: sửa gì trước, bỏ gì, giữ gì.

Output bắt buộc, ngắn gọn:
- Verdict: PASS / PARTIAL / FAIL
- Critical issues: ...
- Missing pieces: ...
- Suggested fixes: ...
- Score: 0-10
- should_continue: true/false

Nguồn: ${source.platform}

NỘI DUNG MỚI:
${content}`;
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

async function executeRelay() {
  const sourceId = Number($('sourceTab').value);
  const targetId = Number($('targetTab').value);
  const kind = 'comprehensive';
  const mode = $('relayMode').value;
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Chọn 2 tab khác nhau');

  const [{ result: source }] = await chrome.scripting.executeScript({
    target: { tabId: sourceId },
    func: extractLatestResponseInPage,
    args: [mode]
  });
  if (!source?.content) throw new Error(mode === 'selection' ? 'Chưa bôi chọn đoạn nào trong tab nguồn' : 'Không lấy được câu trả lời mới nhất từ tab nguồn');

  const contentHash = hashText(source.content);
  const key = await relayStateKey(sourceId, targetId, kind, mode);
  const prev = await getRelayState(key);
  if (prev?.contentHash === contentHash) {
    log('chưa có phản hồi mới từ tab nguồn; đã chặn dán trùng');
    return;
  }

  const prompt = buildRelayPrompt(kind, source);
  await chrome.tabs.update(targetId, { active: true });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: targetId }, func: fillPromptInPage, args: [prompt] });
  if (!result?.ok) throw new Error(result?.error || 'Không dán được prompt');

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
  log(`đã dán nội dung mới hash=${contentHash}; Sếp bấm gửi thủ công`);
}

$('refreshTabsBtn')?.addEventListener('click', async () => {
  try { await refreshTabs(); } catch (e) { log(e.message); }
});

$('relayBtn')?.addEventListener('click', async () => {
  try { await executeRelay(); } catch (e) { log(e.message); }
});

$('resetRelayBtn')?.addEventListener('click', async () => {
  try {
    const n = await clearRelayStates();
    log(`đã xóa ${n} mốc relay`);
  } catch (e) { log(e.message); }
});

refreshTabs().catch(() => {});
