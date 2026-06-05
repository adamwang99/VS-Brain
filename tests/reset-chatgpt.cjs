// Quick: navigate ChatGPT back to working conversation + send test message
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{const ts=await tabs();const t=ts.find(x=>x.id===id);if(!t)return rej();const w=new WS(t.webSocketDebuggerUrl);w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr}})));w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});w.on('error',rej);setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},10000)});

(async()=>{
  const ts=await tabs();
  const c=ts.find(t=>t.url.includes('chatgpt.com'));
  if(!c){console.log('no chat');return;}
  
  // Navigate to original conversation
  console.log('Navigate to old conv...');
  await new Promise((ok,rej)=>{
    const w=new WS(c.webSocketDebuggerUrl);
    w.on('open',()=>w.send(JSON.stringify({id:1,method:'Page.navigate',params:{url:'https://chatgpt.com/c/6a1fbc7e-e058-83ec-8e6c-8f8121efc324'}})));
    w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();ok()}});
    w.on('error',rej);
    setTimeout(()=>{try{w.close()}catch{};rej('navTO')},15000);
  });
  await dly(4000);
  console.log('URL:',await ev(c.id,'window.location.href'));
  
  // Send simple test
  await ev(c.id,'(function(){var e=document.querySelector("[contenteditable=\\"true\\"]");e.focus();e.innerText="";document.execCommand("insertText",false,"Hello world");var b=document.querySelector("[data-testid=\\"send-button\\"]");if(b)b.click()})()');
  console.log('Sent test message');
  
  await dly(10000);
  console.log('URL:',await ev(c.id,'window.location.href'));
  console.log('Msgs:',await ev(c.id,'document.querySelectorAll("[data-message-author-role=assistant]").length'));
  console.log('Last innerText:',await ev(c.id,'(function(){var es=document.querySelectorAll("[data-message-author-role=\\"assistant\\"]");return es.length?es[es.length-1].innerText:"none"})()'));
  console.log('Last textContent:',await ev(c.id,'(function(){var es=document.querySelectorAll("[data-message-author-role=\\"assistant\\"]");return es.length?es[es.length-1].textContent:"none"})()'));
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
