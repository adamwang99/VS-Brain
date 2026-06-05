// CrossCritic v10.1 — use existing ChatGPT thread, proper critique prompt
// For ChatGPT: stay on existing thread, send as new message (no navigation)
// For Gemini/DeepSeek: navigate fresh each round (they handle it fine)
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

function critiquePrompt(prevQuote, myName, prevName){
  return `=== CROSS-CRITIC RELAY ===
Bạn: ${myName}
Người trước (${prevName}) nói: "${prevQuote}"

Hãy phản biện câu trả lời của ${prevName}:
- ĐÚNG? Giải thích ngắn tại sao.
- SAI? Chỉ ra lỗi cụ thể + sửa.
- VÔ NGHĨA? Nói "VÔ NGHĨA" + lý do.

Trả lời 2-3 câu, KHÔNG chào hỏi, KHÔNG tự giới thiệu, KHÔNG "cảm ơn".`;
}

function cleanResponse(text){
  if(!text)return text;
  var t=text;
  t=t.replace(/^Chào\s+[^,]+,?\s*/i,'');
  t=t.replace(/^Cảm\s+ơn\s+\S+\s+[^,]*,?\s*/i,'');
  t=t.replace(/^Xin\s+chào\s*\S*\s*[!.,]?\s*/i,'');
  t=t.replace(/^Hi\s+\S*\s*[!.,]?\s*/i,'');
  t=t.trim().replace(/^[,.\s]+/,'').trim();
  return t;
}

// ========= CHATGPT (use existing thread) =========
async function chat(msg, prevName){
  const tid=(await tabs()).find(t=>t.url.includes('chatgpt.com')).id;
  const prompt=critiquePrompt(msg,'ChatGPT',prevName);
  console.log('  [ChatGPT] typing on existing thread...');

  // Count current messages
  var b4=parseInt(await ev(tid,'document.querySelectorAll("[data-message-author-role=assistant]").length'));
  console.log('  [ChatGPT] msgs:'+b4);

  // Type
  await ev(tid,'(function(){var e=document.querySelector("[contenteditable=\\"true\\"]");if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,'+J(prompt)+')})()');
  await dly(1500);

  // Send
  await ev(tid,'(function(){var b=document.querySelector("[data-testid=\\"send-button\\"]");b&&b.click()})()');
  console.log('  [ChatGPT] sent');

  // Wait — look for NEW assistant message with actual text
  // ChatGPT 5.5: response starts empty, need to check textContent not innerText
  const countEx='document.querySelectorAll("[data-message-author-role=assistant]").length';
  const stopEx='(function(){return document.querySelector("[data-testid=\\"stop-button\\"]")?"gen":"idle"})()';
  // Key fix: use textContent not innerText — and look at deepest p element for content
  const textEx='(function(){var es=document.querySelectorAll("[data-message-author-role=\\"assistant\\"]");if(!es.length)return null;var m=es[es.length-1];'
    +'var p=m.querySelector("p");if(p&&p.textContent.trim().length){return p.textContent};'
    +'var allP=m.querySelectorAll("p,li,td");for(var i=0;i<allP.length;i++){if(allP[i].textContent.trim().length)return allP[i].textContent};'
    +'var final=m.textContent;if(final&&final.trim().length)return final;'
    +'return null'
    +'})()';

  for(let i=0;i<60;i++){
    await dly(1000);
    const now=parseInt(await ev(tid,countEx));
    const stop=await ev(tid,stopEx);
    if(now>b4){
      const txt=await ev(tid,textEx);
      if(txt&&txt.length>0&&stop==='idle'){console.log('  [ChatGPT] @'+i+'s: '+txt.slice(0,100));return'[ChatGPT] '+cleanResponse(txt);}
      if(txt&&i<4)console.log('  [ChatGPT] stream: "'+(txt.slice(0,60)||'empty')+'"');
      // If stop=idle but no text, try body search
      if(stop==='idle'&&i>10){
        const bodyTxt=await ev(tid,'document.body.innerText.slice(0,500)');
        // Find the difference between this and the user's prompt
        // ChatGPT adds the response somewhere — try finding it
        const match=await ev(tid,"(function(){var es=document.querySelectorAll('[data-message-author-role=\\\"assistant\\\"]');if(!es.length)return null;return es[es.length-1].outerHTML})()");
        if(match&&match.length>50)console.log('  [ChatGPT] outerHTML '+i+'s: '+match.slice(100,200));
      }
    }
    if(i%10===0)console.log('  [ChatGPT] wait '+i+'s msgs='+now+' stop='+stop);
  }
  const final=await ev(tid,textEx);
  return final?'[ChatGPT] '+cleanResponse(final):null;
}

// ========= GEMINI (unchanged from v10) =========
async function gem(msg, prevName){
  const tid=(await tabs()).find(t=>t.url.includes('gemini.google.com')).id;
  const prompt=critiquePrompt(msg,'Gemini',prevName);
  console.log('  [Gemini] fresh...');
  try{await nav(tid,'https://gemini.google.com/app')}catch(e){}
  await dly(5000);

  await ev(tid,'(function(){var e=document.querySelector("[contenteditable=\\"true\\"]");if(!e)return;e.focus();e.innerText='+J(prompt)+';e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}))})()');
  await dly(1200);
  await ev(tid,'(function(){var e=document.querySelector("[contenteditable=\\"true\\"]");if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('  [Gemini] sent');
  await dly(8000);

  const ext='(function(){var m=document.querySelector("model-response");if(!m)return null;var c=m.cloneNode(true);c.querySelectorAll("h1,h2,h3").forEach(function(h){h.remove()});var t=c.textContent.trim();return t&&t.length>15?t:null})()';
  const stp='(function(){var sb=document.querySelector("[aria-label*=\\"ung\\"],[aria-label*=\\"ừng\\"]");if(sb)return"gen";var m=document.querySelector("model-response");if(!m)return"wait";var c=m.cloneNode(true);c.querySelectorAll("h1,h2,h3").forEach(function(h){h.remove()});var t=c.textContent.trim();return(t&&t.length>15)?t:"wait"})()';
  for(let i=0;i<35;i++){await dly(2000);const t=await ev(tid,ext);if(t){console.log('  [Gemini] @'+(i*2+8)+'s: '+t.slice(0,100));return'[Gemini] '+cleanResponse(t)}const s=await ev(tid,stp);if(s&&s!=='gen'&&s!=='wait'){console.log('  [Gemini] stop@'+(i*2+8)+'s: '+s.slice(0,100));return'[Gemini] '+cleanResponse(s)}if(i%5===0)console.log('  [Gemini] wait '+(i*2+8)+'s')}
  return null;
}

// ========= DEEPSEEK (unchanged from v10) =========
async function ds(msg, prevName){
  const tid=(await tabs()).find(t=>t.url.includes('deepseek.com')).id;
  const prompt=critiquePrompt(msg,'DeepSeek',prevName);
  console.log('  [DeepSeek] fresh...');
  await ev(tid,'window.location.href="https://chat.deepseek.com/"');
  await dly(4000);
  await ev(tid,'(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return;var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(t,'+J(prompt)+');t.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));t.dispatchEvent(new Event("change",{bubbles:true,cancelable:true}))})()');
  await dly(1200);
  const snd=await ev(tid,'(function(){var b=document.querySelector("div.ds-button--primary.ds-button--filled.ds-button--circle[role=\\"button\\"]");if(b){b.click();return"sent"}return"no"})()');
  console.log('  [DeepSeek] send:'+snd);
  await dly(8000);
  for(let i=0;i<25;i++){
    await dly(2000);
    const r=await ev(tid,'(function(){var ms=document.querySelectorAll(".ds-message");if(ms.length<2)return null;return ms[ms.length-1].innerText})()');
    if(r&&r.length>5){console.log('  [DeepSeek] @'+(i*2+8)+'s: '+r.slice(0,100));return'[DeepSeek] '+cleanResponse(r)}
    if(i%4===0)console.log('  [DeepSeek] wait '+(i*2+8)+'s')
  }
  return null;
}

// ========= MAIN =========
(async()=>{
  console.log('===== 3MODEL CRITIQUE v10.1 =====\n');
  const ts=await tabs();
  let cid,gid,did;
  ts.forEach(t=>{if(t.url.includes('chatgpt.com'))cid=t.id;if(t.url.includes('gemini.google.com'))gid=t.id;if(t.url.includes('deepseek.com'))did=t.id});
  if(!cid||!gid||!did){console.log('Missing tabs!');process.exit(1);}
  console.log('ChatGPT:'+cid+'\nGemini:'+gid+'\nDeepSeek:'+did);

  var seed='Tôi hỏi: 1+1=? và cũng muốn biết 2+2=?. Bạn chỉ trả lời 2 kết quả, không giải thích.';
  var res, prev, prevName;
  const names=['ChatGPT','Gemini','DeepSeek'];

  for(let s=0;s<9;s++){ // 3 rounds × 3 models
    const tn=s%3;
    const turn=tn===0?'chat':tn===1?'gem':'ds';
    const prevLabel=s===0?'(seed)':names[(s-1)%3];

    console.log('\n=== Step '+(s+1)+' '+turn.toUpperCase()+' ===');

    var reply;
    if(turn==='chat'){
      if(s===0) reply=await chat(seed,'(seed)');
      else reply=await chat(prev,prevLabel);
    }else if(turn==='gem'){
      if(s===1) reply=await gem(seed,'(seed)');
      else reply=await gem(prev,prevLabel);
    }else{
      if(s===2) reply=await ds(seed,'(seed)');
      else reply=await ds(prev,prevLabel);
    }

    if(!reply){console.log('  FAIL step '+(s+1));process.exit(1);}
    prev=reply;
    prevName=tn===0?'ChatGPT':tn===1?'Gemini':'DeepSeek';
    console.log('  OK: '+reply.slice(0,120));
  }

  console.log('\n===== DONE =====');
  console.log(prev.slice(0,500));
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
