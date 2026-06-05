// DeepSeek: test type + send via Enter key
const WS=require('ws'), http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)));r.on('error',()=>{})}));
const ev=(id,expr)=>new Promise(async o=>{try{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;o(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',()=>o('err'));
  setTimeout(()=>{try{w.close()}catch{};o('TO')},8000);
}catch(x){o(''+x)}});
const delay=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const ts=await tabs();const ds=ts.find(t=>t.url.includes('deepseek.com'));
  if(!ds){console.log('no tab');return;}
  
  // Type text into textarea
  const msg='1+1=?';
  console.log('1. Type...');
  var r=await ev(ds.id, 'document.querySelector("textarea[placeholder*=\\"Nhắn\\"]") ? "found ta" : "no ta"');
  console.log('Textarea:',r);
  
  r=await ev(ds.id, `(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no";t.focus();t.value=${JSON.stringify(msg)};t.dispatchEvent(new Event("input",{bubbles:true}));t.dispatchEvent(new Event("change",{bubbles:true}));return"typed:"+t.value})()`);
  console.log('Type result:',r);
  await delay(1000);
  
  // Verify text is in textarea
  r=await ev(ds.id, `document.querySelector("textarea[placeholder*=\\"Nhắn\\"]").value`);
  console.log('Verify value:',r);
  
  // Send Enter
  console.log('2. Send Enter...');
  r=await ev(ds.id, `(function(){var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");if(!t)return"no";t.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true,cancelable:true,composed:true}));return"sent"})()`);
  console.log('Send result:',r);
  
  // Wait for response
  console.log('3. Wait for response...');
  await delay(10000);
  
  // Check page state
  r=await ev(ds.id, 'window.location.href');
  console.log('URL after:',r);
  
  // Look for response text
  r=await ev(ds.id, 'JSON.stringify({body:document.body.innerText.slice(0,500),url:window.location.href})');
  console.log('Page state:',r);
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
