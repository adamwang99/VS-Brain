// DeepSeek: find send button in whole page
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
    // ALL buttons/role=button with their text and position
    'Array.from(document.querySelectorAll("button,[role=button]")).filter(e=>e.offsetParent).map((b,i)=>({i:i,tag:b.tagName,text:b.innerText?.slice(0,40),aria:b.getAttribute("aria-label"),title:b.title,cls:b.className?.slice(0,80),dataAttr:Object.entries(b.dataset).map(([k,v])=>k+"="+v?.slice(0,20)).join(",")})).filter(b=>b.text||b.aria||b.title)',
    // Check elements inside the main chat container (not sidebar)
    '(function(){var main=document.querySelector("main,[role=main],.chat-container,[class*=chat]");var path=main?"found main."+main.className?.slice(0,30):"no main";var txt=document.querySelector("textarea");var wrap=txt?.closest("[class*=input],[class*=chat-input],[class*=composer]");return{main:path,wrapper:wrap?wrap.className?.slice(0,50):"no-wrapper"}})()',
    // Just get ALL visible images/buttons/icons (send is usually an icon)
    'Array.from(document.querySelectorAll("svg,img")).filter(e=>e.offsetParent).map(e=>(e.parentElement?.className?.slice(0,60)||"")+"|"+(e.parentElement?.getAttribute("aria-label")||"")).filter(s=>s.length>5).slice(0,15)',
    // Check the full toolbar area
    '(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no ta";var root=t.closest("div");while(root&&root.children.length<5)root=root.parentElement; if(!root)return"no root";return Array.from(root.querySelectorAll("[role=button],button")).map(b=>b.getAttribute("aria-label")||b.title||b.innerText?.slice(0,20)).filter(Boolean)})()',
  ];

  for(const c of checks){
    const r=await ev(ds.id, c);
    console.log('\n---');
    console.log((r||'N/A').toString().slice(0,800));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
