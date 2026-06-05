// relay-v7.cjs — Fix all escaping, full loop
const WS=require('ws'), http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)));r.on('error',()=>{})}));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const esc=JSON.stringify;

function ev(id,expr,to=20000){return new Promise(async o=>{try{
  const ts=await tabs(); const t=ts.find(x=>x.id===id);
  if(!t)return o('no-tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;o(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',()=>o('ws-err'));
  setTimeout(()=>{try{w.close()}catch{};o('TO')},to);
}catch(x){o(''+x)}})}

function nav(id,url){return new Promise(async o=>{try{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return o('no-tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();o(r.result)}});
  w.on('error',()=>o('ws-err'));
  setTimeout(()=>{try{w.close()}catch{};o('nav-TO')},20000);
}catch(x){o(''+x)}})}

// Chat helper - build expressions with proper escaping
function chatExpr(fnBody, ...args) {
  // fnBody: JS code that references $1, $2, etc.
  // args: values to esc-insert
  let body = fnBody;
  args.forEach((a,i) => { body = body.replace(new RegExp('\\$'+(i+1),'g'), esc(a)); });
  return '(function(){' + body + '})()';
}

function gemExpr(fnBody, ...args) {
  let body = fnBody;
  args.forEach((a,i) => { body = body.replace(new RegExp('\\$'+(i+1),'g'), esc(a)); });
  return '(function(){' + body + '})()';
}

async function chatGPT(msg){
  const tid=(await tabs()).find(t=>t.url.includes('chatgpt.com')).id;
  const before=await ev(tid,'document.querySelectorAll("[data-message-author-role=assistant]").length');
  console.log('  [chat] msgs:'+before+', typing: '+msg.slice(0,40));

  // Type
  const exprTyp=`(function(){var e=document.querySelector('[contenteditable="true"]');if(!e)return;e.focus();e.innerText='';var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand('insertText',false,${esc(msg)});})()`;
  await ev(tid, exprTyp);
  await delay(1000);

  const exprSnd=`(function(){var b=document.querySelector('[data-testid="send-button"]');if(b){b.click();return'sent'}return'none'})()`;
  const snd=await ev(tid, exprSnd);
  console.log('  [chat] send:'+snd);

  const exprLast=`(function(){var e=document.querySelector('[data-message-author-role="assistant"]:last-child');return e?e.innerText:null})()`;
  const exprStop=`(function(){return document.querySelector('[data-testid="stop-button"]')?'gen':'idle'})()`;
  const exprCt=`document.querySelectorAll('[data-message-author-role="assistant"]').length`;

  for(let i=0;i<50;i++){
    await delay(1000);
    const now=await ev(tid, exprCt);
    const stop=await ev(tid, exprStop);
    if(now>before){
      var txt=await ev(tid, exprLast);
      if(txt && txt.length>0 && stop==='idle'){console.log('  [chat] res '+i+'s: "'+txt.slice(0,80)+'"');return txt;}
      if(txt && txt.length>0 && i<3) console.log('  [chat] streaming '+i+'s: "'+txt.slice(0,60)+'"');
    }
    if(i%5===0) console.log('  [chat] wait '+i+'s stop='+stop+' msgs='+now+'/'+before);
  }
  var last=await ev(tid, exprLast);
  if(last&&last.length>0){console.log('  [chat] final: "'+last.slice(0,80)+'"');return last;}
  return null;
}

async function gemini(msg){
  const tid=(await tabs()).find(t=>t.url.includes('gemini.google.com')).id;
  console.log('  [gem] navigating /app...');
  try{await nav(tid,'https://gemini.google.com/app')}catch(e){}
  await delay(5000);

  const exprTyp=`(function(){var e=document.querySelector('[contenteditable="true"]');if(!e)return;e.focus();e.innerText=${esc(msg)};e.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,composed:true}));})()`;
  await ev(tid, exprTyp);
  await delay(1000);
  var chk=await ev(tid,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e? "len:"+e.innerText.length:"no"})()');
  console.log('  [gem] type check: '+chk);
  await delay(500);

  await ev(tid, '(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent(\'keydown\',{key:\'Enter\',code:\'Enter\',keyCode:13,bubbles:true,cancelable:true,composed:true}));})()');
  console.log('  [gem] sent');
  await delay(8000);

  for(var i=0;i<25;i++){
    await delay(2000);
    var txt=await ev(tid, '(function(){var m=document.querySelector(\'model-response\');if(!m)return null;var t=m.textContent;return(t&&t.length>0)?t.trim():null})()');
    if(txt && txt!==null && txt.length>0){console.log('  [gem] res '+(i*2+8)+'s: "'+txt.slice(0,80)+'"');return txt;}
    var st=await ev(tid, '(function(){var sb=document.querySelector(\'[aria-label*="ung"],[aria-label*="ừng"]\');if(sb)return"gen";var m=document.querySelector(\'model-response\');if(!m||!m.textContent||m.textContent.length<1)return"wait";return m.textContent.trim()})()');
    if(st && st!=='gen' && st!=='wait' && st.length>0){console.log('  [gem] stop '+(i*2+8)+'s: "'+st.slice(0,80)+'"');return st;}
    if(i%3===0) console.log('  [gem] wait '+(i*2+8)+'s');
  }
  return null;
}

(async()=>{
  console.log('===== CROSS CRITIC RELAY v7 =====\n');
  const ts=await tabs();
  var chatId,gemId;
  ts.forEach(function(t){if(t.url.includes('chatgpt.com'))chatId=t.id;if(t.url.includes('gemini.google.com'))gemId=t.id;});
  if(!chatId||!gemId){console.log('Missing tabs');process.exit(1);}
  console.log('ChatGPT: '+chatId+'\nGemini: '+gemId);

  var m='Chỉ trả lời kết quả, không giải thích: 1+1=?';
  var turn='chat';

  for(var r=1;r<=3;r++){
    console.log('\n=== ROUND '+r+' '+turn.toUpperCase()+' ===');
    var reply;
    if(turn==='chat'){ reply=await chatGPT(m); turn='gem'; }
    else{ reply=await gemini(m); turn='chat'; }
    if(!reply||reply.length<1){console.log('  FAIL ROUND '+r);break;}
    m=reply;
    console.log('  PASS ROUND '+r+': "'+m.slice(0,80)+'"');
  }
  console.log('\n===== DONE =====');
  console.log('Final: "'+m.slice(0,300)+'"');
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
