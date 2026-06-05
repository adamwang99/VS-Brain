// Quick check: what does ChatGPT innerText actually contain?
const WS = require('ws');
const http = require('http');
const C = 'http://127.0.0.1:9222/json';

const tabs = () => new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)));r.on('error',e=>console.error(e))}));

function evalTab(id, expr) {
  return new Promise(async o=>{
    const ts=await tabs(); const t=ts.find(x=>x.id===id);
    const w=new WS(t.webSocketDebuggerUrl);
    w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
    w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();o(r.result.result.value||r.result.result.description||null)}});
    w.on('error',e=>console.error(e));
    setTimeout(()=>{try{w.close()}catch{};o('TO')},8000);
  });
}

(async () => {
  const ts = await tabs();
  const chatId = ts.find(t=>t.url.includes('chatgpt.com')).id;
  console.log('URL:', ts.find(t=>t.url.includes('chatgpt.com')).url);
  
  const checks = [
    'document.querySelectorAll("[data-message-author-role]").length',
    'Array.from(document.querySelectorAll("[data-message-author-role]")).slice(-4).map(e=>e.getAttribute("data-message-author-role")+":"+e.innerText.slice(0,50))',
    '(function(){const e=document.querySelector("[data-message-author-role=assistant]:last-child");if(!e)return"no-last";return "txt:"+e.innerText.slice(0,100)+" LEN:"+e.innerText.length})()',
    'document.querySelector("[data-testid=stop-button]") ? "generating" : "idle"',
    // Check ALL last child text verbatim
    '(function(){const ms=document.querySelectorAll("[data-message-author-role=assistant]");const last=ms[ms.length-1];return "TOTAL:"+ms.length+" LAST:"+last.innerText.slice(0,200)})()',
    // Check if there's a send button visible (i.e. done generating)
    'document.querySelector("[data-testid=send-button]") ? "send-visible" : "send-hidden"',
  ];
  
  for (const c of checks) {
    console.log(await evalTab(chatId, c));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
