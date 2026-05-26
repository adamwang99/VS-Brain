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
  $('checkpointBtn').disabled = !currentScan.messages.length;
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

$('checkpointBtn').addEventListener('click', async () => {
  try {
    if (!currentScan) await scan();
    await setCheckpoint(currentScan, currentScan.messages);
    log('đã đánh dấu mốc');
    await scan();
  } catch (e) { log(e.message); }
});

scan().catch((e) => log(e.message));
