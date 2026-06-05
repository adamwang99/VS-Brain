// DeepSeek DOM deep dive — find message containers after sending
const WS=require('ws'),http=require('http');
const J=JSON.stringify;
const tabs=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));

function ev(id,expr){return new Promise(async(ok)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return ok('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||'undef'))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},8000);
})}

(async()=>{
  const ts=await tabs();
  const d=ts.find(t=>t.url.includes('deepseek.com'));
  if(!d){console.log('No DeepSeek tab');return;}
  console.log('URL:',d.url.slice(0,100));

  // Type a simple message
  const msg='Phản biện: 1+1=3 có đúng không?';
  await ev(d.id,'window.__cd='+J(msg)+';null');
  await ev(d.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return;ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cd);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('Typed');
  await new Promise(r=>setTimeout(r,1500));

  // Click send
  await ev(d.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b)b.click()})()');
  console.log('Sent');
  await new Promise(r=>setTimeout(r,1000));

  // Check URL
  for(let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,2000));
    const url=await ev(d.id,'window.location.href');
    const msgs=await ev(d.id,'document.querySelectorAll(".ds-message").length');
    const body=await ev(d.id,'document.querySelectorAll("[class*=message],[class*=Message]").length');
    const lstMsg=await ev(d.id,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<1)return"none";return ms[ms.length-1].innerText.slice(0,100)})()');
    
    console.log('t='+(i*2+1)+'s url:'+(url.includes('chat.deepseek')?'ok':'CHANGED!'));
    console.log(' .ds-message:'+msgs+' ./message/Message:'+body+' last:'+lstMsg.slice(0,60));
    
    if(msgs>=2){console.log('GOT MESSAGES!');break;}
  }
})();
