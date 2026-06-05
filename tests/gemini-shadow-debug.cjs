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

  // Deep dive into model-response
  let r = await wc(gws, 1, 'Runtime.evaluate', {expression:
    `(() => {
      const mr = document.querySelector('model-response');
      if (!mr) return 'NO_MODEL';
      return JSON.stringify({
        htmlSlice: mr.innerHTML.slice(0, 3000),
        textSlice: mr.innerText.slice(0, 500),
        textLen: mr.innerText.length,
        childCount: mr.childElementCount,
        firstChildHTML: mr.children[0] ? mr.children[0].innerHTML.slice(0,500) : 'no-children',
        shadowHosts: mr.querySelectorAll('*').length
      });
    })()`,
  returnByValue: true});
  console.log('MODEL_RESPONSE:', r.result?.result?.value);

  // Check user-query too
  r = await wc(gws, 2, 'Runtime.evaluate', {expression:
    `(() => {
      const uq = document.querySelector('user-query');
      if (!uq) return 'NO_QUERY';
      return JSON.stringify({
        html: uq.innerHTML.slice(0, 1000),
        text: uq.innerText.slice(0, 200)
      });
    })()`,
  returnByValue: true});
  console.log('USER_QUERY:', r.result?.result?.value);

  // Try walking the Shadow DOM
  r = await wc(gws, 3, 'Runtime.evaluate', {expression:
    `(() => {
      const mr = document.querySelector('model-response');
      if (!mr || !mr.shadowRoot) return 'NO_SHADOW_ROOT';
      return mr.shadowRoot.innerHTML.slice(0, 1000);
    })()`,
  returnByValue: true});
  console.log('SHADOW_ROOT:', r.result?.result?.value);

  // Check if response_container exists
  r = await wc(gws, 4, 'Runtime.evaluate', {expression:
    `(() => {
      // Gemini uses Angular ViewEncapsulation
      // Check all elements with the response-text class or similar
      const textEls = document.querySelectorAll('[class*="response-text"], [class*="model-response"], [class*="message-content"]');
      const results = [];
      for (const el of textEls) {
        results.push({
          tag: el.tagName,
          class: (el.className||'').slice(0,60),
          text: el.innerText.trim().slice(0,200)
        });
      }
      return JSON.stringify(results);
    })()`,
  returnByValue: true});
  console.log('TEXT_ELS:', r.result?.result?.value);

  // One more: check on the response-container header status
  r = await wc(gws, 5, 'Runtime.evaluate', {expression:
    `(() => {
      const statusEls = document.querySelectorAll('[class*="response-container-header-status"]');
      return JSON.stringify(Array.from(statusEls).map(e => e.innerText.slice(0,200)));
    })()`,
  returnByValue: true});
  console.log('STATUS:', r.result?.result?.value);

  gws.close();
})().catch(e => console.error('ERR:', e.message));
