// CrossCritic v12 — Global variable technique to avoid nested quote issues
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const J=JSON.stringify;

async function findTab(pattern){
  const ts=await tabs();return ts.find(t=>t.url&&t.url.includes(pattern));
}

function ev(id,expr,to=20000){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
})}

// Set a global variable safely (no nested expression issues)
async function setMsg(id,msg){
  return ev(id,'window.__cc='+J(msg)+';null');
}

// ========= CHATGPT =========
async function chat(msg,round){
  let t=await findTab('chatgpt.com');
  if(!t)return null;
  console.log('  [ChatGPT] fresh r'+round);
  // Navigate to new thread
  await ev(t.id,'window.location.href="https://chatgpt.com/"');
  await dly(6000);
  t=await findTab('chatgpt.com');
  if(!t)return null;

  // Check input field
  const ok=await ev(t.id,'(function(){return document.querySelector(\'[contenteditable="true"]\')?"y":"n"})()');
  if(ok!=='y'){console.log('  [ChatGPT] no input');return null;}

  // Type via global
  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,window.__cc)})()');
  await dly(1500);

  await ev(t.id,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b)b.click()})()');
  console.log('  [ChatGPT] sent');
  await dly(3000);

  const TX='(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()';
  const ST='(function(){return document.querySelector(\'[data-testid="stop-button"]\')?"gen":"idle"})()';

  for(let i=0;i<60;i++){
    await dly(1000);
    const txt=await ev(t.id,TX);
    const stop=await ev(t.id,ST);
    if(txt&&txt.length>=5&&stop==='idle'){
      console.log('  [ChatGPT] res@'+i+'s: '+txt.slice(0,100));
      return '[ChatGPT] '+txt;
    }
    if(i%15===0)console.log('  [ChatGPT] wait '+i+'s '+stop);
  }
  return null;
}

// ========= GEMINI =========
async function gem(msg,round){
  let t=await findTab('gemini.google.com');
  if(!t)return null;
  console.log('  [Gemini] fresh r'+round);
  // Fresh thread
  await ev(t.id,'window.location.href="https://gemini.google.com/app"');
  await dly(8000);
  t=await findTab('gemini.google.com');
  if(!t)return null;

  // Type via global
  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText=window.__cc;e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1500);
  console.log('  [Gemini] typed');

  // Send with Enter
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [Gemini] sent');
  await dly(10000);

  const TX="(function(){var m=document.querySelector('model-response');if(!m)return null;var t=m.textContent;return t&&t.length?t.trim():null})()";
  const ST="(function(){var sb=document.querySelector('[aria-label*=\"ung\"],[aria-label*=\"ừng\"]');if(sb)return'gen';var m=document.querySelector('model-response');return m&&m.textContent&&m.textContent.trim().length?'res':'wait'})()";

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
    if(i%5===0)console.log('  [Gemini] wait '+((i*2)+10)+'s');
  }
  return null;
}

// ========= DEEPSEEK =========
async function ds(msg,round){
  let t=await findTab('deepseek.com');
  if(!t)return null;
  console.log('  [DeepSeek] fresh r'+round);
  // Fresh via location.href
  await ev(t.id,'window.location.href="https://chat.deepseek.com/"');
  await dly(7000);
  t=await findTab('deepseek.com');
  if(!t)return null;

  // Type via global + native setter
  await setMsg(t.id,msg);
  const typeOk=await ev(t.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cc);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('  [DeepSeek] typed:'+typeOk);
  if(typeOk!=='ok')return null;
  await dly(1500);

  const snd=await ev(t.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"ok"}return"null"})()');
  console.log('  [DeepSeek] send:'+snd);
  await dly(15000);

  for(let i=0;i<30;i++){
    await dly(2000);
    const r=await ev(t.id,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;var t=ms[ms.length-1].innerText;return t&&t.length>5?t:null})()');
    if(r&&r.length>5){
      console.log('  [DeepSeek] res@'+((i*2)+15)+'s: '+r.slice(0,100));
      return '[DeepSeek] '+r;
    }
    if(i%5===0)console.log('  [DeepSeek] wait '+((i*2)+15)+'s');
  }
  return null;
}

// ========= MAIN =========
(async()=>{
  console.log('===== CROSS CRITIC v12 =====\n');
  const c=await findTab('chatgpt.com');
  const g=await findTab('gemini.google.com');
  const d=await findTab('deepseek.com');
  if(!c||!g||!d){console.log('Missing tabs');process.exit(1);}
  console.log('C:'+c.id+'\nG:'+g.id+'\nD:'+d.id);

  var msg='PHẢN BIỆN AI: Chủ đề "AI governance — chính phủ hay cộng đồng mã nguồn mở?". Hãy đưa quan điểm của bạn, 2-3 câu, có lập luận rõ ràng.';
  const chain=['chat','gem','ds'];

  for(var n=0;n<6;n++){
    const turn=chain[n%3],round=Math.floor(n/3)+1;
    console.log('\n=== Step '+(n+1)+' R'+round+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+msg.slice(0,100));

    var reply;
    if(turn==='chat')reply=await chat(msg,round);
    else if(turn==='gem')reply=await gem(msg,round);
    else reply=await ds(msg,round);

    if(!reply){
      console.log('  SKIP');
      msg='[FAIL:'+turn+'] '+msg.slice(0,100);
      continue;
    }
    msg=reply;
    console.log('  PASS: '+reply.slice(0,100));

    const prev=reply.match(/^\[(\w+)\]/)?.[1]||turn;
    msg=`Model trước (${prev}) nói: "${reply.slice(0,250)}" Hãy phản biện — phân tích điểm yếu lập luận, hoặc đưa góc nhìn đối lập. Trả lời 2-3 câu.`;
  }

  console.log('\n===== DONE =====');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
