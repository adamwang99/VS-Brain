// DeepSeek: test full type+send+response with native setter
const WS=require('ws'), http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)));r.on('error',()=>{})}));
const ev=(id,expr)=>new Promise(async o=>{try{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;o(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',()=>o('err'));
  setTimeout(()=>{try{w.close()}catch{};o('TO')},10000);
}catch(x){o(''+x)}});
const delay=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const ts=await tabs();const ds=ts.find(t=>t.url.includes('deepseek.com'));
  if(!ds){console.log('no tab');return;}
  
  const msg='1+1=?';
  console.log('=== DeepSeek Send Test ===\n');
  
  // 1. Native value setter + React input event
  console.log('1. Type using native setter...');
  var r=await ev(ds.id, `(function(){
    var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");
    if(!t)return"no-ta";
    // Use native setter to bypass React
    var nativeSetter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    nativeSetter.call(t,${JSON.stringify(msg)});
    // Fire events that React listens to
    t.dispatchEvent(new Event('input',{bubbles:true,cancelable:true}));
    t.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));
    return'tv:'+t.value+',np:'+t.getAttribute('value');
  })()`);
  console.log('Type:',r);
  
  // 2. Verify + send button click
  await delay(500);
  r=await ev(ds.id, `(function(){
    var t=document.querySelector("textarea[placeholder*=\\"Nhắn\\"]");
    return'value:'+t.value;
  })()`);
  console.log('Verify:',r);
  
  // Click the send button (circular primary)
  console.log('2. Click send button...');
  r=await ev(ds.id, `(function(){
    var btn=document.querySelector("div.ds-button--primary.ds-button--filled.ds-button--circle[role=\\"button\\"]");
    if(!btn)return"no-send";
    btn.click();
    return"clicked";
  })()`);
  console.log('Send:',r);
  
  // 3. Wait for response
  console.log('3. Waiting...');
  await delay(8000);
  
  r=await ev(ds.id, 'window.location.href');
  console.log('URL:',r);
  
  // Check body for response
  r=await ev(ds.id, 'document.body.innerText.slice(0,600)');
  console.log('Body:',r);
  
  // Try to find AI response element
  r=await ev(ds.id, `(function(){
    var last=document.querySelector("[class*=assistant],[class*=ai],[class*=bot],[class*=markdown],[class*=message]");
    if(!last)return"no-resp";
    return last.className.slice(0,80)+":"+last.innerText.slice(0,200);
  })()`);
  console.log('Resp el:',r);
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
