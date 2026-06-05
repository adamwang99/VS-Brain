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

  // Navigate to /app
  await wc(gws, 1, 'Page.navigate', {url: 'https://gemini.google.com/app'});
  await new Promise(r => setTimeout(r, 6000));

  let r = await wc(gws, 2, 'Runtime.evaluate', {expression:'location.href', returnByValue:true});
  console.log('URL:', r.result?.result?.value);

  // Wait more if still loading
  if (r.result?.result?.value === 'https://gemini.google.com/app') {
    await new Promise(r => setTimeout(r, 3000));
  }

  // Find textbox
  r = await wc(gws, 3, 'Runtime.evaluate', {expression:
    `(() => { const e = document.querySelector('[contenteditable="true"][role="textbox"]'); if(!e) return 'NF'; e.focus(); e.innerText = 'Just answer: 2+2=?'; e.dispatchEvent(new InputEvent('input',{bubbles:true})); return 'typed: ' + e.innerText.length + ' chars'; })()`,
  returnByValue: true});
  console.log('Type:', r.result?.result?.value);

  await new Promise(r => setTimeout(r, 1500));

  // Find send button
  r = await wc(gws, 4, 'Runtime.evaluate', {expression:
    `(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').toLowerCase().includes('g\u1eedi')); if(btn && !btn.disabled) { btn.click(); return 'clicked'; } return btn ? 'disabled:'+btn.disabled : 'NF'; })()`,
  returnByValue: true});
  console.log('Send:', r.result?.result?.value);

  if (r.result?.result?.value && r.result.result.value.indexOf('clicked') >= 0) {
    console.log('Waiting 25s for Gemini response...');
    await new Promise(r => setTimeout(r, 25000));

    r = await wc(gws, 5, 'Runtime.evaluate', {expression:
      `(() => { const mr = document.querySelectorAll('model-response'); if(!mr.length) return 'no-response'; return mr[mr.length-1].innerText.trim().slice(0,500); })()`,
    returnByValue: true});
    console.log('GEMINI_RESP:', r.result?.result?.value);

    r = await wc(gws, 6, 'Runtime.evaluate', {expression:
      `Array.from(document.querySelectorAll('button')).some(b => (b.getAttribute('aria-label')||'').includes('Ng\u1eebng'))`,
    returnByValue: true});
    console.log('STILL_GEN:', r.result?.result?.value);
  }

  gws.close();
})().catch(e => console.error('ERR:', e.message));
