// Quick DOM scan for message elements on DeepSeek
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
  
  // Scan all classes containing 'message', 'chat', 'response', 'bubble'
  const msgs=await ev(d.id,'(function(){var r="";document.querySelectorAll("*").forEach(function(el){if(el.className&&typeof el.className=="string"){var c=el.className.toString();if(/(message|chat|response|bubble|answer|reply|turn)/i.test(c)){r+=el.tagName+"."+c.slice(0,80)+"|length:"+el.innerText.length+"|text:"+el.innerText.slice(0,50)+"\\n"}}});return r||"none"})()');
  console.log('Message-like elements:');
  console.log(msgs.slice(0,2000));
  
  // Also check ds- classes
  const ds=await ev(d.id,'(function(){var r="";document.querySelectorAll("[class*=ds-]").forEach(function(el){var c=el.className.toString().slice(0,60);r+=el.tagName+"."+c+"\\n"});return r.slice(0,1000)})()');
  console.log('\n[class*=ds-]:');
  console.log(ds.slice(0,1000));
  
  // Check specific attributes
  const attrs=await ev(d.id,'(function(){var r="";document.querySelectorAll("[data-role],[data-testid],[role]").forEach(function(el,i){if(i<20)r+=el.tagName+" role:"+el.getAttribute("role")+" data-role:"+el.getAttribute("data-role")+" data-testid:"+el.getAttribute("data-testid")+"\\n"});return r||"none"})()');
  console.log('\nSpecial attributes (first 20):');
  console.log(attrs);
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
