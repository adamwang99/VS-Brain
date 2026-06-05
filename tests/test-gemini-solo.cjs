// Test Gemini: type+send+wait for response, check all DOM state
const WS=require('ws'),http=require('http');
const J=JSON.stringify;
const t=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const sl=m=>new Promise(r=>setTimeout(r,m));

function ev(id,e){return new Promise(async(ok)=>{
  const ts=await t();const tab=ts.find(x=>x.id===id);
  if(!tab)return ok('no tab');
  const w=new WS(tab.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:e,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},15000);
})}

(async()=>{
  const ts=await t();
  const gem=ts.find(x=>x.url.includes('gemini.google.com/app'));
  if(!gem){console.log('No Gemini tab');return;}
  console.log('Tab:',gem.id.slice(0,8));

  // Check model-response exists before anything
  const mr=await ev(gem.id,'document.querySelectorAll("model-response").length');
  console.log('model-response count:',mr);

  // Check contenteditable
  const ce=await ev(gem.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');return e?"exists:"+e.innerText.slice(0,50):"none"})()');
  console.log('contenteditable:',ce);

  // Type a simple message
  const msg='Phản biện: Hãy phân tích lập luận \"AI nên do chính phủ quản lý\"';
  await ev(gem.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.focus();e.innerText='+J(msg)+';e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,composed:true}));return"typed"})()');
  console.log('Typed');
  await sl(2000);

  // Press Enter
  await ev(gem.id,'(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return;e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}))})()');
  console.log('Enter pressed');
  await sl(5000);

  // Check model-response again after send
  const mr2=await ev(gem.id,'document.querySelectorAll("model-response").length');
  console.log('model-response after send:', mr2);

  // Check stop button
  const st=await ev(gem.id,'document.querySelectorAll("[aria-label*=\'ung\'],[aria-label*=\'ừng\']").length');
  console.log('stop buttons:',st);

  // Check body text
  const bd=await ev(gem.id,'document.body.innerText.slice(0,500)');
  console.log('Body:',bd);

  // Check if any model-response exists and what its innerHTML looks like
  const html=await ev(gem.id,'(function(){var m=document.querySelector("model-response");if(!m)return"none";var h=m.innerHTML;h=h.replace(/</g,"<");h=h.replace(/>/g,">");return h.slice(0,800)})()');
  console.log('model-response innerHTML:',html);

  // Wait more and check for response
  await sl(15000);
  const mr3=await ev(gem.id,'(function(){var m=document.querySelector("model-response");if(!m)return"none";var t=m.textContent;return t.slice(0,200)})()');
  console.log('model-response after 20s:',mr3);

  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
