// Find ChatGPT send button + typeable input
const WebSocket = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222/json';

function wsEval(wsUrl, expr) {
  return new Promise((ok,err) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open',()=>{ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}}));});
    ws.on('message',d=>{const r=JSON.parse(d.toString());if(r.id===1){ws.close();ok(r.result);}});
    ws.on('error',err);
    setTimeout(()=>{try{ws.close()}catch{};err('timeout');},8000);
  });
}

(async () => {
  const tabs = await new Promise((ok,err)=>http.get(CDP, r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok(JSON.parse(d)));r.on('error',err)}));
  const t = tabs.find(t=>t.url.includes('chatgpt.com'));
  if(!t){console.log('no tab');return;}
  const ws = t.webSocketDebuggerUrl;
  
  const checks = [
    // ALL data-testid on buttons
    'Array.from(document.querySelectorAll("button[data-testid]")).map(b=>b.getAttribute("data-testid")).join("\\n")',
    // Find any button that looks like send
    `document.querySelector("button[data-testid*='send'], button[aria-label*='Send'], button[aria-label*='send'], button[aria-label*='Gửi']") ? 'found send' : 'no send'`,
    // Check the form
    'document.querySelector("form") ? document.querySelector("form").innerHTML.slice(0,300) : "no form"',
    // Check all textboxes/editable roles
    'Array.from(document.querySelectorAll("[role=\\"textbox\\"],[contenteditable]")).map(e=>[e.tagName,e.getAttribute("role"),e.getAttribute("contenteditable"),e.id,e.className.slice(0,30)].filter(Boolean).join("|"))',
  ];
  
  for (const c of checks) {
    const r = await wsEval(ws, c);
    console.log('---:', (r.value || 'N/A').toString().slice(0,500));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
