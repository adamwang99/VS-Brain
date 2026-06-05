// Soft reset ChatGPT: navigate to fresh URL via Page.navigate, wait for full load
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const dly=ms=>new Promise(r=>setTimeout(r,ms));

function nav(id,url){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();ok(r.result)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},15000);
})}

function ev(id,expr,to=20000){return new Promise(async(ok,rej)=>{
  const ts=await tabs();const t=ts.find(x=>x.id===id);
  if(!t)return rej('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});
  w.on('error',rej);
  setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},to);
})}

(async()=>{
  const c=(await tabs()).find(t=>t.url.includes('chatgpt.com'));
  if(!c){console.log('no');return;}
  
  console.log('1. Navigate to google...');
  await nav(c.id,'https://google.com');
  await dly(3000);
  
  console.log('2. Navigate to ChatGPT...');
  const navUrl='https://chatgpt.com/?model=gpt-5-4'; // Try different model
  await nav(c.id,navUrl);
  await dly(5000);
  
  console.log('3. URL:',await ev(c.id,'window.location.href'));
  await dly(3000);
  
  // Check page loaded
  console.log('4. Title:',await ev(c.id,'document.title'));
  console.log('5. Contenteditable:',await ev(c.id,'(function(){var e=document.querySelector("[contenteditable=true]");return e?"yes len:"+e.innerText.length:"no"})()'));
  
  // Send test
  console.log('6. Sending...');
  await ev(c.id,`(function(){var e=document.querySelector("[contenteditable=true]");if(!e)return;e.focus();e.innerText="";var s=window.getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand("insertText",false,"test")})()`);
  await dly(1500);
  console.log('7. Typed:',await ev(c.id,'(function(){var e=document.querySelector("[contenteditable=true]");return e?e.innerText.slice(0,30):"no"})()'));
  
  await ev(c.id,'(function(){var b=document.querySelector("[data-testid=send-button]");if(b){b.click();return"sent"}return"no-btn"})()');
  console.log('8. Sent');
  
  // Wait for response
  for(var i=0;i<30;i++){
    await dly(1000);
    var msgs=await ev(c.id,'document.querySelectorAll("[data-message-author-role=assistant]").length');
    var stop=await ev(c.id,'(function(){return document.querySelector("[data-testid=stop-button]")?"gen":"idle"})()');
    if(msgs>0){
      var txt=await ev(c.id,'(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");if(!es.length)return null;return es[es.length-1].innerText})()');
      console.log(i+'s msgs='+msgs+' stop='+stop+' txt="'+(txt||'').slice(0,80)+'"');
      if(txt&&txt.length>0&&stop==='idle'){console.log('RESPONSE GOT!');break;}
    }
    if(i%5===0)console.log(i+'s msgs='+msgs+' stop='+stop);
  }
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
