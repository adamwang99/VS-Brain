// Quick check: ChatGPT fresh thread navigation
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{const ts=await tabs();const t=ts.find(x=>x.id===id);if(!t)return rej();const w=new WS(t.webSocketDebuggerUrl);w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr}})));w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});w.on('error',rej);setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},8000)});

(async()=>{
  const ts=await tabs();
  const c=ts.find(t=>t.url.includes('chatgpt.com'));
  if(!c){console.log('no chat');return;}

  // Can we find "New chat" or equivalent button?
  const checks=[
    "Array.from(document.querySelectorAll('[role=button],button,a')).filter(e=>e.offsetParent&&(e.innerText.includes('New')||e.innerText.includes('Chat')||e.innerText.includes('Mới')||e.innerText.includes('Tạo'))).map(e=>(e.innerText.slice(0,40)+'|'+e.getAttribute('aria-label')))",
    "Array.from(document.querySelectorAll('a')).filter(a=>a.href&&a.href.includes('chatgpt.com')).map(a=>a.href+'|'+a.innerText.slice(0,30)).slice(0,10)",
    "document.querySelector('[aria-label=\"New chat\"],[aria-label*=\"new\"],[aria-label*=\"New\"]')?'found new chat':'no new chat aria'",
    // Try sidebar buttons
    "JSON.stringify({sbar:document.querySelector('[class*=sidebar],[class*=nav]')?.className?.slice(0,50),url:window.location.href})",
    // Navigate to root
    "window.location.href",
  ];

  for(const ck of checks){
    const r=await ev(c.id,ck);
    console.log((r||'N/A').toString().slice(0,300));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
