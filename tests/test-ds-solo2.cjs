// DeepSeek solo v2: navigate to existing conversation, type, send
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

  // Nav to a conversation page (click first conversation in sidebar or use known URL)
  // The main page has sidebar items. Let's find the href of the first chat
  const links=await ev(d.id,'(function(){var as=document.querySelectorAll("a[href*=\'/a/chat/s/\']");var hrefs=[];for(var i=0;i<Math.min(5,as.length);i++)hrefs.push(as[i].href);return JSON.stringify(hrefs)})()');
  console.log('Chat links:', links);

  if(links&&links.length>10){
    const hrefs=JSON.parse(links);
    console.log('First href:', hrefs[0]);
    // Navigate to the first conversation
    await ev(d.id,'window.location.href='+J(hrefs[0]));
    await sl(5000);
  } else {
    // Fallback: create via main page
    console.log('No chat links found, creating new conversation...');
    await ev(d.id,'window.location.href="https://chat.deepseek.com/"');
    await sl(6000);
  }

  // Re-find tab
  const ts2=await t();
  const d2=ts2.find(x=>x.url.includes('deepseek.com'));
  console.log('After nav:', d2.url.slice(0,80));

  // Check msgs
  const msgs=await ev(d2.id,'document.querySelectorAll(".ds-message").length');
  console.log('msgs:', msgs);

  const msg='Phản biện: Phân tích lập luận "AI nên do chính phủ quản lý" — chỉ ra 2 điểm yếu';
  await ev(d2.id,'window.__cd='+J(msg)+';null');

  // Wait for page to stabilize
  await sl(3000);

  // Type
  const tr=await ev(d2.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cd);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('Type:', tr);
  await sl(2000);

  // Send
  const snd=await ev(d2.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"ok"}return"null"})()');
  console.log('Send:', snd);
  await sl(3000);

  // Check URL and messages
  for(let i=0;i<25;i++){
    await sl(2000);
    const url=await ev(d2.id,'window.location.href');
    const msgs2=await ev(d2.id,'document.querySelectorAll(".ds-message").length');
    const last=msgs2>0?await ev(d2.id,'(function(){var ms=document.querySelectorAll(".ds-message");return ms[ms.length-1].innerText.slice(0,200)})()'):'none';
    console.log('t='+(i*2+5)+' msgs:'+msgs2+' last:'+last.slice(0,80));
    if(msgs2>1&&last!=='none'){
      console.log('GOT RESPONSE:', last);
      break;
    }
  }

  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
