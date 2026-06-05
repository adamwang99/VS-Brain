// Check Gemini DOM in detail after a send to understand model-response format
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},10000);
});

(async()=>{
  const ts=await tabs();const g=ts.find(t=>t.url.includes('gemini.google.com'));
  if(!g){console.log('no gemini');return;}
  
  const checks=[
    // What content exists in model-response
    "document.querySelector('model-response')?.outerHTML?.slice(0,500)||'no model-response'",
    // How many model-response elements
    "document.querySelectorAll('model-response').length",
    // Check innerHTML instead of textContent
    "(function(){var m=document.querySelector('model-response');if(!m)return'none';return{mHtml:m.innerHTML.slice(0,300),mText:m.textContent.slice(0,200)}})()",
    // Check for shadow DOM
    "document.querySelector('model-response')?.shadowRoot?.innerHTML?.slice(0,300)||'no shadow'",
    // Check if there are multiple response nodes
    "document.querySelectorAll('model-response, div[class*=response], div[class*=answer]').length",
    // What does the full text extracted look like?
    "(function(){var m=document.querySelector('model-response');if(!m)return'none';var all=[];m.querySelectorAll('*').forEach(function(e){if(e.childNodes.length===1&&e.childNodes[0].nodeType===3&&e.childNodes[0].textContent.trim())all.push(e.tagName+':'+e.textContent.trim().slice(0,60))});return JSON.stringify(all.slice(0,30))})()",
  ];
  
  for(const c of checks){
    const r=await ev(g.id,c);
    console.log((r||'N/A').toString().slice(0,500));
    console.log('---');
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
