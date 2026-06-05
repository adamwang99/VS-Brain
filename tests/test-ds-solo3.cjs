// DeepSeek solo v3: monitor body text for new content after send (bypass class selectors)
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
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},8000);
})}

(async()=>{
  const ts=await t();
  const d=ts.find(x=>x.url.includes('deepseek.com'));
  console.log('URL:',d.url.slice(0,100));
  
  // Navigate to main page fresh
  await ev(d.id,'window.location.href="https://chat.deepseek.com/"');
  console.log('Fresh...');
  await sl(8000);
  
  const ts2=await t();
  const d2=ts2.find(x=>x.url.includes('deepseek.com'));
  console.log('After nav:',d2.url.slice(0,80));
  
  // Get baseline body text (just main content, skip sidebar)
  const b4=await ev(d2.id,'(function(){return document.body.innerText.replace(/Hôm nay.*$/ms,"").slice(0,100)})()');
  console.log('Baseline:',b4);
  
  // Type
  const msg='Hãy phản biện lập luận này trong 3 câu: "Chính phủ nên kiểm soát AI vì lợi ích quốc gia"';
  await ev(d2.id,'window.__cd='+J(msg)+';null');
  const tr=await ev(d2.id,'(function(){var ta=document.querySelector(\'textarea[placeholder*="Nhắn"]\');if(!ta)return"no-ta";ta.focus();var ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;ns.call(ta,window.__cd);ta.dispatchEvent(new Event("input",{bubbles:true,cancelable:true}));return"ok"})()');
  console.log('Type:',tr);
  if(tr!=='ok'){process.exit(1);}
  await sl(2000);
  
  // Send
  const snd=await ev(d2.id,'(function(){var b=document.querySelector(\'div.ds-button--primary.ds-button--filled.ds-button--circle[role="button"]\');if(b)b.click();return"ok"})()');
  console.log('Send:',snd);
  await sl(5000);
  
  // Monitor body text and URL changes
  for(let i=0;i<30;i++){
    await sl(2000);
    const url=await ev(d2.id,'window.location.href');
    const txt=await ev(d2.id,'(function(){var all=document.body.innerText;var idx=all.indexOf("Hôm nay");if(idx>0)all=all.substring(0,idx);return all.slice(0,500)})()');
    console.log('t='+(i*2+7)+' url:'+url.slice(40,110)+' txt:'+txt.slice(0,100));
    
    // Check if URL changed to a conversation
    if(url.includes('/a/chat/s/') && url!==d2.url){
      console.log('URL changed!');
      // Check for messages on new URL
      await sl(3000);
      const ms=await ev(d2.id,'(function(){var p=document.querySelectorAll("p");var r=[];p.forEach(function(pp,i){if(i<10)r.push(pp.innerText.slice(0,80))});return JSON.stringify(r)})()');
      console.log('P texts:',ms);
    }
    
    // Stop when we see response content longer than 50 chars after our msg
    if(txt.length>150 && txt!==b4){
      console.log('NEW CONTENT DETECTED!');
      console.log('Full:', txt);
      break;
    }
  }
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
