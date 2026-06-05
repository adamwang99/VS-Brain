// CrossCritic Relay v9 — 3-model rebuttal loop: ChatGPT↔Gemini↔DeepSeek
// Fixes: ChatGPT fresh thread, Gemini prefix strip, instruction frame, debate seed
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const J=JSON.stringify;

function ev(id,expr,to=25000){return new Promise(async(ok,rej)=>{
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
  setTimeout(()=>{try{w.close()}catch(e){};rej('navTO')},20000);
})}

// ========= CHATGPT - fresh thread per round =========
async function chat(msg,round){
  // Find ChatGPT tab
  const ts=await tabs();
  const ct=ts.find(t=>t.url.includes('chatgpt.com'));
  if(!ct)return null;
  const tid=ct.id;

  // Fresh thread: navigate to root (starts new conversation)
  console.log('  [ChatGPT] fresh thread round '+round+'...');
  await nav(tid,'https://chatgpt.com/');
  await dly(4000);

  // Wait for input field
  const ready=await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e?"ok":"null"})()');
  if(ready!=='ok'){console.log('  [ChatGPT] no input');return null;}

  // Type message
  await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,'+J(msg)+')})()');
  await dly(1500);

  // Click send
  const snd=await ev(tid,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b){b.click();return"clicked"}return"none"})()');
  console.log('  [ChatGPT] sent:'+snd);

  // Wait for response — track new assistant message count
  const CT='document.querySelectorAll("[data-message-author-role=assistant]").length';
  const ST='(function(){return document.querySelector(\'[data-testid="stop-button"]\')?"gen":"idle"})()';
  const TX='(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()';

  let b4=parseInt(await ev(tid,CT));

  for(let i=0;i<60;i++){
    await dly(1000);
    const now=parseInt(await ev(tid,CT));
    const stop=await ev(tid,ST);
    const txt=await ev(tid,TX);
    if(txt&&txt.length>=2&&stop==='idle'){
      const clean=txt.replace(/^ChatGPT\s+(đã\s+nói\s*)?/i,'').trim();
      console.log('  [ChatGPT] res@'+i+'s: '+clean.slice(0,100));
      return '[ChatGPT] '+clean;
    }
    if(txt&&txt.length>=2&&i<5){
      // still streaming but has content
      console.log('  [ChatGPT] streaming: '+txt.slice(0,60));
    }
    if(i%10===0)console.log('  [ChatGPT] wait '+i+'s '+stop+' msgs:'+now);
  }
  const last=await ev(tid,TX);
  return last&&last.length?'[ChatGPT] '+last:null;
}

// ========= GEMINI =========
async function gem(msg){
  const ts=await tabs();
  const gt=ts.find(t=>t.url.includes('gemini.google.com'));
  if(!gt)return null;
  const tid=gt.id;

  // Navigate fresh
  console.log('  [Gemini] fresh...');
  try{await nav(tid,'https://gemini.google.com/app')}catch(e){}
  await dly(5000);

  // Type via execCommand on contenteditable
  await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText='+J(msg)+';e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1500);
  console.log('  [Gemini] typed');

  // Send with Enter
  await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [Gemini] sent');
  await dly(8000);

  // Extract: strip all known Gemini prefix variants
  const TX='(function(){var m=document.querySelector("model-response");if(!m)return null;var t=m.textContent;return t&&t.length?t.trim():null})()';
  const ST='(function(){var sb=document.querySelector(\'[aria-label*="ung"],[aria-label*="ừng"]\')||document.querySelector(\'[data-test-id="stop-button"]\');if(sb)return"gen";var m=document.querySelector("model-response");if(!m||!m.textContent||m.textContent.trim().length<1)return"wait";return"res")()';

  for(let i=0;i<30;i++){
    await dly(2000);
    const raw=await ev(tid,TX);
    if(raw&&raw.length>10){
      // Strip all known Gemini UI prefixes
      let c=raw.replace(/^H2:\s*/i,'');
      c=c.replace(/^Gemini\s+đã\s+nói\s*/i,'');
      c=c.replace(/^Interpreting\s+the\s+Prompt\s*/i,'');
      c=c.replace(/^Đang\s+tìm\s+kiếm\s+trên\s+web\s*/i,'');
      c=c.trim();
      if(c.length>5){
        console.log('  [Gemini] res@'+(i*2+8)+'s: '+c.slice(0,100));
        return '[Gemini] '+c;
      }
    }
    if(i%5===0){
      const s=await ev(tid,ST);
      console.log('  [Gemini] wait '+(i*2+8)+'s state:'+s);
      if(raw)console.log('  [Gemini] raw: '+raw.slice(0,60));
    }
  }
  const last=await ev(tid,TX);
  if(last){
    let c=last.replace(/^H2:\s*/i,'').replace(/^Gemini\s+đã\s+nói\s*/i,'').replace(/^Interpreting\s+the\s+Prompt\s*/i,'').trim();
    return c.length?'[Gemini] '+c:null;
  }
  return null;
}

// ========= DEEPSEEK =========
async function ds(msg){
  const ts=await tabs();
  const dt=ts.find(t=>t.url.includes('deepseek.com'));
  if(!dt)return null;
  const tid=dt.id;

  // Fresh
  console.log('  [DeepSeek] fresh...');
  await ev(tid,'window.location.href="https://chat.deepseek.com/"');
  await dly(5000);

  // Type via native value setter (React bypass)
  await ev(tid,'(function(){var t=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!t)return;t.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(t,'+J(msg)+');t.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));t.dispatchEvent(new Event("change",{bubbles:true,cancelable:true}))})()');
  await dly(1500);
  console.log('  [DeepSeek] typed');

  // Click send button
  const snd=await ev(tid,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"clicked"}return"no-send"})()');
  console.log('  [DeepSeek] send:'+snd);
  await dly(10000); // DeepSeek first response is slow

  for(let i=0;i<30;i++){
    await dly(2000);
    const r=await ev(tid,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;var t=ms[ms.length-1].innerText;return t&&t.length?t:null})()');
    if(r&&r.length>5){
      const clean=r.replace(/^DeepSeek\s+(đã\s+nói\s*)?/i,'').trim();
      console.log('  [DeepSeek] res@'+(i*2+10)+'s: '+clean.slice(0,100));
      return '[DeepSeek] '+clean;
    }
    if(i%5===0)console.log('  [DeepSeek] wait '+(i*2+10)+'s');
  }
  const last=await ev(tid,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;return ms[ms.length-1].innerText})()');
  return last&&last.length?'[DeepSeek] '+last:null;
}

// ========= MAIN =========
(async()=>{
  console.log('===== 3MODEL CROSS CRITIC v9 =====\n');
  const ts=await tabs();
  let cid,gid,did;
  ts.forEach(t=>{if(t.url.includes('chatgpt.com'))cid=t.id;if(t.url.includes('gemini.google.com'))gid=t.id;if(t.url.includes('deepseek.com'))did=t.id});
  if(!cid||!gid||!did){console.log('Missing tabs! c='+!!cid+' g='+!!gid+' d='+!!did);process.exit(1);}
  console.log('ChatGPT:'+cid+'\nGemini:'+gid+'\nDeepSeek:'+did);

  // Instruction frame cho mỗi model — debate seed
  const SEED=`Đây là vòng phản biện giữa 3 AI: ChatGPT, Gemini, và DeepSeek. Hãy đóng vai người phản biện (rebuttal) — không trả lời như chat thông thường.

Chủ đề: "AI nên được quản lý bởi chính phủ hay bởi cộng đồng mã nguồn mở?"

Hãy đưa ra quan điểm của bạn trong 2-3 câu. Câu trả lời phải ngắn gọn, có lập luận, và thể hiện rõ quan điểm.`;

  const chain=['chat','gem','ds'];
  var m=SEED;

  for(var n=0;n<6;n++){ // 2 rounds × 3 models = 6 steps
    const turn=chain[n%3];
    const round=Math.floor(n/3)+1;
    console.log('\n=== Step '+(n+1)+' R'+round+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+m.slice(0,120));

    var reply;
    if(turn==='chat')reply=await chat(m,round);
    else if(turn==='gem')reply=await gem(m);
    else reply=await ds(m);

    if(!reply){
      console.log('  FAIL step '+(n+1));
      m=m+' [FAIL:'+turn+']';
      continue;
    }
    m=reply;
    console.log('  PASS: '+reply.slice(0,120));

    // Build rebuttal frame for next model
    const prevModel=reply.match(/^\[(\w+)\]/)?.[1]||turn;
    m=`Đây là vòng phản biện AI. Model trước (${prevModel}) vừa nói: "${reply.slice(0,200)}"

Hãy đóng vai phản biện (rebuttal): phân tích, chỉ ra điểm yếu trong lập luận của model trước, hoặc bổ sung góc nhìn đối lập. Trả lời ngắn gọn trong 2-3 câu.`;
  }

  console.log('\n===== RELAY v9 DONE =====');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
