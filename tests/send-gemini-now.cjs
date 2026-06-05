const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

(async () => {
  const pages = await f('/json/list');
  const gPage = pages.find(p => p.url.indexOf('gemini.google.com') >= 0);
  const gws = new ws_pkg.WebSocket(gPage.webSocketDebuggerUrl);
  await new Promise((r,rej) => { gws.on('open',r); gws.on('error',rej); setTimeout(()=>rej(new Error('t')),5000); });

  // Text is already typed - just need to send
  // Try Enter on the textbox
  let r = await wc(gws, 1, 'Runtime.evaluate', {expression:
    `(()=>{
      const el=document.querySelector('[contenteditable="true"]');
      if(!el||!el.innerText.trim()) return 'NO_TEXT';
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true,composed:true}));
      return 'ENTER_SENT';
    })()`,
  returnByValue:true});
  console.log('Enter:', r.result?.result?.value);

  // Check state after 2s
  await new Promise(r => setTimeout(r, 3000));
  r = await wc(gws, 2, 'Runtime.evaluate', {expression:'location.href', returnByValue:true});
  console.log('URL after Enter:', r.result?.result?.value);
  r = await wc(gws, 3, 'Runtime.evaluate', {expression:'document.querySelectorAll("user-query").length', returnByValue:true});
  console.log('User queries:', r.result?.result?.value);
  r = await wc(gws, 4, 'Runtime.evaluate', {expression:'document.querySelectorAll("model-response").length', returnByValue:true});
  console.log('Model responses:', r.result?.result?.value);

  // If Enter didn't work, find send button aggressively
  if (r.result?.result?.value === 0) {
    console.log('Enter failed, hunting send button...');
    r = await wc(gws, 5, 'Runtime.evaluate', {expression:
      `(()=>{
        // Gemini's send button might be an icon button
        const btns=Array.from(document.querySelectorAll('button'));
        let found=[];
        for(const b of btns){
          if(!b.offsetParent || b.disabled) continue;
          const l=(b.getAttribute('aria-label')||'').toLowerCase();
          const svg=b.querySelector('svg');
          if(l||svg){
            found.push({label:l.slice(0,40), hasSVG:!!svg, disabled:b.disabled});
          }
        }
        // Try clicking any button with SVG child
        for(const b of btns){
          if(!b.offsetParent || b.disabled) continue;
          if(b.querySelector('svg') && !b.querySelector('[class*="menu"]')){
            const l=(b.getAttribute('aria-label')||'').toLowerCase();
            if(l.includes('g\u1eedi')||l.includes('send')||l.includes('enter')){
              b.click();
              return 'CLICKED:'+l;
            }
          }
        }
        return 'FOUND_BTNS:'+JSON.stringify(found.slice(0,6));
      })()`,
    returnByValue:true});
    console.log('Button hunt:', r.result?.result?.value);

    await new Promise(r => setTimeout(r, 3000));
    r = await wc(gws, 6, 'Runtime.evaluate', {expression:'document.querySelectorAll("model-response").length', returnByValue:true});
    console.log('Model responses after:', r.result?.result?.value);
    r = await wc(gws, 7, 'Runtime.evaluate', {expression:'location.href', returnByValue:true});
    console.log('URL:', r.result?.result?.value);
  }

  // Wait for generation
  if (r.result?.result?.value > 0) {
    console.log('Waiting 20s for generation...');
    await new Promise(r => setTimeout(r, 20000));
  }

  // Extract
  r = await wc(gws, 10, 'Runtime.evaluate', {expression:
    `(()=>{
      const mr=document.querySelector('model-response');
      if(!mr) return 'NF';
      const md=mr.querySelector('[class*="markdown-main-panel"]');
      return md?md.textContent.trim():mr.textContent.trim().substring(0,500);
    })()`,
  returnByValue:true});
  console.log('RESPONSE:', r.result?.result?.value);

  gws.close();
})().catch(e=>console.error(e.message));
