// Grok solo: test type+send+response with cookie dismissal
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
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},8000);
})}

(async()=>{
  const ts=await tab();
  const g=ts.find(x=>x.url.includes('grok.com')&&!x.url.includes('stripe'));
  
  // First dismiss cookie + connectors popup
  console.log('=== GROK - dismissing popups ===');
  const body1=await ev(g.id,'document.body.innerText.slice(0,300)');
  console.log('Body:',body1.replace(/\n/g,'|'));

  // Find and click cookie accept
  const ck=await ev(g.id,'(function(){var btns=document.querySelectorAll("button");for(var i=0;i<btns.length;i++){var t=btns[i].innerText;if(t.includes("Accept")||t.includes("Chấp")||t.includes("Đồng")){btns[i].click();return"clicked:"+t}if(t.includes("Bỏ qua")||t.includes("Skip")){btns[i].click();return"skip:"+t}}return"none"})()');
  console.log('Cookie dismiss:',ck);
  await sl(3000);

  // Find and dismiss connectors popup
  const pop=await ev(g.id,'(function(){var btns=document.querySelectorAll("button");for(var i=0;i<btns.length;i++){var t=btns[i].innerText;if(t.includes("Bỏ qua")||t.includes("Skip")||t.includes("Kết nối")){btns[i].click();return"clicked:"+t}}return"none"})()');
  console.log('Connectors dismiss:',pop);
  await sl(2000);

  // Now type and send
  const msg='Phản biện: AI nên do chính phủ kiểm soát hay cộng đồng mã nguồn mở? 2-3 câu.';
  await ev(g.id,'window.__ct='+J(msg)+';null');
  
  // Type into input
  const tr=await ev(g.id,'(function(){var inp=document.querySelector("textarea,[contenteditable=true],[role=textbox]");if(!inp){var ta=document.querySelector("textarea");inp=ta}if(!inp)return"no-input";inp.focus();if(inp.value!==undefined){inp.value=window.__ct;inp.dispatchEvent(new InputEvent("input",{bubbles:true}))}else{inp.innerText=window.__ct;inp.dispatchEvent(new InputEvent("input",{bubbles:true}))}return"ok:"+(inp.tagName||"div")})()');
  console.log('Type:', tr);
  await sl(2000);

  // Press Enter
  await ev(g.id,'(function(){var inp=document.querySelector("textarea,[contenteditable=true],[role=textbox]");if(!inp)return;inp.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok"})()');
  console.log('Send done');
  
  // Wait for response
  for(let i=0;i<25;i++){
    await sl(2000);
    const body=await ev(g.id,'(function(){var all=document.body.innerText;return all.slice(0,500)})()');
    const texts=await ev(g.id,'(function(){var all=document.querySelectorAll("div, p");var r=[];for(var i=0;i<all.length;i++){var t=all[i].innerText&&all[i].innerText.trim();if(t&&t.length>30&&!t.includes("Bạn đang nghĩ")&&!t.includes("cookie")&&!t.includes("Cookie")&&!t.includes("Adam")&&!t.includes("Bật/tắt")&&!t.includes("Tìm kiếm")&&!t.includes("Chat mới")&&!t.includes("Imagine")&&!t.includes("Dự án")&&!t.includes("Riêng tư")&&!t.includes("m.stripe")&&!t.includes("js.stripe"))r.push(i+":"+t.slice(0,120))}return JSON.stringify(r.slice(0,10))})()');
    console.log('t='+(i*2+5)+': body:',body.slice(0,150).replace(/\n/g,'|'));
    console.log('  matches:',texts.slice(0,500));
    if(texts.length>5)break;
  }
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
