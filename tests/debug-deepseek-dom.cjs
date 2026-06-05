// Debug DeepSeek DOM structure
const WS=require('ws'), http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)));r.on('error',()=>{})}));
const ev=(id,expr)=>new Promise(async o=>{try{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;o(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',()=>o('err'));
  setTimeout(()=>{try{w.close()}catch{};o('TO')},8000);
}catch(x){o(''+x)}});

(async()=>{
  const ts=await tabs();const ds=ts.find(t=>t.url.includes('deepseek.com'));
  if(!ds){console.log('no tab');return;}
  console.log('URL:',ds.url);
  
  const checks=[
    'document.title',
    'window.location.href',
    'document.querySelector("textarea") ? "has textarea" : "no textarea"',
    'document.querySelector("[contenteditable]") ? "has contenteditable" : "no contenteditable"',
    'document.querySelectorAll("button").length',
    'JSON.stringify(Array.from(document.querySelectorAll("textarea,[contenteditable]")).map(e=>({tag:e.tagName,placeholder:e.placeholder||"no-ph",className:e.className?e.className.slice(0,40):"no-cls"})))',
    'JSON.stringify(Array.from(document.querySelectorAll("button")).slice(-10).map(b=>b.innerText.slice(0,30)))',
    'JSON.stringify(Array.from(document.querySelectorAll("[role=textbox]")).map(e=>e.tagName))',
    // Check for common input patterns
    'document.querySelector("#chat-input, .chat-input, [class*=input], [class*=editor]") ? "found chat input" : "not found"',
    // Check any div that looks like an editor
    'JSON.stringify(Array.from(document.querySelectorAll("div[contenteditable]")).map(e=>({role:e.getAttribute("role"),contenteditable:e.getAttribute("contenteditable"),innerText:e.innerText.slice(0,20)})))',
  ];
  
  for(const c of checks){
    const r=await ev(ds.id, c);
    console.log('-', r);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
