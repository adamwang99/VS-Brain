// Test Qwen and Claude with native value setter (React bypass)
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

async function testNative(name,urlPat,enterBtnIndex=0){
  const ts=await tab();
  const t=ts.find(x=>x.url.includes(urlPat));
  if(!t){console.log('['+name+'] NO TAB');return;}
  console.log('\n['+name+'] '+t.id.slice(0,8));
  
  const msg='Phản biện: Chính phủ có nên kiểm soát hoàn toàn AI không? Trả lời 2-3 câu.';
  await ev(t.id,'window.__ct='+J(msg)+';null');
  
  // Native setter
  const tr=await ev(t.id,'(function(){var ta=document.querySelector("textarea");if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__ct);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('Type:', tr);
  await sl(2000);
  
  // Check UI actually changed
  const val=await ev(t.id,'document.querySelector("textarea").value.slice(0,40)');
  console.log('TA value:', val);
  
  // Enter key
  await ev(t.id,'(function(){var t=document.querySelector("textarea");if(!t)return;t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok"})()');
  console.log('Sent');
  await sl(3000);
  
  // Check if URL changed
  for(let i=0;i<12;i++){
    await sl(3000);
    const body=await ev(t.id,'document.body.innerText.slice(0,400)');
    console.log('t='+(i*3+5)+'s:',body.replace(/\n/g,'|').slice(0,200));
    // Check for new content
    if(body.length>200&&(body.includes('phản')||body.includes('chính phủ')||body.includes('AI')))break;
  }
  
  // Scan for response
  const texts=await ev(t.id,'(function(){var all=document.querySelectorAll("div, p, article");var r=[];for(var i=0;i<all.length;i++){var t=all[i].innerText&&all[i].innerText.trim();if(t&&t.length>30&&!t.includes("New Chat")&&!t.includes("How can I help")&&!t.includes("Adam")){r.push(i+":"+t.slice(0,80))}if(r.length>5)break}return JSON.stringify(r)})()');
  console.log('Response candidates:', texts.slice(0,500));
}

(async()=>{
  await testNative('Qwen','chat.qwen.ai');
  await testNative('Claude','chat.chatbotapp.ai');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
