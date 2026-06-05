// CrossCritic v14 — Fixed: Gemini tab filter, DeepSeek nav to main page + wait for messages
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const J=JSON.stringify;

async function findTab(p){const ts=await tabs();return ts.find(t=>t.url&&t.url.includes(p)&&!t.url.includes('RotateCookiesPage'));}
async function findGemini(){const ts=await tabs();return ts.find(t=>t.url&&t.url.includes('gemini.google.com/app'));}

function ev(id,expr,to=20000){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
})}

async function setMsg(id,msg){return ev(id,'window.__cv='+J(msg)+';1')}

// ===== CHATGPT =====
async function chat(msg,round){
  console.log('  [C] fresh r'+round);
  let t=await findTab('chatgpt.com'); if(!t)return null;
  await ev(t.id,'window.location.href="https://chatgpt.com/"');
  await dly(5000);
  t=await findTab('chatgpt.com'); if(!t)return null;

  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,window.__cv)})()');
  await dly(1500);
  await ev(t.id,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');if(b)b.click()})()');
  console.log('  [C] sent');
  await dly(3000);

  for(let i=0;i<60;i++){await dly(1000);
    const txt=await ev(t.id,'(function(){var e=document.querySelector(\'[data-message-author-role="assistant"]:last-child\');return e?e.innerText:null})()');
    const sg=await ev(t.id,'(function(){return document.querySelector(\'[data-testid="stop-button"]\')?"gen":"idle"})()');
    if(txt&&txt.length>=5&&sg==='idle'){console.log('  [C]='+txt.slice(0,120));return'[ChatGPT] '+txt;}
    if(i%15===0)console.log('  [C] w'+i);
  } return null;
}

// ===== GEMINI =====
async function gem(msg){
  console.log('  [G] type on page');
  const t=await findGemini(); if(!t){console.log('  [G] no gemini/app tab');return null;}
  console.log('  [G] using '+t.id.slice(0,8));

  await setMsg(t.id,msg);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText=window.__cv;e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1500);
  await ev(t.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [G] sent');
  await dly(10000);

  // TX: strip "Gemini đã nói" from anywhere in text
  const TX="(function(){var m=document.querySelector('model-response');if(!m)return null;var t=m.textContent;if(!t||t.length<5)return null;var idx=t.indexOf('Gemini đã nói');if(idx>=0){t=t.substring(idx+13);}t=t.trim();return t.length>5?t:null})()";
  const ST='(function(){var sb=document.querySelector(\'[aria-label*="ung"],[aria-label*="ừng"]\');return sb?"gen":"idle"})()';

  for(let i=0;i<30;i++){await dly(2000);
    const raw=await ev(t.id,TX);
    const sg=await ev(t.id,ST);
    if(raw&&raw.length>5&&sg==='idle'){console.log('  [G]='+raw.slice(0,120));return'[Gemini] '+raw;}
    if(raw&&sg==='gen')continue;
    if(i%5===0)console.log('  [G] w'+((i*2)+10));
  } return null;
}

// ===== DEEPSEEK =====
async function ds(msg){
  console.log('  [D] nav to main...');
  let t=await findTab('deepseek.com'); if(!t)return null;
  
  // Nav to main page
  await ev(t.id,'window.location.href="https://chat.deepseek.com/"');
  await dly(6000);
  t=await findTab('deepseek.com'); if(!t)return null;
  console.log('  [D] loaded: '+t.url.slice(0,80));

  await setMsg(t.id,msg);
  const tr=await ev(t.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cv);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('  [D] type:'+tr);
  if(tr!=='ok')return null;
  await dly(1500);

  const snd=await ev(t.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b){b.click();return"ok"}return"null"})()');
  console.log('  [D] send:'+snd);
  await dly(3000);

  // Save message count before response
  const b4=parseInt(await ev(t.id,'document.querySelectorAll(".ds-message").length'));
  console.log('  [D] msgs-b4:'+b4);
  await dly(5000);

  for(let i=0;i<30;i++){await dly(2000);
    const now=parseInt(await ev(t.id,'document.querySelectorAll(".ds-message").length'));
    if(now>b4+1){ // user msg + assistant response
      const r=await ev(t.id,'(function(){var ms=document.querySelectorAll(".ds-message");return ms[ms.length-1].innerText})()');
      if(r&&r.length>5){console.log('  [D]='+r.slice(0,120));return'[DeepSeek] '+r;}
    }
    if(i%5===0){
      const url=await ev(t.id,'window.location.href');
      console.log('  [D] w'+((i*2)+10)+' url:'+(url.includes('deepseek')?'ok':'??')+' msgs:'+now);
    }
  } return null;
}

// ===== MAIN =====
(async()=>{
  console.log('===== CROSS CRITIC v14 =====\n');
  const c=await findTab('chatgpt.com'), g=await findGemini(), d=await findTab('deepseek.com');
  if(!c||!g||!d){console.log('Missing: c='+!!c+' g='+!!g+' d='+!!d);process.exit(1);}
  console.log('C:'+c.id+'\nG:'+g.id+'\nD:'+d.id);

  var msg='PHẢN BIỆN AI: Chủ đề "AI governance — chính phủ hay cộng đồng mã nguồn mở?". Đưa quan điểm của bạn, 2-3 câu, có lập luận.';
  const chain=['chat','gem','ds'];

  for(var n=0;n<6;n++){
    const turn=chain[n%3],round=Math.floor(n/3)+1;
    console.log('\n=== S'+(n+1)+' R'+round+' '+turn.toUpperCase()+' ===');
    console.log('IN: '+msg.slice(0,100));

    var reply;
    if(turn==='chat')reply=await chat(msg,round);
    else if(turn==='gem')reply=await gem(msg);
    else reply=await ds(msg);

    if(!reply){console.log('  SKIP');msg='[FAIL:'+turn+'] '+msg.slice(0,100);continue;}
    msg=reply;
    console.log('  OK: '+reply.slice(0,120));

    const prev=reply.match(/^\[(\w+)\]/)?.[1]||turn;
    msg=`PHẢN BIỆN: Model ${prev} vừa nói: "${reply.slice(0,200)}" Hãy phản biện — phân tích điểm yếu, hoặc đưa góc nhìn đối lập. 2-3 câu.`;
  }

  console.log('\n===== DONE =====');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
