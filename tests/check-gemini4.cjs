const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p){return new Promise((r,rej)=>http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej));}
function wc(ws,id,m,p){return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)});}

(async()=>{
  const pages = await f('/json/list');
  const gemini=pages.find(p=>p.url.indexOf('gemini.google.com')>=0);
  const gws=new ws_pkg.WebSocket(gemini.webSocketDebuggerUrl);
  await new Promise((r,rej)=>{gws.on('open',r);gws.on('error',rej);setTimeout(()=>rej(new Error('t')),5000)});

  // Get inner text
  const r=await wc(gws,1,'Runtime.evaluate',{expression:
    'document.querySelector("[role=textbox]") ? document.querySelector("[role=textbox]").innerText.slice(0,500) : "no-textbox"',
    returnByValue:true});
  console.log('INPUT TEXT:', r.result?.result?.value);

  // Check all model elements
  const r2=await wc(gws,2,'Runtime.evaluate',{expression:
    'document.querySelector("model-response") ? document.querySelector("model-response").innerHTML.slice(0,1000) : "no-model"',
    returnByValue:true});
  console.log('MODEL HTML:', r2.result?.result?.value);

  gws.close();
})().catch(e=>console.error(e.message));
