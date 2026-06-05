// Debug Qwen and Claude - find response elements after sending
const WS=require('ws'),http=require('http');
const J=JSON.stringify;
const tab=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const sl=m=>new Promise(r=>setTimeout(r,m));
function ev(id,e){return new Promise(async(ok)=>{
  const ts=await tab();const t=ts.find(x=>x.id===id);
  if(!t)return ok('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:e,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},8000);
})}

(async()=>{
  const ts=await tab();
  
  // === QWEN: Type+send, then scan all divs for response text ===
  const q=ts.find(x=>x.url==='https://chat.qwen.ai/');
  console.log('=== QWEN ===');
  const msg='Phản biện: Hãy phân tích lập luận "AI nên do chính phủ quản lý"';
  await ev(q.id,'window.__ct='+J(msg)+';null');
  await ev(q.id,'(function(){var t=document.querySelector("textarea");t.focus();t.value=window.__ct;t.dispatchEvent(new InputEvent("input",{bubbles:true}));return"ok"})()');
  await sl(2000);
  const isBtn=await ev(q.id,'(function(){var btn=document.querySelector(\'button[aria-label*="Send"],button:has(svg)\');return btn?"btn":"none"})()');
  console.log('Has send btn?', isBtn);
  await ev(q.id,'(function(){var t=document.querySelector("textarea");t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok"})()');
  console.log('Sent');
  await sl(5000);
  
  // Scan all elements with non-empty text
  for(let i=0;i<10;i++){
    await sl(3000);
    // Check all divs with text
    const texts=await ev(q.id,'(function(){var all=document.querySelectorAll("div, p, span, article, section");var r=[];for(var i=0;i<all.length;i++){var t=all[i].innerText&&all[i].innerText.trim();if(t&&t.length>20&&!t.includes("New Chat")&&!t.includes("Qwen")&&!t.includes("All chats")&&!t.includes("Where do you want")&&!t.includes("Adam")){r.push(i+":"+t.slice(0,80))}if(r.length>5)break}return JSON.stringify(r)})()');
    const body=await ev(q.id,'document.body.innerText.slice(0,400)');
    console.log('t='+(i*3+5)+'s body:',body.replace(/\n/g,' | '));
    console.log('  matches:',texts.slice(0,500));
    if(body.length>200&&body.includes('Phản biện')||body.includes('phân tích'))break;
  }
  
  // === CLAUDE: Type+send, scan ===
  const cl=ts.find(x=>x.url.includes('chat.chatbotapp.ai'));
  console.log('\n=== CLAUDE ===');
  await ev(cl.id,'window.__ct='+J(msg)+';null');
  await ev(cl.id,'(function(){var t=document.querySelector("textarea");t.focus();t.value=window.__ct;t.dispatchEvent(new InputEvent("input",{bubbles:true}));return"ok"})()');
  await sl(2000);
  const clBtn=await ev(cl.id,'document.querySelectorAll(\'[data-testid="send-button"],button[aria-label*="Send"]\').length');
  console.log('Send btn:',clBtn);
  await ev(cl.id,'(function(){var t=document.querySelector("textarea");if(t)t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok"})()');
  console.log('Sent');
  
  for(let i=0;i<10;i++){
    await sl(3000);
    const texts=await ev(cl.id,'(function(){var all=document.querySelectorAll("div, p, article, section, [role=document]");var r=[];for(var i=0;i<all.length;i++){var t=all[i].innerText&&all[i].innerText.trim();if(t&&t.length>20&&!t.includes("New Chat")&&!t.includes("Type a message")&&!t.includes("Adam")&&!t.includes("How can I help")){r.push(i+":"+t.slice(0,80))}if(r.length>5)break}return JSON.stringify(r)})()');
    const body=await ev(cl.id,'document.body.innerText.slice(0,300)');
    console.log('t='+(i*3+5)+'s body:',body.replace(/\n/g,' | '));
    console.log('  matches:',texts.slice(0,500));
    if(body.length>150&&(body.includes('phản')||body.includes('chính phủ')))break;
  }
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
