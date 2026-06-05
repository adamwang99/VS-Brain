// Quick ChatGPT state check
const WebSocket = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222/json';

function wsEval(wsUrl, expr) {
  return new Promise((ok,err) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open',()=>{ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}}));});
    ws.on('message',d=>{const r=JSON.parse(d.toString());if(r.id===1){ws.close();ok(r.result.result);}});
    ws.on('error',err);
    setTimeout(()=>{try{ws.close()}catch{};err('timeout');},8000);
  });
}

(async () => {
  const tabs = await new Promise((ok,err)=>http.get(CDP, r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok(JSON.parse(d)));r.on('error',err)}));
  const t = tabs.find(t=>t.url.includes('chatgpt.com'));
  if(!t){console.log('no tab');return;}
  console.log('URL:', t.url);
  const ws = t.webSocketDebuggerUrl;
  
  const checks = [
    'window.location.href',
    'document.querySelector("[contenteditable=true]") ? "has contenteditable" : "no contenteditable"',
    'document.querySelectorAll("[data-message-author-role]").length',
    'document.title',
    // Check if new conversation dialog/modal exists
    'document.querySelector("[role=\\"dialog\\"],[role=\\"alertdialog\\"]") ? "has dialog" : "no dialog"',
    'document.querySelector("textarea") ? "has textarea" : "no textarea"',
    'Array.from(document.querySelectorAll("button")).length',
    'Array.from(document.querySelectorAll("form")).length',
  ];
  
  for (const c of checks) {
    console.log(JSON.stringify((await wsEval(ws, c)).value));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
