// Scan tất cả provider tabs để tìm selector pattern
// Chạy: node scan-all-providers.cjs
const WebSocket = require('ws');
const http = require('http');

const CDP_PORT = 9222;
const TARGETS = [
  { label: 'Claude',     id: 'FB88AFB9', url_part: 'chatbotapp.ai' },
  { label: 'Qwen',       id: '9D268EDA', url_part: 'qwen.ai' },
  { label: 'Copilot',    id: 'C12C6FE1', url_part: 'copilot.microsoft.com' },
  { label: 'Perplexity', id: '5349E765', url_part: 'perplexity.ai' },
  { label: 'Grok',       id: '89320EBE', url_part: 'x.com' },
  { label: 'DeepSeek',   id: '9A9348C8', url_part: 'deepseek.com' },
  { label: 'ChatGPT',    id: 'B7953D36', url_part: 'chatgpt.com' },
  { label: 'Gemini',     id: '5A079322', url_part: 'gemini.google.com' },
];

async function findTabs() {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, (r) => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d)));
    });
  });
}

async function js(tab, code) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    let msgId = 0;
    const pending = {};
    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id && pending[m.id]) pending[m.id](m.result);
    });
    ws.on('open', () => {
      msgId++; pending[msgId] = async (r) => {
        ws.close();
        res(r);
      };
      ws.send(JSON.stringify({id: msgId, method: 'Runtime.evaluate', params: {
        expression: `(() => {${code}})()`,
        returnByValue: true
      }}));
    });
  });
}

async function scanTab(target) {
  const tabs = await findTabs();
  const tab = tabs.find(t => t.url.includes(target.url_part) && t.type === 'page');
  if (!tab) return { label: target.label, status: 'NOT_FOUND' };

  const result = { label: target.label, id: tab.id.substring(0,8), url: tab.url.substring(0,100), status: 'OK' };

  // 1. Contenteditable / textarea
  result.input = await js(tab, `
    const ce = document.querySelector('[contenteditable="true"]');
    const ta = document.querySelector('textarea');
    const inp = document.querySelector('input[type="text"]');
    const toSend = [];
    if (ce) toSend.push({type:'contenteditable', placeholder: ce.getAttribute('placeholder')||'', text: (ce.innerText||'').substring(0,80)});
    if (ta) toSend.push({type:'textarea', placeholder: ta.getAttribute('placeholder')||'', rows: ta.rows, text: (ta.value||'').substring(0,80)});
    if (inp) toSend.push({type:'input:text', placeholder: inp.getAttribute('placeholder')||''});
    toSend;
  `);

  // 2. Send button candidates
  result.sendBtn = await js(tab, `
    const btns = [];
    document.querySelectorAll('button, [role="button"], [type="submit"]').forEach(b => {
      const txt = (b.innerText||b.getAttribute('aria-label')||'').trim().toLowerCase().substring(0,30);
      const cls = (b.className||'').substring(0,60);
      const dataTest = b.getAttribute('data-testid')||'';
      if (txt.includes('send')||txt.includes('gửi')||txt.includes('→')||
          dataTest.includes('send')||cls.includes('send')||cls.includes('submit'))
        btns.push({text:txt, class:cls, 'data-testid':dataTest, tag:b.tagName});
    });
    btns;
  `);

  // 3. Response area candidates
  result.response = await js(tab, `
    const resp = [];
    // Common selectors for different providers
    const selectors = [
      '[class*="message"]', '[class*="chat"]', '[class*="response"]',
      'main', 'article', '[data-testid*="conversation"]', '[data-testid*="message"]',
      '.prose', '.markdown', '.result', '.answer'
    ];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) resp.push({selector:sel, text: (el.innerText||'').substring(0,80)});
    });
    resp;
  `);

  return result;
}

(async () => {
  for (const t of TARGETS) {
    const r = await scanTab(t);
    console.log('='.repeat(60));
    console.log(`${r.label} (${r.id}): ${r.status}`);
    if (r.status === 'NOT_FOUND') { console.log('  Tab not found'); return; }
    console.log(`  URL: ${r.url}`);
    console.log(`  Input: ${JSON.stringify(r.input)}`);
    console.log(`  SendBtn: ${JSON.stringify(r.sendBtn)}`);
    console.log(`  Response: ${JSON.stringify(r.response)}`);
  }
})();
