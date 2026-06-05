// Check Grok and Perplexity DOM in detail + ChatGPT send button
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
  
  // 1. ChatGPT
  const c=ts.find(x=>x.url.includes('chatgpt.com'));
  console.log('=== ChatGPT ===');
  // Check all buttons
  const btns=await ev(c.id,'(function(){var bs=document.querySelectorAll("button");var r=[];for(var i=0;i<bs.length;i++){var off=bs[i].offsetWidth;if(off>20)r.push({c:bs[i].className.slice(0,40),off:off+"x"+bs[i].offsetHeight})}return JSON.stringify(r.slice(0,10))})()');
  console.log('Buttons:',btns);
  
  // 2. Perplexity
  const p=ts.find(x=>x.url.includes('perplexity.ai')&&x.title);
  console.log('\n=== Perplexity ===');
  const pBody=await ev(p.id,'document.body.innerText.slice(0,300)');
  console.log('Body:',pBody.replace(/\n/g,' | '));
  // Check contenteditable divs
  const pCE=await ev(p.id,'(function(){var all=document.querySelectorAll("div");for(var i=0;i<all.length;i++){if(all[i].getAttribute("contenteditable")==="true"||all[i].getAttribute("contenteditable")==="")return"ce:"+all[i].className.slice(0,50)}return"none"})()');
  console.log('CE div:',pCE);
  // Check textarea
  const pTA=await ev(p.id,'document.querySelectorAll("textarea").length');
  console.log('textarea:',pTA);
  // Check role=textbox
  const pTb=await ev(p.id,'(function(){var el=document.querySelector(\'[role="textbox"]\');return el?"textbox:"+el.className.slice(0,50):"none"})()');
  console.log('[role=textbox]:',pTb);
  
  // 3. Grok
  const gk=ts.find(x=>x.url==='https://grok.com/'||x.url.includes('grok.com/?q='));
  console.log('\n=== Grok ===');
  const gkBody=await ev(gk.id,'document.body.innerText.slice(0,300)');
  console.log('Body:',gkBody.replace(/\n/g,' | '));
  const gkCE=await ev(gk.id,'document.querySelectorAll("[contenteditable=true], [role=textbox], textarea").length');
  console.log('inputs:',gkCE);
  const gkAll=await ev(gk.id,'document.querySelectorAll("*").length');
  console.log('total elements:',gkAll);
  
  // 4. Claude
  const cl=ts.find(x=>x.url.includes('chat.chatbotapp.ai'));
  console.log('\n=== Claude ===');
  const clBody=await ev(cl.id,'document.body.innerText.slice(0,200)');
  console.log('Body:',clBody.replace(/\n/g,' | '));
  const clBtns=await ev(cl.id,'(function(){var bs=document.querySelectorAll("button");var r=[];for(var i=0;i<bs.length;i++){var off=bs[i].offsetWidth;if(off>20)r.push(bs[i].className.slice(0,40)+":"+off)}return JSON.stringify(r.slice(0,10))})()');
  console.log('Buttons:',clBtns);
  
  // 5. Qwen
  const q=ts.find(x=>x.url==='https://chat.qwen.ai/');
  console.log('\n=== Qwen ===');
  const qBody=await ev(q.id,'document.body.innerText.slice(0,200)');
  console.log('Body:',qBody.replace(/\n/g,' | '));
  const qBtns=await ev(q.id,'(function(){var bs=document.querySelectorAll("button");var r=[];for(var i=0;i<bs.length;i++){var w=bs[i].offsetWidth;if(w>20)r.push(i+":"+bs[i].className.slice(0,40)+":"+w+"x"+bs[i].offsetHeight)}return JSON.stringify(r.slice(0,10))})()');
  console.log('Buttons:',qBtns);
  
  // 6. Copilot
  const cp=ts.find(x=>x.url==='https://copilot.microsoft.com/');
  console.log('\n=== Copilot ===');
  const cpBody=await ev(cp.id,'document.body.innerText.slice(0,200)');
  console.log('Body:',cpBody.replace(/\n/g,' | '));
  const cpBtns=await ev(cp.id,'(function(){var bs=document.querySelectorAll("button");var r=[];for(var i=0;i<bs.length;i++){var w=bs[i].offsetWidth;if(w>20)r.push(i+":"+bs[i].className.slice(0,40)+":"+w+"x"+bs[i].offsetHeight)}return JSON.stringify(r.slice(0,10))})()');
  console.log('Buttons:',cpBtns);
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
