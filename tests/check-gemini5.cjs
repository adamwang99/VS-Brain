const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

(async () => {
  const pages = await f('/json/list');
  const gemini = pages.find(p => p.url.indexOf('gemini.google.com') >= 0);
  const gws = new ws_pkg.WebSocket(gemini.webSocketDebuggerUrl);
  await new Promise((r,rej) => { gws.on('open',r); gws.on('error',rej); setTimeout(()=>rej(new Error('t')),5000); });

  // Current state
  let r = await wc(gws, 1, 'Runtime.evaluate', {expression:'location.href', returnByValue:true});
  console.log('URL:', r.result?.result?.value);

  // If stuck on a conversation, find and send button
  // Find ALL visible buttons with aria-labels
  r = await wc(gws, 2, 'Runtime.evaluate', {expression:
    `(() => { const btns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null); return JSON.stringify(btns.slice(0,10).map(b => ({text: (b.textContent||'').trim().slice(0,30), label: (b.getAttribute('aria-label')||'').slice(0,30), disabled: b.disabled}))); })()`,
  returnByValue: true});
  console.log('VISIBLE BTNS:', r.result?.result?.value);

  // Check contenteditable
  r = await wc(gws, 3, 'Runtime.evaluate', {expression:
    `(() => { const els = document.querySelectorAll('[contenteditable="true"]'); return JSON.stringify(Array.from(els).map(e => ({text: (e.innerText||'').slice(0,50), placeholder: e.getAttribute('aria-label')||'', visible: e.offsetParent !== null}))); })()`,
  returnByValue: true});
  console.log('EDITABLE:', r.result?.result?.value);

  gws.close();
})().catch(e => console.error('ERR:', e.message));
