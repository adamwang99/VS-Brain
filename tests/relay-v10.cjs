// CrossCritic Relay v10 — Re-lookup tab after each nav
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const J=JSON.stringify;

function ev(id,expr,to=25000){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab '+id.slice(0,8));
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
})}

function nav(id,url){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab for nav');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1||r.method==='Page.frameNavigated'){w.close();ok(r.result||true)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};ok(true)},15000);
})}

// Find tab by URL pattern (re-lookup every time)
async function findTab(pattern){
  const ts=await tabs();
  return ts.find(t=>t.url&&t.url.includes(pattern));
}

// ========= CHATGPT =========
async function chat(msg,round){
  let t=await findTab('chatgpt.com');
  if(!t){console.log('  [ChatGPT] tab missing');return null;}

  console.log('  [ChatGPT] fresh thread r'+round+'...');
  await nav(t.id,'https://chatgpt.com/');
  await dly(5000);
  
  // Re-lookup tab after nav
  t=await findTab('chatgpt.com');
  if(!t){console.log('  [ChatGPT] tab lost after nav');return null;}

  const ready=await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e?"ok":"null"})()');
  if(ready!=='ok'){console.log('  [ChatGPT] no input');return null;}

  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,'+J(msg)+')})()');
  await dly(1500);

  const snd=await ev(t.id,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b){b.click();return"clicked"}return"none"})()');
  console.log('  [ChatGPT] sent:'+snd);

  const CT='document.querySelectorAll("[data-message-author-role=assistant]").length';
  const ST='(function(){return document.querySelector(\'[data-testid="stop-button"]\')?"gen":"idle"})()';
  const TX='(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()';

  for(let i=0;i<60;i++){
    await dly(1000);
    const txt=await ev(t.id,TX);
    const stop=await ev(t.id,ST);
    if(txt&&txt.length>=2&&stop==='idle'){
      const clean=txt.replace(/^ChatGPT\s*(đã\s+nói\s*)?/i,'').trim();
      console.log('  [ChatGPT] res@'+i+'s: '+clean.slice(0,100));
      return '[ChatGPT] '+clean;
    }
    if(txt&&txt.length>=2&&i<5)console.log('  [ChatGPT] stream: '+txt.slice(0,50));
    if(i%15===0)console.log('  [ChatGPT] wait '+i+'s '+stop);
  }
  const last=await ev(t.id,TX);
  return last&&last.length?'[ChatGPT] '+last:null;
}

// ========= GEMINI =========
async function gem(msg){
  let t=await findTab('gemini.google.com');
  if(!t){console.log('  [Gemini] tab missing');return null;}

  console.log('  [Gemini] fresh...');
  await nav(t.id,'https://gemini.google.com/app');
  await dly(6000);

  // Re-lookup
  t=await findTab('gemini.google.com');
  if(!t){console.log('  [Gemini] tab lost after nav');return null;}

  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText='+J(msg)+';e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1500);
  console.log('  [Gemini] typed');

  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [Gemini] sent');
  await dly(10000);

  const TX='(function(){var m=document.querySelector("model-response");if(!m)return null;var t=m.textContent;return t&&t.length?t.trim():null})()';
  const ST='(function(){var sb=document.querySelector(\'[aria-label*="ung"],[aria-label*="ừng"]\');if(sb)return"gen";var m=document.querySelector("model-response");if(!m||!m.textContent||m.textContent.trim().length<1)return"wait";return"res")()';

  for(let i=0;i<30;i++){
    await dly(2000);
    const raw=await ev(t.id,TX);
    if(raw&&raw.length>20){
      let c=raw.replace(/^H2:\s*/i,'');
      c=c.replace(/^Gemini\s+đã\s+nói\s*/i,'');
      c=c.replace(/^Interpreting\s+the\s+Prompt\s*/i,'');
      c=c.replace(/^Đang\s+tìm\s+kiếm\s+trên\s+web\s*/i,'');
      c=c.trim();
      if(c.length>5){
        console.log('  [Gemini] res@'+((i*2)+10)+'s: '+c.slice(0,100));
        return '[Gemini] '+c;
      }
    }
    if(i%5===0){
      const s=await ev(t.id,ST);
      console.log('  [Gemini] wait '+((i*2)+10)+'s state:'+s);
    }
  }
  const last=await ev(t.id,TX);
  if(last){
    let c=last.replace(/^H2:\s*/i,'').replace(/^Gemini\s+đã\s+nói\s*/i,'').replace(/^Interpreting\s+the\s+Prompt\s*/i,'').trim();
    return c.length>5?'[Gemini] '+c:null;
  }
  return null;
}

// ========= DEEPSEEK =========
async function ds(msg){
  let t=await findTab('deepseek.com');
  if(!t){console.log('  [DeepSeek] tab missing');return null;}

  console.log('  [DeepSeek] fresh...');
  await nav(t.id,'https://chat.deepseek.com/');
  await dly(5000);

  // Re-lookup
  t=await findTab('deepseek.com');
  if(!t){console.log('  [DeepSeek] tab lost after nav');return null;}

  await ev(t.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return;ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,'+J(msg)+');ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));ta.dispatchEvent(new Event("change",{bubbles:true,cancelable:true}))})()');
  await dly(1500);
  console.log('  [DeepSeek] typed');

  const snd=await ev(t.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"clicked"}return"no-send"})()');
  console.log('  [DeepSeek] send:'+snd);
  await dly(12000);

  for(let i=0;i<30;i++){
    await dly(2000);
    const r=await ev(t.id,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;var t=ms[ms.length-1].innerText;return t&&t.length>5?t:null})()');
    if(r&&r.length>5){
      const clean=r.replace(/^DeepSeek\s*(đã\s+nói\s*)?/i,'').trim();
      console.log('  [DeepSeek] res@'+((i*2)+12)+'s: '+clean.slice(0,100));
      return '[DeepSeek] '+clean;
    }
    if(i%5===0)console.log('  [DeepSeek] wait '+((i*2)+12)+'s');
  }
  const last=await ev(t.id,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;return ms[ms.length-1].innerText})()');
  return last&&last.length>5?'[DeepSeek] '+last:null;
}

// ========= MAIN =========
(async()=>{
  console.log('===== 3MODEL CROSS CRITIC v10 =====\n');
  const ts=await tabs();
  let cid,gid,did;
  ts.forEach(t=>{if(t.url.includes('chatgpt.com'))cid=t.id;if(t.url.includes('gemini.google.com'))gid=t.id;if(t.url.includes('deepseek.com'))did=t.id});
  if(!cid||!gid||!did){console.log('Missing tabs! c='+!!cid+' g='+!!gid+' d='+!!did);process.exit(1);}
  console.log('ChatGPT:'+cid+'\nGemini:'+gid+'\nDeepSeek:'+did);

  const SEED=`Đây là vòng phản biện giữa 3 AI: ChatGPT, Gemini, và DeepSeek. Hãy đóng vai người phản biện (rebuttal) — không trả lời như chat thông thường.

Chủ đề: "AI nên được quản lý bởi chính phủ hay bởi cộng đồng mã nguồn mở?"

Hãy đưa ra quan điểm của bạn trong 2-3 câu. Trả lời ngắn gọn, có lập luận, thể hiện rõ quan điểm.`;

  const chain=['chat','gem','ds'];
  var m=SEED;

  for(var n=0;n<6;n++){
    const turn=chain[n%3];
    const round=Math.floor(n/3)+1;
    console.log('\n=== Step '+(n+1)+' R'+round+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+m.slice(0,120));

    var reply;
    if(turn==='chat')reply=await chat(m,round);
    else if(turn==='gem')reply=await gem(m);
    else reply=await ds(m);

    if(!reply){
      console.log('  SKIP step '+(n+1)+' (no reply)');
      m=`[${turn.toUpperCase()} no response] ${m.slice(0,100)}`;
      continue;
    }
    m=reply;
    console.log('  PASS: '+reply.slice(0,120));

    // Build rebuttal frame
    const prevModel=reply.match(/^\[(\w+)\]/)?.[1]||turn;
    m=`Đây là vòng phản biện AI. Model trước (${prevModel}) vừa nói:

"${reply}"

Hãy đóng vai phản biện (rebuttal): phân tích lập luận của model trước, chỉ ra điểm yếu hoặc bổ sung góc nhìn đối lập. Trả lời ngắn gọn trong 2-3 câu.`;
  }

  console.log('\n===== RELAY v10 DONE =====');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
