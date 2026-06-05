// Find ChatGPT inputs+buttons - stringify inside expression
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
  
  const expr = `JSON.stringify({a:Array.from(document.querySelectorAll("button[data-testid]")).map(b=>b.getAttribute("data-testid")),b:document.querySelector("form")?"form found":"no form",c:document.querySelectorAll("[contenteditable]").length,d:document.querySelector("[contenteditable=true]")?.getAttribute("placeholder")||"no ph"})`;
  
  const r = await wsEval(ws, expr);
  console.log(r.value);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
