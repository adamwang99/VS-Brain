// Debug Gemini: fresh nav + type + send, check ALL DOM state
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
  const g=ts.find(x=>x.url.includes('gemini.google.com/app'));
  if(!g){console.log('NO GEMINI');return;}
  console.log('Tab:',g.id.slice(0,8),g.url.slice(0,80));

  // 1. Check contenteditable before anything
  const ce=await ev(g.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e?"exists:"+e.innerText.slice(0,50):"none"})()');
  const mr=await ev(g.id,'document.querySelectorAll("model-response").length');
  const mrContent=await ev(g.id,'(function(){var m=document.querySelector("model-response");return m?m.textContent.slice(0,100):"none"})()');
  console.log('Before CE:',ce,' MR:',mr,' Content:',mrContent);

  // 2. Navigate to fresh chat — use a hack: click "New chat" if available
  const ncBtns=await ev(g.id,'(function(){var as=document.querySelectorAll("a");for(var i=0;i<as.length;i++){if(as[i].href&&as[i].href.includes("/app")&&!as[i].href.includes("/new"))return"old"}var h=document.querySelectorAll("a[href*=\'/new\'],a[href=\'/\'],button,div");for(i=0;i<h.length;i++){var t=h[i].innerText;if(t.includes("New")||t.includes("Mới")||t.includes("Cuộc trò chuyện"))return"found:"+t.slice(0,20)}return"none"})()');
  console.log('New chat options:', ncBtns);

  // Use location.href with /new to force new
  await ev(g.id,'window.location.href="https://gemini.google.com/new"');
  console.log('Nav to /new...');
  await sl(8000);

  // 3. Check state after nav
  const ts2=await tab();
  const g2=ts2.find(x=>x.url.includes('gemini.google.com'));
  console.log('After nav:',g2.url.slice(0,80));

  // Check contenteditable
  const ce2=await ev(g2.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e?"exists:innertext:"+e.innerText.slice(0,50):"none"})()');
  const mr2=await ev(g2.id,'document.querySelectorAll("model-response").length');
  console.log('After CE:',ce2,' MR:',mr2);

  // 4. Type
  const msg='Phản biện: AI có nên do chính phủ kiểm soát không? 2-3 câu.';
  await ev(g2.id,'window.__cv='+J(msg)+';null');
  await ev(g2.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return"no";e.focus();e.innerText=window.__cv;e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}));return"typed"})()');
  await sl(2000);
  
  // CE verify
  const ce3=await ev(g2.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e&&e.innerText.includes("Phản biện")?"has-text":"no-text"})()');
  console.log('CE has text:', ce3);

  // 5. Enter key
  // First check what send options exist
  const sendBtns=await ev(g2.id,'(function(){var bs=document.querySelectorAll("[role=button],button");var r=[];for(var i=0;i<Math.min(bs.length,10);i++){var off=bs[i].offsetWidth+"x"+bs[i].offsetHeight;var cls=bs[i].className.slice(0,30);r.push(i+":"+cls+":"+off)}return JSON.stringify(r)})()');
  console.log('Send candidates:', sendBtns.slice(0,400));
  
  await ev(g2.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('Enter sent');
  await sl(3000);

  // 6. Monitor all text changes (not just model-response)
  for(let i=0;i<15;i++){
    await sl(2000);
    const body=await ev(g2.id,'document.body.innerText.slice(0,500)');
    const mr3=await ev(g2.id,'document.querySelectorAll("model-response").length');
    const ct3=await ev(g2.id,'(function(){var m=document.querySelector("model-response");return m?m.textContent.slice(0,150):"none"})()');
    const cEdit=await ev(g2.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e?e.innerText.slice(0,50):"none"})()');
    console.log('t='+(i*2+3)+' CE:'+cEdit+' MR:'+mr3+' mrText:'+ct3.slice(0,80));
    if(i%3===0)console.log('  body:',body.replace(/\n/g,'|').slice(0,200));
    if(mr3>0&&ct3.length>20&&!ct3.includes('Gemini đã nói'))break;
  }

  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
