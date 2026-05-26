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
  $('startLoopBtn').disabled = aiTabs.length < 2;
  $('autoPickBtn').disabled = aiTabs.length < 2;
  $('swapTabsBtn').disabled = aiTabs.length < 2;
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

function pageContainsStopPhrase(stopPhrase) {
  return (document.body?.innerText || '').includes(stopPhrase);
}


function buildRelayPrompt(kind, source, extraInstruction = '', stopPhrase = 'CROSSCRITIC_FINAL_AGREE') {
  const content = source.content;
  const extra = extraInstruction.trim() ? `\n\nYÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG:\n${extraInstruction.trim()}` : '';
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
  const currentSource = Number($('sourceTab').value);
  const currentTarget = Number($('targetTab').value);
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

async function executeRelay(sourceOverride, targetOverride) {
  const sourceId = Number(sourceOverride || $('sourceTab').value);
  const targetId = Number(targetOverride || $('targetTab').value);
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
    return { pasted: false, reason: 'duplicate' };
  }

  const stopPhrase = $('stopPhrase')?.value?.trim() || 'CROSSCRITIC_FINAL_AGREE';
  const prompt = buildRelayPrompt(kind, source, $('extraInstruction')?.value || '', stopPhrase);
  await chrome.tabs.update(targetId, { active: true });
  await new Promise((r) => setTimeout(r, 500));
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: targetId }, func: fillPromptInPage, args: [prompt] });
  if (!result?.ok) throw new Error(result?.error || 'Không dán được prompt');
  let sendResult = null;
  if ($('autoSendToggle')?.checked) {
    const [{ result: sr }] = await chrome.scripting.executeScript({ target: { tabId: targetId }, func: clickSendInPage });
    sendResult = sr;
    if (!sendResult?.ok) log(`auto-send fail: ${sendResult?.error || 'unknown'}`);
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

function setLoopRunning(running) {
  $('startLoopBtn').disabled = running || aiTabs.length < 2;
  $('stopLoopBtn').disabled = !running;
}

function stopLoop(reason = 'stopped') {
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = null;
  loopState = null;
  setLoopRunning(false);
  log(`auto-loop dừng: ${reason}`);
}

async function loopStep() {
  if (!loopState) return;
  const stopPhrase = $('stopPhrase')?.value?.trim() || 'CROSSCRITIC_FINAL_AGREE';
  for (const tabId of [loopState.a, loopState.b]) {
    try {
      const [{ result: hasStop }] = await chrome.scripting.executeScript({ target: { tabId }, func: pageContainsStopPhrase, args: [stopPhrase] });
      if (hasStop) return stopLoop(`gặp cụm từ chốt: ${stopPhrase}`);
    } catch (_) {}
  }
  if (loopState.step >= loopState.maxSteps) return stopLoop('đạt số bước tối đa');
  let sourceId, targetId;
  try {
    const picked = await autoPickNewestDirection();
    sourceId = picked.source.tabId;
    targetId = picked.target.tabId;
  } catch (_) {
    [sourceId, targetId] = loopState.direction === 0 ? [loopState.a, loopState.b] : [loopState.b, loopState.a];
  }
  loopState.step += 1;
  log(`auto-loop bước ${loopState.step}/${loopState.maxSteps}: ${sourceId} → ${targetId}`);
  try {
    await executeRelay(sourceId, targetId);
  } catch (e) {
    log(`auto-loop lỗi: ${e.message}`);
  }
  loopState.direction = loopState.direction ? 0 : 1;
  loopTimer = setTimeout(loopStep, loopState.delayMs);
}

$('startLoopBtn')?.addEventListener('click', async () => {
  try {
    const a = Number($('sourceTab').value);
    const b = Number($('targetTab').value);
    if (!a || !b || a === b) throw new Error('Chọn 2 tab khác nhau');
    loopState = {
      a,
      b,
      direction: 0,
      step: 0,
      maxSteps: Math.max(1, Math.min(20, Number($('loopMaxSteps').value || 6))),
      delayMs: Math.max(3, Math.min(120, Number($('loopDelaySec').value || 12))) * 1000
    };
    setLoopRunning(true);
    log(`auto-loop bắt đầu: max=${loopState.maxSteps}, delay=${loopState.delayMs / 1000}s. autoSend=${$('autoSendToggle')?.checked ? 'ON' : 'OFF'}`);
    await loopStep();
  } catch (e) { log(e.message); }
});

$('stopLoopBtn')?.addEventListener('click', () => stopLoop('Sếp bấm dừng'));

refreshTabs().catch(() => {});
