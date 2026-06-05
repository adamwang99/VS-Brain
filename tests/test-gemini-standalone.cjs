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

  // Kill current conversation — navigate to new
  await wc(gws, 1, 'Page.navigate', {url: 'https://gemini.google.com/new'});
  await new Promise(r => setTimeout(r, 5000));
  console.log('Navigated to /new');

  // Type a simple prompt
  await wc(gws, 2, 'Runtime.evaluate', {expression:
    `(()=>{const el=document.querySelector('[contenteditable="true"]');if(!el)return'NF';el.focus();el.innerText='Just answer: 2+2=?';el.dispatchEvent(new InputEvent('input',{bubbles:true}));return'OK'})()`, returnByValue: true});
  console.log('Typed');
  await new Promise(r => setTimeout(r, 1500));

  // Check send button state
  const r1 = await wc(gws, 3, 'Runtime.evaluate', {expression:
    `(()=>{const btn=Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').toLowerCase().includes('g\u1eedi')); return btn ? 'send='+btn.disabled+btn.className : 'no-send'})()`, returnByValue: true});
  console.log('Send btn:', r1.result?.result?.value);

  // Click send via pointer
  const r2 = await wc(gws, 4, 'Runtime.evaluate', {expression:
    `(()=>{const btn=Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').toLowerCase().includes('g\u1eedi')); if(btn&&!btn.disabled){btn.click();return'clicked'}return'fail'})()`, returnByValue: true});
  console.log('Click:', r2.result?.result?.value);

  console.log('Waiting 20s for response...');
  await new Promise(r => setTimeout(r, 20000));

  // Read response
  const r4 = await wc(gws, 6, 'Runtime.evaluate', {expression:
    `(()=>{const mr=document.querySelectorAll('model-response');if(!mr.length)return'no-resp';const last=mr[mr.length-1];return last.innerText.trim().slice(0,500)})()`, returnByValue: true});
  console.log('RESPONSE:', r4.result?.result?.value);

  // Check stop button
  const r5 = await wc(gws, 7, 'Runtime.evaluate', {expression:
    `Array.from(document.querySelectorAll('button')).some(b=>(b.getAttribute('aria-label')||'').includes('Ng\u1eebng'))`, returnByValue: true});
  console.log('STILL_GENERATING:', r5.result?.result?.value);

  gws.close();
})().catch(e => console.error('ERR:', e.message));
