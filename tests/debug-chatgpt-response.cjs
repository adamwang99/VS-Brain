// Debug: what's the ChatGPT response innerText after fresh thread?
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{const ts=await tabs();const t=ts.find(x=>x.id===id);if(!t)return rej('no');const w=new WS(t.webSocketDebuggerUrl);w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr}})));w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});w.on('error',rej);setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},8000)});

(async()=>{
  const ts=await tabs();
  const c=ts.find(t=>t.url.includes('chatgpt.com'));
  if(!c){console.log('no chat');return;}
  
  const checks=[
    'window.location.href',
    'document.querySelectorAll("[data-message-author-role=assistant]").length',
    // Get ALL assistant elements and their text
    '(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");var r=[];es.forEach(function(e,i){r.push(i+":"+JSON.stringify(e.innerText))});return r.join("|")})()',
    // Check if there's an error placeholder
    'document.querySelector("[role=alert], [class*=error], [data-redacted]")?"err":null',
    // Check all elements with innerText
    '(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");return es.length+" es";})()',
    // Try outerHTML
    '(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");return es.length?es[0].outerHTML.slice(0,300):"no es"})()',
    // Is it null? try textContent
    '(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");return es.length?JSON.stringify({inner:es[0].innerText,text:es[0].textContent,html:es[0].innerHTML.slice(0,100)}):"no es"})()',
    // Maybe the contenteditable still has text
    'document.querySelector("[contenteditable]")?.innerText?.length||"no inp"',
    // Check all body content
    'document.body.innerText.slice(0,300)',
  ];
  
  for(const ck of checks){
    const r=await ev(c.id,ck);
    console.log(r||'null');
    console.log('---');
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
