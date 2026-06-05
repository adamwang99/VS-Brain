const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p){return new Promise((r,rej)=>http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej));}
function wc(ws,id,m,p){return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)});}

(async()=>{
 const pages=await f('/json/list');
 const c=pages.find(p=>p.url.indexOf('chatgpt.com')>=0);
 const ws=new ws_pkg.WebSocket(c.webSocketDebuggerUrl);
 await new Promise((r,rej)=>{ws.on('open',r);ws.on('error',rej);setTimeout(()=>rej(new Error('t')),5000)});
 let r=await wc(ws,1,'Runtime.evaluate',{expression:'JSON.stringify({url:location.href,title:document.title,inputText:(document.querySelector("#prompt-textarea")?.innerText||"").slice(0,200),asstCount:document.querySelectorAll(\'[data-message-author-role="assistant"]\').length,lastAsst:(document.querySelectorAll(\'[data-message-author-role="assistant"]\')[document.querySelectorAll(\'[data-message-author-role="assistant"]\').length-1]?.innerText||"").slice(0,200)})',returnByValue:true});
 console.log(r.result?.result?.value);
 ws.close();
})().catch(e=>console.error(e.message));
