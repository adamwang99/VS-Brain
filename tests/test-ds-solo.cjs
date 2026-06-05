// DeepSeek solo: navigate to main, type, send, wait for response
const WS=require('ws'),http=require('http');
const J=JSON.stringify;
const t=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const sl=m=>new Promise(r=>setTimeout(r,m));

function ev(id,e){return new Promise(async(ok)=>{
  const ts=await t();const tab=ts.find(x=>x.id===id);
  if(!tab)return ok('no tab');
  const w=new WS(tab.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:e,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},10000);
})}

(async()=>{
  const ts=await t();
  const d=ts.find(x=>x.url.includes('deepseek.com'));
  if(!d){console.log('No DS tab');return;}
  console.log('Tab:',d.id.slice(0,8),d.url.slice(0,80));

  // Nav to fresh main
  await ev(d.id,'window.location.href="https://chat.deepseek.com/"');
  console.log('Nav to main...');
  await sl(6000);

  // Re-find tab
  const ts2=await t();
  const d2=ts2.find(x=>x.url.includes('deepseek.com'));
  if(!d2){console.log('Tab lost');return;}
  console.log('After nav:',d2.url.slice(0,80));

  // Check DOM
  const ta=await ev(d2.id,'document.querySelectorAll("textarea").length');
  console.log('textarea:', ta);

  const body=await ev(d2.id,'document.body.innerText.slice(0,200)');
  console.log('Body:',body);

  // Type
  const msg='Phản biện: Hãy chỉ ra điểm yếu trong lập luận "AI nên do chính phủ quản lý"';
  await ev(d2.id,'window.__cd='+J(msg)+';null');
  const tr=await ev(d2.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cd);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('Type:',tr);
  await sl(2000);

  // Send
  const snd=await ev(d2.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"ok"}return"null"})()');
  console.log('Send:',snd);
  await sl(3000);

  // Now check for conversation
  for(let i=0;i<30;i++){
    await sl(2000);
    const url=await ev(d2.id,'window.location.href');
    const msgs=await ev(d2.id,'document.querySelectorAll(".ds-message").length');
    const bd=await ev(d2.id,'document.body.innerText.slice(0,300)');
    console.log('t='+(i*2+5)+' url:'+(url.includes('deepseek')?'ok':'??')+' msgs:'+msgs);
    if(i%3===0)console.log('  body:',bd);

    if(msgs>0){
      const txt=await ev(d2.id,'(function(){var ms=document.querySelectorAll(".ds-message");return ms[ms.length-1].innerText})()');
      console.log('RESPONSE:',txt.slice(0,200));
      break;
    }
  }

  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
