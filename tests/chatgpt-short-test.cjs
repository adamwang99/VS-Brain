// Quick ChatGPT SMALL test on existing conv
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();ok(r.result.result.value||r.result.result.description||null)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},8000);
});

async function sendAndCheck(msg){
  const c=await tabs().then(ts=>ts.find(t=>t.url.includes('chatgpt.com')));
  console.log('URL:',c.url);
  const b4=await ev(c.id,'document.querySelectorAll("[data-message-author-role=assistant]").length');
  const stop=await ev(c.id,'(function(){return document.querySelector("[data-testid=stop-button]")?"gen":"idle"})()');
  console.log('Stop state:',stop,', msgs:',b4);
  
  // Send short msg
  if(stop==='gen'){
    // Need to stop current generation first
    await ev(c.id,'(function(){var b=document.querySelector("[data-testid=stop-button]");b&&b.click()})()');
    await dly(2000);
  }
  
  // Type short test
  console.log('Typing...');
  await ev(c.id,`(function(){var e=document.querySelector("[contenteditable=true]");if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,${JSON.stringify(msg)})})()`);
  await dly(1000);
  
  await ev(c.id,'(function(){var b=document.querySelector("[data-testid=send-button]");b&&b.click()})()');
  console.log('Sent');
  
  // Check after 2s
  for(var i=0;i<20;i++){
    await dly(1000);
    var now=await ev(c.id,'document.querySelectorAll("[data-message-author-role=assistant]").length');
    var st=await ev(c.id,'(function(){return document.querySelector("[data-testid=stop-button]")?"gen":"idle"})()');
    var txt=await ev(c.id,'(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");if(!es.length)return null;var m=es[es.length-1];return JSON.stringify({inner:m.innerText.slice(0,200),text:m.textContent.slice(0,200),pTag:m.querySelector("p")?m.querySelector("p").outerHTML.slice(0,150):"no-p"})})()');
    if(txt) console.log(i+'s msgs='+now+' stop='+st+' txt='+txt.slice(0,200));
    if(now>b4 && st==='idle') break;
  }
  
  // Final check
  var last=await ev(c.id,'(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");if(!es.length)return null;var m=es[es.length-1];return JSON.stringify({inner:m.innerText.slice(0,300),text:m.textContent.slice(0,300)})})()');
  console.log('LAST:',last);
  process.exit(0);
}

sendAndCheck('1+1=?').catch(e=>{console.error(e);process.exit(1);});
