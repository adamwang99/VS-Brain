// CrossCritic 3Model Relay v8 — ChatGPT↔Gemini↔DeepSeek full loop
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const J=JSON.stringify;

function ev(id,expr,to=20000){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
})}

function nav(id,url){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();ok(r.result)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('navTO')},15000);
})}

// ========= CHATGPT =========
async function chat(msg){
  const tid=(await tabs()).find(t=>t.url.includes('chatgpt.com')).id;
  const b4=parseInt(await ev(tid,'document.querySelectorAll("[data-message-author-role=assistant]").length'));
  console.log('  [ChatGPT] msgs:'+b4);

  await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,'+J(msg)+')})()');
  await dly(1200);

  await ev(tid,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b){b.click();return"sent"}return"none"})()');
  console.log('  [ChatGPT] sent');

  const CT='document.querySelectorAll("[data-message-author-role=assistant]").length';
  const ST='(function(){return document.querySelector(\'[data-testid="stop-button"]\')?"gen":"idle"})()';
  const TX='(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()';

  for(let i=0;i<50;i++){
    await dly(1000);
    const now=parseInt(await ev(tid,CT));
    const stop=await ev(tid,ST);
    if(now>b4){
      const txt=await ev(tid,TX);
      if(txt&&txt.length&&stop==='idle'){console.log('  [ChatGPT] res@'+i+'s: '+txt.slice(0,80));return'[ChatGPT] '+txt;}
      if(txt&&i<3)console.log('  [ChatGPT] streaming: '+txt.slice(0,50));
    }
    if(i%10===0)console.log('  [ChatGPT] wait '+i+'s '+stop+' '+now+'/'+b4);
  }
  const last=await ev(tid,TX);
  return last?'[ChatGPT] '+last:null;
}

// ========= GEMINI =========
async function gem(msg){
  const tid=(await tabs()).find(t=>t.url.includes('gemini.google.com')).id;
  console.log('  [Gemini] fresh...');
  try{await nav(tid,'https://gemini.google.com/app')}catch(e){console.log('  nav continue')}
  await dly(5000);

  await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText='+J(msg)+';e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1000);
  console.log('  [Gemini] typed');

  await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [Gemini] sent');
  await dly(8000);

  const TX='(function(){var m=document.querySelector("model-response");if(!m)return null;var t=m.textContent;return t&&t.length?t.trim():null})()';
  const ST='(function(){var sb=document.querySelector(\'[aria-label*="ung"],[aria-label*="ừng"]\');if(sb)return"gen";var m=document.querySelector("model-response");if(!m||!m.textContent||m.textContent.length<1)return"wait";return m.textContent.trim()})()';
  for(let i=0;i<25;i++){
    await dly(2000);
    const t=await ev(tid,TX);
    if(t&&t.length){const c=t.replace(/^Gemini\s+đã\s+nói\s*/i,'').trim();console.log('  [Gemini] res@'+(i*2+8)+'s: '+c.slice(0,80));return'[Gemini] '+c;}
    const s=await ev(tid,ST);
    if(s&&s!=='gen'&&s!=='wait'&&s.length){const c=s.replace(/^Gemini\s+đã\s+nói\s*/i,'').trim();console.log('  [Gemini] stop@'+(i*2+8)+'s: '+c.slice(0,80));return'[Gemini] '+c;}
    if(i%4===0)console.log('  [Gemini] wait '+(i*2+8)+'s');
  }
  return null;
}

// ========= DEEPSEEK =========
async function ds(msg){
  const tid=(await tabs()).find(t=>t.url.includes('deepseek.com')).id;
  console.log('  [DeepSeek] fresh...');
  await ev(tid,'window.location.href="https://chat.deepseek.com/"');
  await dly(4000);

  await ev(tid,'(function(){var t=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!t)return;var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(t,'+J(msg)+');t.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));t.dispatchEvent(new Event("change",{bubbles:true,cancelable:true}))})()');
  await dly(1000);
  console.log('  [DeepSeek] typed');

  const snd=await ev(tid,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"clicked"}return"no-send"})()');
  console.log('  [DeepSeek] send:'+snd);
  await dly(8000);

  for(let i=0;i<25;i++){
    await dly(2000);
    const r=await ev(tid,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;return ms[ms.length-1].innerText})()');
    if(r&&r.length){console.log('  [DeepSeek] res@'+(i*2+8)+'s: '+r.slice(0,80));return'[DeepSeek] '+r;}
    if(i%4===0)console.log('  [DeepSeek] wait '+(i*2+8)+'s');
  }
  return null;
}

// ========= MAIN =========
(async()=>{
  console.log('===== 3MODEL CROSS CRITIC v8 =====\n');
  const ts=await tabs();
  let cid,gid,did;
  ts.forEach(t=>{if(t.url.includes('chatgpt.com'))cid=t.id;if(t.url.includes('gemini.google.com'))gid=t.id;if(t.url.includes('deepseek.com'))did=t.id});
  if(!cid||!gid||!did){console.log('Missing tabs! c='+!!cid+' g='+!!gid+' d='+!!did);process.exit(1);}
  console.log('ChatGPT:'+cid+'\nGemini:'+gid+'\nDeepSeek:'+did);

  // Each turn: chat→gem→ds→chat→...
  var m='Hãy trả lời ngắn gọn: 1+1=?';
  const chain=['chat','gem','ds'];
  var step=0;

  for(var i=0;i<9;i++){ // 3 rounds × 3 models = 9 steps
    const turn=chain[i%3];
    console.log('\n=== Step '+(i+1)+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+m.slice(0,100));

    var reply;
    if(turn==='chat')reply=await chat(m);
    else if(turn==='gem')reply=await gem(m);
    else reply=await ds(m);

    if(!reply){console.log('  FAIL step '+(i+1));process.exit(1);}
    m=reply;
    console.log('  PASS: '+reply.slice(0,100));
  }

  console.log('\n===== 3MODEL RELAY DONE =====');
  console.log('Chain: '+m.slice(0,500));
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
