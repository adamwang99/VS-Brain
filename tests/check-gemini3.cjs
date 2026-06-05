const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p){return new Promise((r,rej)=>http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej));}
function wc(ws,id,m,p={}){return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)});}

(async()=>{
  const pages = await f('/json/list');
  const gemini=pages.find(p=>p.url?.includes('gemini.google.com'));
  const gws=new ws_pkg.WebSocket(gemini.webSocketDebuggerUrl);
  await new Promise((r,rej)=>{gws.on('open',r);gws.on('error',rej);setTimeout(()=>rej(new Error('t')),5000)});

  // Check the actual DOM content of the conversation
  const r=await wc(gws,1,'Runtime.evaluate',{expression:\`
(() => {
  // Find user query elements
  const queries = document.querySelectorAll('user-query, [class*="query"], [class*="user"]');
  const responses = document.querySelectorAll('model-response');
  let result = {queries:[], responses:[]};
  
  queries.forEach(q => {
    if (q.innerText.trim()) result.queries.push(q.innerText.trim().slice(0,300));
  });
  
  // Also check all text-containing elements after the response
  // Get the full inner text of the main area
  const main = document.querySelector('main') || document.body;
  const text = main.innerText;
  
  // Find the position of "Gemini" heading
  const gIdx = text.lastIndexOf('Gemini');
  
  return JSON.stringify({
    queryCount: queries.length,
    queries: result.queries,
    responseCount: responses.length,
    responseTexts: Array.from(responses).map(r => ({
      text: r.innerText.trim().slice(0,300),
      len: r.innerText.length,
      htmlLen: r.innerHTML.length
    })),
    mainText: text.slice(0,800),
    mainTextAfter: text.slice(Math.max(0,gIdx-50), gIdx+500)
  });
})()
\`,returnByValue:true});
  console.log(r.result?.result?.value);
  gws.close();
})().catch(e=>console.error(e.message));
