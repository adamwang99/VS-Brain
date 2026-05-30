const DEFAULT_SCENARIO = {
  provider: 'mock',
  title: 'Mock Provider',
  autoRespond: true,
  responseDelayMs: 250,
  turns: [
    {
      whenPromptIncludes: '',
      response: 'Verdict: PASS\nCritical issues: none\nMissing pieces: none\nMinor notes: none\nSuggested fixes: none\nConfidence: 9/10\nshould_continue: false\nCHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN'
    }
  ]
};

function hashText(input) {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function loadScenario() {
  const qs = new URLSearchParams(location.search);
  const src = qs.get('scenario');
  if (!src) return { ...DEFAULT_SCENARIO };
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Scenario load failed: ${res.status}`);
  return await res.json();
}

function renderMeta(scenario) {
  document.title = scenario.title || scenario.provider || 'Mock Provider';
  document.getElementById('providerName').textContent = scenario.title || scenario.provider || 'Mock Provider';
  document.getElementById('scenarioName').textContent = scenario.name || 'unnamed';
}

function addMessage(role, content) {
  const feed = document.getElementById('feed');
  const article = document.createElement('article');
  article.className = `msg ${role}`;
  article.setAttribute('data-message-author-role', role);
  article.dataset.hash = hashText(content);
  const head = document.createElement('div');
  head.className = 'meta';
  head.textContent = role === 'assistant' ? 'assistant' : 'user';
  const body = document.createElement('div');
  body.className = 'markdown';
  body.textContent = content;
  article.append(head, body);
  feed.appendChild(article);
  article.scrollIntoView({ block: 'end' });
  return article;
}

function findTurn(scenario, prompt, turnIndex) {
  const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
  return turns.find((t) => {
    if (typeof t.onTurn === 'number' && t.onTurn !== turnIndex) return false;
    if (typeof t.whenPromptIncludes === 'string' && t.whenPromptIncludes && !prompt.includes(t.whenPromptIncludes)) return false;
    return true;
  }) || turns[Math.min(turnIndex, Math.max(0, turns.length - 1))] || null;
}

function buildApi(scenario) {
  let turnIndex = 0;
  const state = { scenario, history: [] };
  window.__mockProvider = {
    state,
    addAssistant(content) {
      state.history.push({ role: 'assistant', content });
      return addMessage('assistant', content);
    },
    addUser(content) {
      state.history.push({ role: 'user', content });
      return addMessage('user', content);
    },
    async submitPrompt(prompt) {
      this.addUser(prompt);
      const turn = findTurn(scenario, prompt, turnIndex++);
      if (!turn) return null;
      const delay = Number(turn.delayMs ?? scenario.responseDelayMs ?? 250);
      await new Promise((r) => setTimeout(r, delay));
      const response = typeof turn.response === 'string' ? turn.response : JSON.stringify(turn.response, null, 2);
      this.addAssistant(response);
      return response;
    }
  };
}

async function main() {
  const scenario = await loadScenario();
  renderMeta(scenario);
  buildApi(scenario);

  const input = document.getElementById('composer');
  const send = document.getElementById('sendBtn');
  send.addEventListener('click', async () => {
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = '';
    try {
      await window.__mockProvider.submitPrompt(prompt);
    } catch (err) {
      addMessage('assistant', `ERROR: ${err.message}`);
    }
  });

  input.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send.click();
    }
  });

  (scenario.seedMessages || []).forEach((m) => addMessage(m.role || 'assistant', m.content || ''));
}

function normalizeText(v) {
  return String(v || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

window.pageScanner = function pageScanner() {
  const messages = Array.from(document.querySelectorAll('[data-message-author-role]')).map((el, idx) => {
    const role = el.getAttribute('data-message-author-role') || (idx % 2 === 0 ? 'assistant' : 'user');
    const content = normalizeText(el.innerText || el.textContent || '');
    return content ? {
      platform: location.pathname.includes('mock-gemini') ? 'gemini' : 'chatgpt',
      conversationId: location.pathname,
      conversationTitle: document.title,
      role,
      content,
      contentHash: hashText(content),
      messageKey: `${role}:${hashText(content)}`,
      exportedAt: new Date().toISOString()
    } : null;
  }).filter(Boolean);
  return {
    platform: location.pathname.includes('mock-gemini') ? 'gemini' : 'chatgpt',
    conversationId: location.pathname,
    title: document.title,
    url: location.href,
    messages
  };
};

window.extractLatestResponseInPage = function extractLatestResponseInPage(mode = 'latest') {
  if (mode === 'selection') {
    const selected = normalizeText(String(window.getSelection?.() || ''));
    if (selected) return { platform: location.pathname.includes('mock-gemini') ? 'gemini' : 'chatgpt', title: document.title, url: location.href, content: selected };
  }
  const assistant = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
  const last = assistant[assistant.length - 1];
  return {
    platform: location.pathname.includes('mock-gemini') ? 'gemini' : 'chatgpt',
    title: document.title,
    url: location.href,
    content: normalizeText(last?.innerText || last?.textContent || '')
  };
};

window.latestResponseContainsStopPhrase = function latestResponseContainsStopPhrase(stopPhrase) {
  const last = window.extractLatestResponseInPage('latest');
  if (!last?.content) return false;
  if (/should_continue\s*[:：]?\s*true/i.test(last.content)) return false;
  const lines = normalizeText(last.content).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  return !!lines.length && lines[lines.length - 1] === String(stopPhrase).trim();
};

window.fillPromptInPage = async function fillPromptInPage(prompt) {
  const input = document.getElementById('composer');
  if (!input) return { ok: false, error: 'composer not found' };
  input.value = prompt;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, method: 'setValue', selector: 'textarea[placeholder]' };
};

window.clickSendInPage = async function clickSendInPage() {
  const btn = document.getElementById('sendBtn');
  if (!btn) return { ok: false, error: 'send button not found' };
  btn.click();
  return { ok: true, selector: 'button[aria-label*="Send" i]' };
};

main().catch((err) => {
  document.getElementById('feed').textContent = `BOOT ERROR: ${err.message}`;
});
