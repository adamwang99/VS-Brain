// CrossCritic v13 — ChatGPT fresh only; Gemini+DeepSeek stay on current page
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const J=JSON.stringify;

async function findTab(p){const ts=await tabs();return ts.find(t=>t.url&&t.url.includes(p));}

function ev(id,expr,to=25000){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
})}

// Set msg as global variable (safe for any length/special chars)
async function setMsg(id,msg){return ev(id,'window.__cv='+J(msg)+';1')}

// ===== CHATGPT — fresh thread =====
async function chat(msg,round){
  console.log('  [ChatGPT] fresh r'+round);
  let t=await findTab('chatgpt.com'); if(!t)return null;

  await ev(t.id,'window.location.href="https://chatgpt.com/"');
  await dly(5000);
  t=await findTab('chatgpt.com'); if(!t)return null;

  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,window.__cv)})()');
  await dly(1500);
  await ev(t.id,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b)b.click()})()');
  console.log('  [ChatGPT] sent');
  await dly(3000);

  for(let i=0;i<60;i++){await dly(1000);
    const txt=await ev(t.id,'(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()');
    const stop=await ev(t.id,'(function(){return document.querySelector(\'[data-testid="stop-button"]\')?"gen":"idle"})()');
    if(txt&&txt.length>=5&&stop==='idle'){console.log('  [ChatGPT] res@'+i+'s: '+txt.slice(0,120));return'[ChatGPT] '+txt;}
    if(i%15===0)console.log('  [ChatGPT] wait '+i+'s '+stop);
  } return null;
}

// ===== GEMINI — no nav, type on current page =====
async function gem(msg){
  console.log('  [Gemini] type on current page');
  const t=await findTab('gemini.google.com'); if(!t)return null;

  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText=window.__cv;e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1500);
  console.log('  [Gemini] typed');

  // Enter to send
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [Gemini] sent');
  await dly(10000);

  const TX="(function(){var m=document.querySelector('model-response');if(!m)return null;var t=m.textContent;if(!t||t.length<5)return null;var idx=t.indexOf('Gemini đã nói');return idx>=0?t.substring(idx+13).trim():t.trim()})()";
  const ST='(function(){return document.querySelector(\'[aria-label*="ung"],[aria-label*="ừng"]\')?"gen":"idle"})()';

  for(let i=0;i<30;i++){await dly(2000);
    const raw=await ev(t.id,TX);
    const stop=await ev(t.id,ST);
    if(raw&&raw.length>5&&stop==='idle'){
      console.log('  [Gemini] res@'+((i*2)+10)+'s: '+raw.slice(0,120));
      return'[Gemini] '+raw;
    }
    if(raw&&raw.length>5&&stop==='gen')continue; // still generating
    if(i%5===0)console.log('  [Gemini] wait '+((i*2)+10)+'s');
  } return null;
}

// ===== DEEPSEEK — no nav, type on current page =====
async function ds(msg){
  console.log('  [DeepSeek] type on current page');
  const t=await findTab('deepseek.com'); if(!t)return null;

  await setMsg(t.id,msg);
  const tr=await ev(t.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cv);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('  [DeepSeek] typed:'+tr);
  if(tr!=='ok')return null;
  await dly(1500);

  const snd=await ev(t.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"ok"}return"null"})()');
  console.log('  [DeepSeek] send:'+snd);
  const b4=parseInt(await ev(t.id,'document.querySelectorAll(".ds-message").length'));
  console.log('  [DeepSeek] msgs:'+b4);
  await dly(5000);

  for(let i=0;i<30;i++){await dly(2000);
    const now=await ev(t.id,'document.querySelectorAll(".ds-message").length');
    if(now>1+b4){
      const r=await ev(t.id,'(function(){var ms=document.querySelectorAll(".ds-message");return ms[ms.length-1].innerText})()');
      if(r&&r.length>5){console.log('  [DeepSeek] res@'+((i*2)+15)+'s: '+r.slice(0,120));return'[DeepSeek] '+r;}
    }
    if(i%5===0)console.log('  [DeepSeek] wait '+((i*2)+15)+'s now:'+now+' b4:'+b4);
  } return null;
}

// ===== MAIN =====
(async()=>{
  console.log('===== CROSS CRITIC v13 =====\n');
  const c=await findTab('chatgpt.com'),g=await findTab('gemini.google.com'),d=await findTab('deepseek.com');
  if(!c||!g||!d){console.log('Missing tabs');process.exit(1);}
  console.log('C:'+c.id+'\nG:'+g.id+'\nD:'+d.id);

  var msg='PHẢN BIỆN AI: Chủ đề "AI governance — chính phủ hay cộng đồng mã nguồn mở?". Đưa quan điểm của bạn, 2-3 câu, có lập luận rõ ràng.';
  const chain=['chat','gem','ds'];

  for(var n=0;n<6;n++){
    const turn=chain[n%3],round=Math.floor(n/3)+1;
    console.log('\n=== Step '+(n+1)+' R'+round+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+msg.slice(0,100));

    var reply;
    if(turn==='chat')reply=await chat(msg,round);
    else if(turn==='gem')reply=await gem(msg);
    else reply=await ds(msg);

    if(!reply){console.log('  SKIP');msg='[FAIL:'+turn+'] '+msg.slice(0,100);continue;}
    msg=reply;
    console.log('  PASS: '+reply.slice(0,120));

    const prev=reply.match(/^\[(\w+)\]/)?.[1]||turn;
    msg=`PHẢN BIỆN: Model trước (${prev}) vừa nói: "${reply.slice(0,250)}" Hãy phản biện — phân tích điểm yếu lập luận, hoặc đưa góc nhìn đối lập. 2-3 câu ngắn gọn.`;
  }

  console.log('\n===== DONE =====');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
