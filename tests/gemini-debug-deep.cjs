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

  // Full page scan - get body innerText, all conversations, everything
  let r = await wc(gws, 1, 'Runtime.evaluate', {expression:
    'JSON.stringify({url:location.href, title:document.title, bodySlice:document.body.innerText.replace(/\\n{4,}/g,"\\n\\n\\n").slice(0,1500), userQueryCount:document.querySelectorAll("user-query").length, modelRespCount:document.querySelectorAll("model-response").length})',
  returnByValue: true});
  console.log('PAGE:', r.result?.result?.value);

  // Check if send button click actually resulted in a request
  // Look at network (need Network domain)
  // Or check if there's a new conversation in sidebar

  // Let's try using DOM event instead of click
  r = await wc(gws, 2, 'Runtime.evaluate', {expression:
    `(() => {
      // Find the text input again
      const inputs = document.querySelectorAll('[contenteditable="true"]');
      let found = [];
      for (const el of inputs) {
        found.push({id:el.id, text: (el.innerText || '').slice(0,60), visible: !!el.offsetParent});
      }
      return JSON.stringify(found);
    })()`,
  returnByValue: true});
  console.log('INPUTS:', r.result?.result?.value);

  // Check if there's a conversation sidebar with the chat
  r = await wc(gws, 3, 'Runtime.evaluate', {expression:
    `(() => {
      const chats = document.querySelectorAll('[class*="conversation"], [class*="chat-item"], [class*="session"], [class*="history"]');
      return chats.length + ' chat items found';
    })()`,
  returnByValue: true});
  console.log('CHATS:', r.result?.result?.value);

  // Let's try a completely different approach - use keyboard shortcuts
  // Gemini typically accepts Enter to send
  r = await wc(gws, 4, 'Runtime.evaluate', {expression:
    `(() => {
      // Refocus and type new content
      const el = document.querySelector('[contenteditable="true"]');
      if (!el) return 'NO_INPUT';
      el.focus();
      
      // Clear and type
      el.textContent = '';
      el.innerText = 'What is 1+1?';
      
      // Trigger events Gemini recognizes
      el.dispatchEvent(new Event('focus', {bubbles:true}));
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
      
      // Now dispatch Enter key
      el.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', code:'Enter', bubbles:true, cancelable:true}));
      
      return 'ENTER_SENT';
    })()`,
  returnByValue: true});
  console.log('ENTER:', r.result?.result?.value);

  console.log('Waiting 20s...');
  await new Promise(r => setTimeout(r, 20000));

  r = await wc(gws, 5, 'Runtime.evaluate', {expression:
    `(() => {
      const mr = document.querySelectorAll('model-response');
      const uq = document.querySelectorAll('user-query');
      return JSON.stringify({
        modelResponses: mr.length,
        userQueries: uq.length,
        lastModel: mr.length ? mr[mr.length-1].innerText.trim().slice(0,400) : 'NONE',
        title: document.title,
        url: location.href,
        generating: !!document.querySelector('[class*="generating"], [class*="streaming"]')
      });
    })()`,
  returnByValue: true});
  console.log('FINAL:', r.result?.result?.value);

  gws.close();
})().catch(e => console.error('ERR:', e.message));
