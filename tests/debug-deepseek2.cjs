// Debug DeepSeek — deeper check (wait + login state)
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
const delay=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const ts=await tabs();const ds=ts.find(t=>t.url.includes('deepseek.com'));
  if(!ds){console.log('no tab');return;}
  console.log('URL:',ds.url);
  
  // Check page state
  const checks=[
    'document.body.innerText.slice(0,500)',
    'document.querySelectorAll("*").length',
    'window.location.href',
    'document.querySelector("textarea")?.outerHTML?.slice(0,200)',
    'document.querySelector("form") ? "has form":"no form"',
    'document.querySelector("a")?.innerText?.slice(0,50)',
    'JSON.stringify(Array.from(document.querySelectorAll("[role=button],button")).map(e=>e.innerText?.slice(0,30)||e.tagName))',
    // Check if there's a login/signup element
    'document.querySelector("[class*=login],[class*=sign],[class*=auth]") ? "login found":"no login"',
    'document.querySelector("input[type=email],input[type=password]") ? "has auth inputs":"no auth inputs"',
    'document.querySelectorAll("a").length',
    'Array.from(document.querySelectorAll("a")).map(a=>a.href+"|"+a.innerText.slice(0,30)).slice(0,20)',
  ];
  
  for(const c of checks){
    const r=await ev(ds.id, c);
    console.log('-',(r||'').toString().slice(0,400));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
