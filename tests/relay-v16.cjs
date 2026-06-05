// CrossCritic v16: ChatGPT + Gemini + Copilot - 3-model rebuttal relay
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const sl=m=>new Promise(r=>setTimeout(r,m));
const J=JSON.stringify;

async function findTab(p){const ts=await tabs();return ts.find(t=>t.url&&t.title&&t.url.includes(p)&&!t.url.includes('RotateCookies'));}

function ev(id,expr,to=20000){
  return new Promise(async(ok,rej)=>{
    const ts=await tabs();const t=ts.find(x=>x.id===id);
    if(!t)return rej('no tab id='+id.slice(0,8));
    const w=new WS(t.webSocketDebuggerUrl);
    w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
    w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
    w.on('error',rej);
    setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
  });
}

async function setMsg(id,msg){return ev(id,'window.__cv='+J(msg)+';1');}

// ===== ChatGPT =====
async function chat(msg,round){
  console.log('  [C] r'+round);
  let t=await findTab('chatgpt.com'); if(!t)return null;
  await ev(t.id,'window.location.href="https://chatgpt.com/"');
  await sl(5000);
  t=await findTab('chatgpt.com'); if(!t)return null;
  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";document.execCommand("insertText",false,window.__cv)})()');
  await sl(1500);
  await ev(t.id,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b)b.click()})()');
  console.log('  [C] sent');
  await sl(3000);
  for(let i=0;i<60;i++){await sl(1000);
    const txt=await ev(t.id,'(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()');
    const sg=await ev(t.id,'(function(){var b=document.querySelector(\'[data-testid="stop-button"]\');return b?"gen":"idle"})()');
    if(txt&&txt.length>=5&&sg==='idle'){console.log('  [C]='+txt.slice(0,120));return'[ChatGPT] '+txt;}
    if(i%15===0)console.log('  [C] w'+i);
  } return null;
}

// ===== Gemini =====
async function gem(msg){
  console.log('  [G]');
  const t=await findTab('gemini.google.com/app'); if(!t)return null;
  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText=window.__cv;e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await sl(1500);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [G] sent');
  await sl(8000);
  const TX="(function(){var m=document.querySelector('model-response');if(!m)return null;var t=m.textContent;if(!t||t.length<5)return null;var idx=t.indexOf('Gemini đã nói');if(idx>=0)t=t.substring(idx+13);t=t.trim();return t.length>5?t:null})()";
  const ST='(function(){return document.querySelector(\'[aria-label*=\"ung\"],[aria-label*=\"ừng\"]\')?"gen":"idle"})()';
  for(let i=0;i<30;i++){await sl(2000);
    const raw=await ev(t.id,TX);
    const sg=await ev(t.id,ST);
    if(raw&&raw.length>5&&sg==='idle'){console.log('  [G]='+raw.slice(0,120));return'[Gemini] '+raw;}
    if(i%5===0)console.log('  [G] w'+((i*2)+8));
  } return null;
}

// ===== Copilot =====
async function cop(msg){
  console.log('  [CP]');
  let t=await findTab('copilot.microsoft.com'); if(!t)return null;
  await ev(t.id,'window.location.href="https://copilot.microsoft.com/"');
  await sl(6000);
  t=await findTab('copilot.microsoft.com'); if(!t)return null;
  await setMsg(t.id,msg);
  const tr=await ev(t.id,'(function(){var ta=document.querySelector("textarea");if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cv);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  if(tr!=='ok')return null;
  await sl(2000);
  await ev(t.id,'(function(){var ta=document.querySelector("textarea");if(!ta)return;ta.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}))})()');
  console.log('  [CP] sent');
  await sl(3000);
  for(let i=0;i<30;i++){await sl(2000);
    const raw=await ev(t.id,'(function(){ps=document.querySelectorAll("p");for(var i=ps.length-1;i>=0;i--){var t=ps[i].innerText;if(t.length>15&&!t.includes("Bạn đã nói"))return t;}return null})()');
    const body=await ev(t.id,'document.body.innerText');
    if(raw&&raw.length>15){console.log('  [CP]='+raw.slice(0,120));return'[Copilot] '+raw;}
    if(i%5===0)console.log('  [CP] w'+((i*2)+3));
  } return null;
}

// ===== Main =====
(async()=>{
  console.log('===== CROSS CRITIC v16 =====\n');
  console.log('Providers: ChatGPT + Gemini + Copilot\n');
  var msg='PHẢN BIỆN AI: Chủ đề "AI governance — chính phủ hay cộng đồng mã nguồn mở?". Đưa quan điểm của bạn, 2-3 câu có lập luận rõ ràng.';
  const chain=['chat','gem','cop'];

  for(var n=0;n<6;n++){
    const turn=chain[n%3],round=Math.floor(n/3)+1;
    console.log('\n=== S'+(n+1)+' R'+round+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+msg.slice(0,120));

    var reply;
    if(turn==='chat')reply=await chat(msg,round);
    else if(turn==='gem')reply=await gem(msg);
    else reply=await cop(msg);

    if(!reply){console.log('  SKIP');msg='[FAIL:'+turn+'] '+msg.slice(0,100);continue;}
    msg=reply;
    console.log('  OK: '+reply.slice(0,150));

    const prev=reply.match(/^\[(\w+)\]/)?.[1]||turn;
    msg=`PHẢN BIỆN: Model ${prev} vừa nói: "${reply.slice(0,250)}" Hãy phản biện — phân tích điểm yếu lập luận, hoặc đưa góc nhìn đối lập. 2-3 câu ngắn gọn.`;
  }

  console.log('\n===== DONE ===');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
