const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

function extractGeminiHTML(el) {
  // Gemini wraps response in model-response with pending animation
  // Use textContent which bypasses CSS visibility
  const mr = el.querySelector('model-response');
  if (!mr) return null;
  const content = mr.querySelector('[class*="markdown-main-panel"]');
  if (!content) return mr.textContent.trim();
  return content.textContent.trim();
}

function extractChatGPT(el) {
  const all = el.querySelectorAll('[data-message-author-role="assistant"]');
  if (!all.length) return null;
  return all[all.length-1].innerText.trim();
}

async function sendToGemini(gws, text) {
  // Navigate to fresh page
  await wc(gws, 1, 'Page.navigate', {url:'https://gemini.google.com/app'});
  await new Promise(r => setTimeout(r, 7000));

  // Type using innerText + Enter
  const msg = JSON.stringify(text).slice(1,-1);
  await wc(gws, 2, 'Runtime.evaluate', {expression:
    `(()=>{const e=document.querySelector('[contenteditable="true"]');if(!e)return'NF';e.focus();e.innerText=${JSON.stringify(msg)};e.dispatchEvent(new Event('input',{bubbles:true}));return'OK'})()`,
  returnByValue:true});
  await new Promise(r => setTimeout(r, 2000));

  // Click send button
  let r = await wc(gws, 3, 'Runtime.evaluate', {expression:
    `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('g\u1eedi'));if(b&&!b.disabled){b.click();return'OK'}return'FAIL'})()`,
  returnByValue:true});
  if (r.result?.result?.value === 'FAIL') {
    // Try Enter key
    await wc(gws, 4, 'Runtime.evaluate', {expression:
      `(()=>{const e=document.querySelector('[contenteditable="true"]');if(!e)return'NF';e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));return'ENTER'})()`,
    returnByValue:true});
  }

  // Wait 25s for response
  await new Promise(r => setTimeout(r, 25000));

  // Extract with textContent bypass
  r = await wc(gws, 5, 'Runtime.evaluate', {expression:
    `(()=>{const m=document.querySelector('model-response');if(!m)return'NF';const c=m.querySelector('[class*="markdown-main-panel"]');return c?c.textContent.trim():m.textContent.trim().substring(0,500)})()`,
  returnByValue:true});
  return r.result?.result?.value;
}

async function sendToChatGPT(cws, text) {
  await wc(cws, 1, 'Page.navigate', {url:'https://chatgpt.com/'});
  await new Promise(r => setTimeout(r, 5000));

  // Type
  await wc(cws, 2, 'Runtime.evaluate', {expression:
    `(()=>{const e=document.querySelector('#prompt-textarea');if(!e)return'NF';e.focus();e.innerText=${JSON.stringify(text)};e.dispatchEvent(new InputEvent('input',{bubbles:true}));return'OK'})()`,
  returnByValue:true});
  await new Promise(r => setTimeout(r, 1500));

  // Send
  await wc(cws, 3, 'Runtime.evaluate', {expression:
    `(()=>{const b=document.querySelector('[data-testid="send-button"]');if(b&&!b.disabled){b.click();return'OK'}return'FAIL'})()`,
  returnByValue:true});

  // Wait for response
  console.log('  Waiting for ChatGPT...');
  await new Promise(r => setTimeout(r, 15000));

  // Some polls for generating state
  for (let i = 0; i < 3; i++) {
    const check = await wc(cws, 4+i, 'Runtime.evaluate', {expression:
      `document.querySelector('[data-message-author-role="assistant"]')?1:0`, returnByValue:true});
    if (check.result?.result?.value === 1) break;
    await new Promise(r => setTimeout(r, 5000));
  }

  let r = await wc(cws, 10, 'Runtime.evaluate', {expression:
    `(()=>{const a=document.querySelectorAll('[data-message-author-role="assistant"]');return a.length?a[a.length-1].innerText.trim():'NF'})()`,
  returnByValue:true});
  return r.result?.result?.value;
}

(async () => {
  const pages = await f('/json/list');
  const cPage = pages.find(p => p.url.indexOf('chatgpt.com') >= 0);
  const gPage = pages.find(p => p.url.indexOf('gemini.google.com') >= 0);

  const cws = new ws_pkg.WebSocket(cPage.webSocketDebuggerUrl);
  const gws = new ws_pkg.WebSocket(gPage.webSocketDebuggerUrl);
  await new Promise((r,rej) => { cws.on('open',r); cws.on('error',rej); setTimeout(()=>rej(new Error('ct')),5000); });
  await new Promise((r,rej) => { gws.on('open',r); gws.on('error',rej); setTimeout(()=>rej(new Error('gt')),5000); });

  // === ROUND 1: ChatGPT answers a question ===
  console.log('=== ROUND 1: ChatGPT ===');
  const c1 = await sendToChatGPT(cws, 'What is 1+1? Just the number.');
  console.log('ChatGPT: ' + c1);
  const c1ok = c1 && c1.indexOf('NF') !== 0;

  // === ROUND 2: Gemini critiques ChatGPT ===
  console.log('\n=== ROUND 2: Gemini critiques ===');
  const g1 = await sendToGemini(gws, 
    'CRITIQUE: ChatGPT was asked "What is 1+1?" and answered: "' + (c1||'no answer') + '"\n\nChallenge this answer. Is it correct? Respond with just the number.');
  console.log('Gemini: ' + g1);
  const g1ok = g1 && g1.indexOf('NF') !== 0 && g1.length > 5;

  // === ROUND 3: ChatGPT responds to Gemini ===
  console.log('\n=== ROUND 3: ChatGPT responds ===');
  const c2 = await sendToChatGPT(cws,
    'Gemini critiqued your answer "1+1" and said: "' + (g1||'no response') + '"\n\nDo you agree? Answer with just the number or a brief correction.');
  console.log('ChatGPT: ' + c2);
  const c2ok = c2 && c2.indexOf('NF') !== 0;

  cws.close();
  gws.close();

  console.log('\n==== VS BRAIN RELAY SMOKE TEST ====');
  console.log('R1 ChatGPT:  ' + (c1ok ? '✅ ' + c1.slice(0,80) : '❌'));
  console.log('R2 Gemini:   ' + (g1ok ? '✅ ' + g1.slice(0,80) : '❌'));
  console.log('R3 ChatGPT:  ' + (c2ok ? '✅ ' + c2.slice(0,80) : '❌'));
  console.log('FULL LOOP:   ' + (c1ok && g1ok && c2ok ? '✅ RELAY WORKS' : '❌ PARTIAL FAIL'));
})().catch(e => console.error('FATAL:', e.message));
