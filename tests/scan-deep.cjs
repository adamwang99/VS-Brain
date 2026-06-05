// Deep DOM scan for all 8 providers
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
  
  // ChatGPT
  const c=ts.find(x=>x.url.includes('chatgpt.com'));
  console.log('=== ChatGPT ===');
  const cBtn=await ev(c.id,'(function(){var b=document.querySelector(\'[data-testid="send-button"]\');return b?"send-ok:clickable":"none"})()');
  const cCE=await ev(c.id,'document.querySelectorAll("[contenteditable=true]").length');
  console.log('CE:',cCE,'Send:',cBtn);
  
  // Gemini
  const g=ts.find(x=>x.url.includes('gemini.google.com/app'));
  console.log('\n=== Gemini ===');
  const gCE=await ev(g.id,'document.querySelectorAll("[contenteditable=true]").length');
  const gLast=await ev(g.id,'(function(){var m=document.querySelector("model-response");if(!m)return"none";return m.textContent.slice(0,100)})()');
  console.log('CE:',gCE,'LastResp:',gLast);
  
  // DeepSeek
  const d=ts.find(x=>x.url.includes('chat.deepseek.com'));
  console.log('\n=== DeepSeek ===');
  const dTA=await ev(d.id,'(function(){var t=document.querySelector("textarea");return t?t.placeholder.slice(0,30):"none"})()');
  const dBtn=await ev(d.id,'(function(){var bs=document.querySelectorAll("[role=button]");for(var i=0;i<bs.length;i++){if(bs[i].offsetWidth>10&&bs[i].offsetHeight>10)return bs[i].className.slice(0,50)+":"+bs[i].offsetWidth+"x"+bs[i].offsetHeight}return"none"})()');
  console.log('TA:',dTA,'Btn:',dBtn);
  
  // Qwen
  const q=ts.find(x=>x.url==='https://chat.qwen.ai/');
  console.log('\n=== Qwen ===');
  const qTA=await ev(q.id,'(function(){var t=document.querySelector("textarea");return t?t.placeholder.slice(0,40):"none"})()');
  const qBtn=await ev(q.id,'(function(){var bs=document.querySelectorAll("button");for(var i=0;i<bs.length;i++){var w=bs[i].offsetWidth,h=bs[i].offsetHeight;if(w>20&&h>20)return bs[i].className.slice(0,40)+":"+w+"x"+h}return"none"})()');
  console.log('TA:',qTA,'Btn:',qBtn);
  
  // Claude
  const cl=ts.find(x=>x.url.includes('chat.chatbotapp.ai'));
  console.log('\n=== Claude ===');
  const clTA=await ev(cl.id,'(function(){var t=document.querySelector("textarea");return t?t.placeholder.slice(0,40):"none"})()');
  const clBtn=await ev(cl.id,'(function(){var bs=document.querySelectorAll("button");for(var i=0;i<bs.length;i++){if(bs[i].offsetWidth>20&&bs[i].offsetHeight>20)return bs[i].className.slice(0,40)}return"none"})()');
  console.log('TA:',clTA,'Btn:',clBtn);
  
  // Copilot
  const cp=ts.find(x=>x.url==='https://copilot.microsoft.com/');
  console.log('\n=== Copilot ===');
  const cpTA=await ev(cp.id,'(function(){var t=document.querySelector("textarea");return t?t.placeholder.slice(0,40):"none"})()');
  const cpBtn=await ev(cp.id,'(function(){var bs=document.querySelectorAll("button");for(var i=0;i<bs.length;i++){var off=bs[i].offsetWidth;if(off>30)return bs[i].className.slice(0,50)}return"none"})()');
  console.log('TA:',cpTA,'Btn:',cpBtn);
  
  // Perplexity
  const pp=ts.find(x=>x.url.includes('perplexity.ai')&&x.title);
  console.log('\n=== Perplexity ===');
  const ppCE=await ev(pp.id,'document.querySelectorAll("[contenteditable=true]").length');
  const ppBtn=await ev(pp.id,'(function(){var bs=document.querySelectorAll("[role=button]");for(var i=0;i<bs.length;i++){var off=bs[i].offsetWidth;if(off>30)return bs[i].className.slice(0,60)}return"none"})()');
  console.log('CE:',ppCE,'Btn:',ppBtn);
  
  // Grok
  const gk=ts.find(x=>x.url.includes('grok.com'));
  console.log('\n=== Grok ===');
  const gkTA=await ev(gk.id,'(function(){var t=document.querySelector("textarea");return t?t.placeholder.slice(0,40):"none"})()');
  const gkInputs=await ev(gk.id,'document.querySelectorAll("textarea, input:not([type=hidden]), [contenteditable=true]").length');
  const gkBtn=await ev(gk.id,'(function(){var bs=document.querySelectorAll("button");for(var i=0;i<bs.length;i++){var off=bs[i].offsetWidth;if(off>20)return bs[i].className.slice(0,50)}return"none"})()');
  console.log('TA:',gkTA,'inputs:',gkInputs,'Btn:',gkBtn);
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
