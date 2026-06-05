// DeepSeek send button + interaction test
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

  // Find all div[role=button] near textarea or with send-icon
  const checks=[
    // Get all role=button divs with their position relative to textarea
    'JSON.stringify(Array.from(document.querySelectorAll("[role=button]")).filter(e=>e.offsetParent).map(b=>({text:b.innerText?.slice(0,30),aria:b.getAttribute("aria-label")||"no-aria",cls:b.className?.slice(0,50)||"no-cls",parent:b.parentElement?.className?.slice(0,30)})).slice(0,20))',
    // Find elements near textarea or with send-icon
    'document.querySelector("[class*=send],[class*=submit],[aria-label*=send],[aria-label*=gửi],[aria-label*=Gửi]") ? "found send":"no send btn"',
    // Try to find the send mechanism: what's the parent of textarea?
    'JSON.stringify((function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no ta";var p=t.parentElement;var btns=p.querySelectorAll("[role=button],button");return{parent:p.className?.slice(0,50),btns:Array.from(btns).map(b=>({text:b.innerText?.slice(0,20),cls:b.className?.slice(0,40)}))}})())',
    // Check if there's a form
    'document.querySelector("form")?.outerHTML?.slice(0,200)||"no form"',
    // Check what classes are around the textarea
    '(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no ta";var p=t;var path=[];for(var i=0;i<5;i++){if(!p)break;path.push(p.tagName+"."+(p.className||"").slice(0,30));p=p.parentElement}return path.join(" > ")})()',
    // Simply try: find all elements inline near textarea
    '(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no ta";var sibs=t.parentElement.children;return Array.from(sibs).map(c=>c.tagName+"|"+(c.className||"").slice(0,30)+"|"+c.getAttribute("role")).join("\\n")})()',
  ];

  for(const c of checks){
    const r=await ev(ds.id, c);
    console.log('---:',(r||'').toString().slice(0,500));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
