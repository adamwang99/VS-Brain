// Copilot test: fresh nav + type + send + get real response
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
  const c=ts.find(x=>x.url.includes('copilot.microsoft.com')&&x.title);
  if(!c){console.log('NO COPILOT');return;}
  console.log('Tab:',c.id.slice(0,8));

  // Fresh nav
  await ev(c.id,'window.location.href="https://copilot.microsoft.com/"');
  console.log('Fresh nav...');
  await sl(8000);

  const ts2=await tab();
  const c2=ts2.find(x=>x.url.includes('copilot.microsoft.com')&&x.title);
  console.log('After nav:',c2.url.slice(0,80));

  // Check state - is there cookie popup?
  const body=await ev(c2.id,'document.body.innerText.slice(0,300)');
  console.log('Body:',body.replace(/\n/g,'|'));

  // Type with native setter
  const msg='Phản biện lập luận "AI nên do chính phủ kiểm soát hoàn toàn" — chỉ ra 2 điểm yếu, 2-3 câu.';
  await ev(c2.id,'window.__ct='+J(msg)+';null');
  const tr=await ev(c2.id,'(function(){var ta=document.querySelector("textarea");if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__ct);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return ta.value.slice(0,30)})()');
  console.log('Type:',tr);
  await sl(2000);

  // Check if there's a cookie/consent banner
  const ckBtns=await ev(c2.id,'(function(){var bs=document.querySelectorAll("button");var r=[];for(var i=0;i<bs.length;i++){var t=bs[i].innerText;if(t)r.push(i+":"+t.slice(0,30))}return JSON.stringify(r.slice(0,15))})()');
  console.log('Buttons:',ckBtns.slice(0,400));

  // Try Enter
  await ev(c2.id,'(function(){var ta=document.querySelector("textarea");if(!ta)return;ta.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,composed:true}));return"ok"})()');
  console.log('Enter sent');
  await sl(5000);

  // Monitor
  for(let i=0;i<20;i++){
    await sl(2000);
    const texts=await ev(c2.id,'(function(){var all=document.querySelectorAll("div,p");var r=[];for(var i=0;i<all.length;i++){var t=all[i].innerText;if(t&&t.length>20&&!t.includes("Copilot")&&!t.includes("Quyền")&&!t.includes("Start something")&&!t.includes("Tạm thời"))r.push(i+":"+t.slice(0,100))}return JSON.stringify(r.slice(0,8))})()');
    const body2=await ev(c2.id,'document.body.innerText.slice(0,300)');
    console.log('t='+(i*2+5)+' body:',body2.replace(/\n/g,'|'));
    if(texts.length>1)console.log('  texts:',texts.slice(0,500));
    if(body2.includes('chính phủ')||body2.includes('AI')||body2.includes('phản biện')||body2.includes('điểm yếu')){console.log('GOT RESPONSE!');break;}
  }

  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
