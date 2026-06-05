// Test type+send+response for Qwen, Claude, Copilot, Grok
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
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},10000);
})}

async function testProvider(name,urlPat,typeExpr,sendExpr,extractExpr,stripRegex,initWait=2000){
  const ts=await tab();
  const t=ts.find(x=>x.url.includes(urlPat)&&!x.url.includes('frame')&&!x.url.includes('stripe'));
  if(!t){console.log('['+name+'] NO TAB');return null;}
  console.log('\n['+name+'] ID='+t.id.slice(0,8));
  const msg='Hãy phản biện lập luận này trong 3 câu: "AI phải do chính phủ kiểm soát hoàn toàn vì lợi ích quốc gia"';
  
  // Set msg global
  await ev(t.id,'window.__ct='+J(msg)+';null');
  
  // Type
  const tr=await ev(t.id,typeExpr);
  console.log('['+name+'] Type:',tr);
  if(!tr||tr.includes('no-')||tr.includes('none'))return null;
  await sl(initWait);
  
  // Send
  const snd=await ev(t.id,sendExpr);
  console.log('['+name+'] Send:',snd);
  await sl(5000);
  
  // Wait for response
  for(let i=0;i<30;i++){
    await sl(2000);
    const raw=await ev(t.id,extractExpr);
    if(raw&&raw.length>20){
      const clean=stripRegex?raw.replace(stripRegex,'').trim():raw.trim();
      if(clean.length>10){
        console.log('['+name+'] RESPONSE@'+(i*2+5)+'s:',clean.slice(0,150));
        return clean;
      }
    }
    if(i%5===0)console.log('['+name+'] wait '+(i*2+5)+'s');
  }
  return null;
}

(async()=>{
  // === QWEN ===
  const qwen=await testProvider('Qwen','chat.qwen.ai',
    '(function(){var t=document.querySelector("textarea");if(!t)return"no-ta";t.focus();t.value=window.__ct;t.dispatchEvent(new InputEvent("input",{bubbles:true}));return"ok"})()',
    '(function(){var t=document.querySelector("textarea");if(!t)return;var e=new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true});t.dispatchEvent(e);return"ok"})()',
    '(function(){var ps=document.querySelectorAll("p");for(var i=ps.length-1;i>=0;i--){var t=ps[i].innerText;if(t.length>20&&!t.includes("Hãy phản biện"))return t;}return null})()'
  );
  console.log(qwen?'  QWEN OK':'  QWEN FAIL');
  
  // === CLAUDE ===
  const claude=await testProvider('Claude','chat.chatbotapp.ai',
    '(function(){var t=document.querySelector("textarea");if(!t)return"no-ta";t.focus();t.value=window.__ct;t.dispatchEvent(new InputEvent("input",{bubbles:true}));return"ok"})()',
    '(function(){var t=document.querySelector("textarea");if(!t)return;t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}));return"ok"})()',
    '(function(){var ps=document.querySelectorAll("p");for(var i=ps.length-1;i>=0;i--){var t=ps[i].innerText;if(t.length>20&&!t.includes("Hãy phản biện"))return t;}return null})()'
  );
  console.log(claude?'  CLAUDE OK':'  CLAUDE FAIL');
  
  // === COPILOT ===
  const copilot=await testProvider('Copilot','copilot.microsoft.com',
    '(function(){var t=document.querySelector("textarea");if(!t)return"no-ta";t.focus();t.value=window.__ct;t.dispatchEvent(new InputEvent("input",{bubbles:true}));return"ok"})()',
    '(function(){var t=document.querySelector("textarea");if(!t)return;t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}));return"ok"})()',
    '(function(){var ps=document.querySelectorAll("p");for(var i=ps.length-1;i>=0;i--){var t=ps[i].innerText;if(t.length>20&&!t.includes("Hãy phản biện"))return t;}return null})()'
  );
  console.log(copilot?'  COPILOT OK':'  COPILOT FAIL');
  
  // === GROK ===
  const grok=await testProvider('Grok','grok.com',
    '(function(){var el=document.querySelector("[contenteditable=true],textarea,[role=textbox]");if(!el)return"no-input";el.focus();if(el.value!==undefined){el.value=window.__ct;el.dispatchEvent(new InputEvent("input",{bubbles:true}))}else{el.innerText=window.__ct;el.dispatchEvent(new InputEvent("input",{bubbles:true}))}return"ok"})()',
    '(function(){var t=document.querySelector("textarea");if(t){t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok-ta"}var ce=document.querySelector("[contenteditable=true],[role=textbox]");if(ce){ce.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok-ce"}return"no-input"})()',
    '(function(){var ps=document.querySelectorAll("p");for(var i=ps.length-1;i>=0;i--){var t=ps[i].innerText;if(t.length>20)return t;}return null})()'
  );
  console.log(grok?'  GROK OK':'  GROK FAIL');
  
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
