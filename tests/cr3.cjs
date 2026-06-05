const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

(async()=>{
 const pages=await f('/json/list');
 const c=pages.find(p=>p.url.indexOf('chatgpt.com')>=0);
 const ws=new ws_pkg.WebSocket(c.webSocketDebuggerUrl);
 await new Promise((r,rej)=>{ws.on('open',r);ws.on('error',rej);setTimeout(()=>rej(new Error('t')),5000)});

 // Wait a bit more for generation
 let r=await wc(ws,1,'Runtime.evaluate',{expression:'JSON.stringify({title:document.title,asstCount:document.querySelectorAll(\'[data-message-author-role="assistant"]\').length,lastAsst:(document.querySelectorAll(\'[data-message-author-role="assistant"]\')[document.querySelectorAll(\'[data-message-author-role="assistant"]\').length-1]?.innerText||"").slice(0,300),genBtn:!!document.querySelector(\'button[class*="stop"]\')})',returnByValue:true});
 console.log('NOW:',r.result?.result?.value);

 // If still empty, try clicking the retry button or sending again
 // Actually, just check if there's a generating indicator
 r=await wc(ws,2,'Runtime.evaluate',{expression:'document.querySelectorAll(\'[class*="generating"], [class*="stop"]\').length',returnByValue:true});
 console.log('Generating elements:',r.result?.result?.value);

 // Try to get the full page text
 r=await wc(ws,3,'Runtime.evaluate',{expression:'document.body.innerText.replace(/\\n{3,}/g,"\\n\\n").slice(0,800)',returnByValue:true});
 console.log('BODY:',r.result?.result?.value);

 ws.close();
})().catch(e=>console.error(e.message));
