const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

async function geminiSendAndWait(gws, text, waitMs) {
  // Navigate to fresh Gemini app
  await wc(gws, 1, 'Page.navigate', {url:'https://gemini.google.com/app'});
  console.log('  [Gemini] navigated /app, waiting hydrate...');
  await new Promise(r => setTimeout(r, 8000));

  // Type using innerText
  await wc(gws, 2, 'Runtime.evaluate', {expression:
    '(()=>{const e=document.querySelector(\'[contenteditable="true"]\');if(!e)return"NF";e.focus();e.innerText='+JSON.stringify(text)+';e.dispatchEvent(new Event("input",{bubbles:true}));return"OK"})()',
  returnByValue:true});
  await new Promise(r => setTimeout(r, 2000));

  // Send via Enter
  await wc(gws, 3, 'Runtime.evaluate', {expression:
    '(()=>{const e=document.querySelector(\'[contenteditable="true"]\');if(!e)return"NF";e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}));return"ENTER"})()',
  returnByValue:true});
  
  console.log('  [Gemini] waiting ' + (waitMs/1000) + 's for response...');
  await new Promise(r => setTimeout(r, waitMs));

  // Extract using textContent (NOT innerText - innerText fails due to CSS pending class)
  let r = await wc(gws, 4, 'Runtime.evaluate', {expression:
    '(()=>{const mr=document.querySelector("model-response");if(!mr)return"NF";const md=mr.querySelector("message-content");if(!md)return mr.textContent.trim().slice(0,500);return md.textContent.trim().slice(0,500)})()',
  returnByValue:true});
  return r.result?.result?.value;
}

async function chatgptSendAndWait(cws, text, waitMs) {
  await wc(cws, 1, 'Page.navigate', {url:'https://chatgpt.com/'});
  console.log('  [ChatGPT] navigated, waiting hydrate...');
  await new Promise(r => setTimeout(r, 6000));

  await wc(cws, 2, 'Runtime.evaluate', {expression:
    '(()=>{const e=document.querySelector("#prompt-textarea");if(!e)return"NF";e.focus();e.innerText='+JSON.stringify(text)+';e.dispatchEvent(new InputEvent("input",{bubbles:true}));return"OK"})()',
  returnByValue:true});
  await new Promise(r => setTimeout(r, 1500));

  await wc(cws, 3, 'Runtime.evaluate', {expression:
    '(()=>{const b=document.querySelector(\'[data-testid="send-button"]\');if(b&&!b.disabled){b.click();return"OK"}return"FAIL"})()',
  returnByValue:true});

  console.log('  [ChatGPT] waiting ' + (waitMs/1000) + 's for response...');
  await new Promise(r => setTimeout(r, waitMs));

  let r = await wc(cws, 4, 'Runtime.evaluate', {expression:
    '(()=>{const a=document.querySelectorAll(\'[data-message-author-role="assistant"]\');return a.length?a[a.length-1].innerText.trim().slice(0,500):"NF"})()',
  returnByValue:true});
  return r.result?.result?.value;
}

(async () => {
  const pages = await f('/json/list');
  const cPage = pages.find(p => p.url.indexOf('chatgpt.com') >= 0);
  const gPage = pages.find(p => p.url.indexOf('gemini.google.com') >= 0);
  const cws = new ws_pkg.WebSocket(cPage.webSocketDebuggerUrl);
  const gws = new ws_pkg.WebSocket(gPage.webSocketDebuggerUrl);
  await Promise.all([new Promise(r=>cws.on('open',r)), new Promise(r=>gws.on('open',r))]);
  console.log('Connected to both tabs.\n');

  // === ROUND 1: ChatGPT answers ===
  console.log('=== ROUND 1: ChatGPT → "1+1=?" ===');
  const c1 = await chatgptSendAndWait(cws, 'What is 1+1? Just the number.', 12000);
  console.log('  ChatGPT R1: ' + c1 + '\n');

  // === ROUND 2: Gemini critiques ===
  console.log('=== ROUND 2: Gemini critiques ChatGPT ===');
  const g1 = await geminiSendAndWait(gws,
    'CRITIQUE: ChatGPT asked "What is 1+1?" and answered: "' + (c1||'no answer') +
    '".\n\nIs this correct? Reply with just the number.', 30000);
  console.log('  Gemini R2: ' + g1 + '\n');

  // === ROUND 3: ChatGPT responds to Gemini's critique ===
  console.log('=== ROUND 3: ChatGPT responds to Gemini ===');
  const c2 = await chatgptSendAndWait(cws,
    'Gemini critiqued your answer to "1+1=?" and said: "' + (g1||'no response') +
    '".\n\nDo you agree? Reply with just the number.', 12000);
  console.log('  ChatGPT R3: ' + c2 + '\n');

  cws.close();
  gws.close();

  const c1ok = c1 && c1.indexOf('NF') !== 0;
  const g1ok = g1 && g1.indexOf('NF') !== 0 && g1.length > 0;
  const c2ok = c2 && c2.indexOf('NF') !== 0;

  console.log('==== VS BRAIN v0.8.68 RELAY SMOKE TEST ====');
  console.log('Round 1 (ChatGPT → question):      ' + (c1ok ? '✅ "' + c1.slice(0,60) + '"' : '❌ FAIL'));
  console.log('Round 2 (Gemini → critique):       ' + (g1ok ? '✅ "' + g1.slice(0,60) + '"' : '❌ FAIL'));
  console.log('Round 3 (ChatGPT → respond):       ' + (c2ok ? '✅ "' + c2.slice(0,60) + '"' : '❌ FAIL'));
  console.log('');
  console.log('FULL RELAY LOOP: ' + (c1ok && g1ok && c2ok ? '✅✅✅ PASS' : '❌ PARTIAL FAIL'));
})().catch(e => console.error('FATAL:', e.message));
