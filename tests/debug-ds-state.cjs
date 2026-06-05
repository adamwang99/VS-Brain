// Check DeepSeek tab state NOW
const WS=require('ws'),http=require('http');
const t=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
function ev(id,e){return new Promise(async(ok)=>{
  const ts=await t();const tab=ts.find(x=>x.id===id);
  if(!tab)return ok('no tab');
  const w=new WS(tab.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:e,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},5000);
})}

(async()=>{
  const ts=await t();
  const d=ts.find(x=>x.url.includes('deepseek.com'));
  console.log('URL:',d.url.slice(0,100));
  console.log('Title:',d.title);
  
  const bd=await ev(d.id,'document.body.innerText.slice(0,300)');
  console.log('Body:',bd);
  
  const ta=await ev(d.id,'document.querySelectorAll("textarea").length');
  const sb=await ev(d.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');return b?"btn-ok":"btn-none"})()');
  console.log('textarea:',ta,'sendBtn:',sb);
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
