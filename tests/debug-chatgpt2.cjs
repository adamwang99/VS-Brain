// ChatGPT debug send button — ngay sau fresh thread navigation
const WebSocket = require('ws');
const http = require('http');
// Helper: find tab, connect ws, run code
async function runTab(urlFilter, code) {
  const tabs = JSON.parse(await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(d));
  })));
  const tab = tabs.find(t => t.url.includes(urlFilter) && t.type === 'page');
  if (!tab) { console.log('Tab not found:', urlFilter); return null; }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const cdp = (method, params) => new Promise((res, rej) => {
    const id = Date.now() + Math.random();
    const cb = d => { const m = JSON.parse(d.toString()); if (m.id === id) { ws.removeListener('message', cb); res(m); } };
    ws.on('message', cb); ws.on('error', rej);
    ws.send(JSON.stringify({id, method, params}));
  });

  // Navigate to fresh ChatGPT
  console.log('Navigating to fresh ChatGPT...');
  await cdp('Runtime.evaluate', {expression: `window.location.href='https://chatgpt.com/'`, returnByValue: false});
  await new Promise(r => setTimeout(r, 8000)); // Wait for page load

  // Type text
  const typed = await cdp('Runtime.evaluate', {expression: `(()=>{
    const editor = document.getElementById('prompt-textarea');
    if (!editor) return 'no-editor';
    editor.innerText = 'xin chao test 123456';
    editor.dispatchEvent(new Event('input', {bubbles: true}));
    return 'typed: ' + editor.innerText.substring(0,30);
  })()`, returnByValue: true});
  console.log('Type result:', typed.result.value);

  await new Promise(r => setTimeout(r, 2000));

  // Find ALL buttons in DOM with position info
  const btns = await cdp('Runtime.evaluate', {expression: `(()=>{
    const res = [];
    document.querySelectorAll('button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > window.innerHeight * 0.6) {
        res.push({
          y: Math.round(r.y), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height),
          aria: (b.getAttribute('aria-label')||'').substring(0,35),
          dt: (b.getAttribute('data-testid')||'').substring(0,25),
          cls: (b.className||'').substring(0,25),
          inner: (b.innerText||'').trim().substring(0,15),
          disabled: b.disabled
        });
      }
    });
    return res.sort((a,b) => a.y - b.y || a.x - b.x);
  })()`, returnByValue: true});
  console.log('Bottom buttons:', JSON.stringify(btns.result.value, null, 2));

  ws.close();
}

runTab('chatgpt.com').catch(e => console.error(e));
