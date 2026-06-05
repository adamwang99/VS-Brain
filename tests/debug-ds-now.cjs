// Quick debug: check DeepSeek page DOM
const WS=require('ws'),http=require('http');
const tabs=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));

function ev(id,expr){return new Promise(async(ok)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return ok('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||'undef'))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},5000);
})}

(async()=>{
  const ts=await tabs();
  const d=ts.find(t=>t.url.includes('chat.deepseek.com'));
  console.log('URL:',d.url.slice(0,120));
  console.log('Title:',d.title);

  // Check messages
  const msgs=await ev(d.id,'document.querySelectorAll(".ds-message").length');
  console.log('.ds-message count:', msgs);

  // Check all div with class containing ds-
  const divs=await ev(d.id,'document.querySelectorAll("[class*=ds]").length');
  console.log('[class*=ds] count:', divs);

  // Check textarea
  const ta=await ev(d.id,'document.querySelectorAll("textarea").length');
  console.log('textarea count:', ta);

  // Check all role=button
  const btns=await ev(d.id,'document.querySelectorAll("[role=button]").length');
  console.log('[role=button] count:', btns);

  // Check body innerText first 500 chars
  const txt=await ev(d.id,'document.body.innerText.slice(0,500)');
  console.log('Body text:', txt);

  // Check for the send button
  const snd=await ev(d.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');return b?"found:"+(b.offsetWidth+"x"+b.offsetHeight):"none"})()');
  console.log('Send button:', snd);
})();
