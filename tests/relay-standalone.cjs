const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

(async () => {
  const pages = await f('/json/list');
  const cPage = pages.find(p => p.url.indexOf('chatgpt.com') >= 0);
  const cws = new ws_pkg.WebSocket(cPage.webSocketDebuggerUrl);
  await new Promise(r => cws.on('open',r));

  // Simple fresh chat with plain text
  await wc(cws, 1, 'Page.navigate', {url:'https://chatgpt.com/'});
  await new Promise(r => setTimeout(r, 6000));

  await wc(cws, 2, 'Runtime.evaluate', {expression:
    '(()=>{const e=document.querySelector("#prompt-textarea");if(!e)return"NF";e.focus();e.innerText="What is 2+2? Just the number.";e.dispatchEvent(new InputEvent("input",{bubbles:true}));return"OK"})()',
  returnByValue:true});
  await new Promise(r => setTimeout(r, 1500));

  await wc(cws, 3, 'Runtime.evaluate', {expression:
    '(()=>{const b=document.querySelector(\'[data-testid="send-button"]\');if(b&&!b.disabled){b.click();return"OK"}return"FAIL"})()',
  returnByValue:true});

  console.log('Waiting for ChatGPT to answer 2+2...');
  await new Promise(r => setTimeout(r, 15000));

  let r = await wc(cws, 4, 'Runtime.evaluate', {expression:
    '(()=>{const a=document.querySelectorAll(\'[data-message-author-role="assistant"]\');return a.length?a[a.length-1].innerText.trim().slice(0,300):"NF"})()',
  returnByValue:true});
  const answer = r.result?.result?.value;
  console.log('Answer:', answer);
  const ok = answer && answer.indexOf('NF') !== 0 && answer.length > 0;
  console.log('ChatGPT standalone:', ok ? '✅' : '❌');

  // Now do the relay: feed ChatGPT a critique from Gemini
  await wc(cws, 5, 'Runtime.evaluate', {expression:
    '(()=>{const e=document.querySelector("#prompt-textarea");if(!e)return"NF";e.focus();e.innerText="Critique: For 2+2 you said: ' + (ok ? '4' : 'nothing') + '. Agree? Answer just the number.";e.dispatchEvent(new InputEvent("input",{bubbles:true}));return"OK"})()',
  returnByValue:true});
  await new Promise(r => setTimeout(r, 1500));

  await wc(cws, 6, 'Runtime.evaluate', {expression:
    '(()=>{const b=document.querySelector(\'[data-testid="send-button"]\');if(b&&!b.disabled){b.click();return"OK"}return"FAIL"})()',
  returnByValue:true});

  console.log('Waiting for response to critique...');
  await new Promise(r => setTimeout(r, 15000));

  r = await wc(cws, 7, 'Runtime.evaluate', {expression:
    '(()=>{const a=document.querySelectorAll(\'[data-message-author-role="assistant"]\');return a.length?a[a.length-1].innerText.trim().slice(0,300):"NF"})()',
  returnByValue:true});
  const c2 = r.result?.result?.value;
  const c2ok = c2 && c2.indexOf('NF') !== 0 && c2.length > 0;

  console.log('Critique response:', c2ok ? '✅ ' + c2 : '❌ ' + c2);
  cws.close();
})().catch(e => console.error('FATAL:', e.message));
