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

  // Check exact current state
  let r = await wc(gws, 1, 'Runtime.evaluate', {expression:
    'JSON.stringify({url:location.href, title:document.title, uq:document.querySelectorAll("user-query").length, mr:document.querySelectorAll("model-response").length, isGenerating:!!document.querySelector(".stop-generation")})',
  returnByValue:true});
  console.log('STATE:', r.result?.result?.value);

  // If on /app, check inputs
  r = await wc(gws, 2, 'Runtime.evaluate', {expression:
    'JSON.stringify({contentEditable:Array.from(document.querySelectorAll("[contenteditable=\\"true\\"]")).map(e=>({text:(e.innerText||"").slice(0,50),visible:!!e.offsetParent})), bodySlice:document.body.innerText.slice(0,300)})',
  returnByValue:true});
  console.log('BODY:', r.result?.result?.value);

  gws.close();
})().catch(e=>console.error(e.message));
