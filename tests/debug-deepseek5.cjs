// DeepSeek: find send button + native value setter
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
  
  const checks=[
    // The 3 buttons found earlier — check their exact selectors
    'JSON.stringify(Array.from(document.querySelectorAll("[role=button]")).filter(e=>e.offsetParent).map((b,i)=>({i:i,cls:b.className?.slice(0,80),html:b.outerHTML?.slice(0,100),child:b.firstElementChild?.tagName,rect:b.getBoundingClientRect()})).filter(b=>b.cls))',
    // Check if there's a button near or inside the textarea wrapper
    '(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no";var wrap=t.closest("div");while(wrap&&wrap.children.length===1)wrap=wrap.parentElement;var btn=wrap.querySelector("[role=button],button");return btn?"btn:"+btn.className?.slice(0,40):"no btn at "+wrap.className?.slice(0,40)})()',
    // Also look at the parent of the textarea wrapper that has buttons
    '(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no";var div=t.parentElement;for(var i=0;i<10;i++){if(!div)break;var btns=div.querySelectorAll("[role=button],button");if(btns.length>0)return div.tagName+"."+(div.className?.slice(0,60)||"")+" btns:"+btns.length;div=div.parentElement}return"not found"})()',
    // Try native value setter first to set React state
    'JSON.stringify({html:document.documentElement.outerHTML.slice(5000,7000)})',
    // Check if there's a send-icon SVG
    'Array.from(document.querySelectorAll("svg")).filter(s=>s.offsetParent).slice(0,5).map(s=>{var p=s.parentElement;return{pTag:p.tagName,pCls:p.className?.slice(0,60),pRole:p.getAttribute("role")||"no"}}).filter(x=>x.pCls)',
    // Check the ds-scroll-area parent for any interactive elements
    '(function(){var ta=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!ta)return"no";var p=ta.parentElement;while(p){var all=p.querySelectorAll("[role=button],button,a");if(all.length>0)return {pCls:p.className?.slice(0,40),all:Array.from(all).map(a=>a.className?.slice(0,80))};p=p.parentElement}return"none"})()',
  ];
  
  for(const c of checks){
    const r=await ev(ds.id, c);
    console.log('---:',(r||'N/A').toString().slice(0,1000));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
