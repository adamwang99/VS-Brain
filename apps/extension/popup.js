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
    const text = (node.getAttribute('data-message-author-role') || node.getAttribute('aria-label') || node.className || '').toString().toLowerCase();
    if (text.includes('user') || text.includes('you')) return 'user';
    if (text.includes('assistant') || text.includes('model') || text.includes('chatgpt') || text.includes('gemini')) return 'assistant';
    return idx % 2 === 0 ? 'user' : 'assistant';
  }

  let nodes = [];
  if (platform === 'chatgpt') {
    nodes = Array.from(document.querySelectorAll('[data-message-author-role], article, main [class*="group"]'));
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

function extractLatestResponseInPage() {
  function cleanText(text) {
    return (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  const host = location.hostname;
  const platform = host.includes('gemini.google.com') ? 'gemini'
    : host.includes('deepseek.com') ? 'deepseek'
    : host.includes('claude.ai') ? 'claude'
    : host.includes('perplexity.ai') ? 'perplexity'
    : host.includes('chatgpt.com') || host.includes('chat.openai.com') ? 'chatgpt'
    : 'unknown';

  const selectors = platform === 'chatgpt'
    ? ['[data-message-author-role="assistant"]', 'article', '.markdown']
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
  const base = `Nguồn: ${source.platform}\nYêu cầu: Đọc nội dung dưới đây và phản hồi theo đúng vai trò.\n\nNỘI DUNG:\n${content}`;
  if (kind === 'verify') return `${base}\n\nVAI TRÒ: Kiểm tra logic/kỹ thuật.\nOutput:\n1. Lỗi logic/kỹ thuật\n2. Giả định yếu\n3. Rủi ro triển khai\n4. Kết luận pass/fail\n5. Nếu cần tiếp tục phản biện, ghi should_continue=true.`;
  if (kind === 'revise') return `${base}\n\nVAI TRÒ: Sửa bản nháp dựa trên phản biện.\nOutput:\n1. Bản sửa hoàn chỉnh\n2. Những điểm đã sửa\n3. Điểm còn chưa chắc\n4. should_continue=true/false.`;
  if (kind === 'final') return `${base}\n\nVAI TRÒ: Tổng hợp bản cuối.\nChỉ giữ nội dung đã đủ chắc, bỏ phần mơ hồ.\nOutput:\n1. Final answer\n2. Confidence 0-10\n3. Critical issues còn lại\n4. should_continue=true/false.`;
  return `${base}\n\nVAI TRÒ: Phản biện nghiêm khắc.\nTìm lỗi, thiếu evidence, mâu thuẫn, giả định yếu.\nOutput:\n1. Điểm mạnh\n2. Lỗi/thiếu sót\n3. Câu hỏi cần làm rõ\n4. Đề xuất sửa\n5. score 0-10\n6. should_continue=true/false.`;
}

async function executeRelay() {
  const sourceId = Number($('sourceTab').value);
  const targetId = Number($('targetTab').value);
  if (!sourceId || !targetId || sourceId === targetId) throw new Error('Chọn 2 tab khác nhau');
  const [{ result: source }] = await chrome.scripting.executeScript({ target: { tabId: sourceId }, func: extractLatestResponseInPage });
  if (!source?.content) throw new Error('Không lấy được câu trả lời từ tab nguồn');
  const prompt = buildRelayPrompt($('relayTemplate').value, source);
  await chrome.tabs.update(targetId, { active: true });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: targetId }, func: fillPromptInPage, args: [prompt] });
  if (!result?.ok) throw new Error(result?.error || 'Không dán được prompt');
  log(`đã dán prompt từ ${source.platform} sang tab đích; Sếp bấm gửi thủ công`);
}

$('refreshTabsBtn')?.addEventListener('click', async () => {
  try { await refreshTabs(); } catch (e) { log(e.message); }
});

$('relayBtn')?.addEventListener('click', async () => {
  try { await executeRelay(); } catch (e) { log(e.message); }
});

refreshTabs().catch(() => {});
