// Debug ChatGPT DOM structure
const WebSocket = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222/json';

function cdpFetch(path) {
  return new Promise((ok,err) => http.get(CDP+path, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>ok(JSON.parse(d))); r.on('error',err); }));
}

function wsCmd(tab, expression) {
  return new Promise((ok,err) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({id:1, method:'Runtime.evaluate', params:{expression, awaitPromise:false}}));
    });
    ws.on('message', d => { const r=JSON.parse(d.toString()); if(r.id===1) { ws.close(); ok(r); } });
    ws.on('error', err);
  });
}

(async () => {
  const tab = await cdpFetch('').then(ts => ts.find(t => t.url.includes('chatgpt.com')));
  if (!tab) { console.log('No ChatGPT tab'); process.exit(1); }
  console.log('URL:', tab.url);
  
  // Check various selectors
  const checks = [
    `(function(){ const e=document.querySelector('[contenteditable=\"true\"]'); return e?'found editable':'no-editable'; })()`,
    `(function(){ const l=document.querySelectorAll('[contenteditable]'); return Array.from(l).map(e=>[e.tagName,e.getAttribute('role'),e.getAttribute('data-testid')].filter(Boolean).join('/')); })()`,
    `(function(){ const l=document.querySelectorAll('button'); return Array.from(l).slice(-8).map(b=>[b.getAttribute('data-testid'),b.getAttribute('aria-label'),b.textContent.trim().slice(0,20)].filter(Boolean).join(' | ')); })()`,
    `(function(){ const l=document.querySelectorAll('[data-testid]'); return Array.from(l).map(e=>e.getAttribute('data-testid')); })()`,
    `(function(){ const a=document.querySelectorAll('[data-message-author-role]'); return 'msgs:'+a.length; })()`,
    `(function(){ return 'stop-btn:'+(document.querySelector('[data-testid=\"stop-button\"]')?'yes':'no'); })()`,
    `(function(){ const e=document.querySelector('form'); if(!e)return'no-form'; const inp=e.querySelector('[contenteditable]'); const btn=e.querySelector('button[type=\"submit\"]'); return 'form:inp='+(inp?'yes':'no')+' btn='+(btn?'yes:'+btn.getAttribute('data-testid'):'no'); })()`,
  ];
  
  for (const c of checks) {
    const r = await wsCmd(tab, c);
    console.log(r.result.value);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
