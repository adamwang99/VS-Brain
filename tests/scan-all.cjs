// Quick DOM scan for all providers
const WS=require('ws'),http=require('http');
const J=JSON.stringify;
const tab=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
function ev(id,e){return new Promise(async(ok)=>{
  const ts=await tab();const t=ts.find(x=>x.id===id);
  if(!t)return ok('no tab');
  const w=new WS(t.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:e,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},8000);
})}

const checks=[
  ['DeepSeek','chat.deepseek.com'],
  ['Qwen','chat.qwen.ai'],
  ['Claude','chat.chatbotapp.ai'],
  ['Copilot','copilot.microsoft.com'],
  ['Perplexity','perplexity.ai'],
  ['Grok','grok.com'],
];
(async()=>{
  const ts=await tab();
  for(const[name,urlPat]of checks){
    const t=ts.find(x=>x.url.includes(urlPat)&&!x.url.includes('frame')&&!x.url.includes('m.stripe')&&!x.url.includes('count.'));
    if(!t){console.log(name+': NO TAB');continue;}
    console.log('\n=== '+name+' ===');
    console.log('ID:',t.id.slice(0,8),'URL:',t.url.slice(0,80));
    
    // Scan DOM basics
    const ta=await ev(t.id,'document.querySelectorAll("textarea").length');
    const ce=await ev(t.id,'document.querySelectorAll(\'[contenteditable="true"]\').length');
    const h1=await ev(t.id,'document.querySelectorAll("h1, h2, h3, h4").length');
    const body=await ev(t.id,'document.body.innerText.slice(0,200)');
    const btnR=await ev(t.id,'document.querySelectorAll(\'[role="button"]\').length');
    const input=await ev(t.id,'document.querySelectorAll("input:not([type=hidden])").length');
    console.log('textarea:',ta,' contenteditable:',ce,' h*:',h1,' [role=button]:',btnR,' input:',input);
    console.log('Body:',body.replace(/\n/g,' '));
    
    // Detect send mechanism
    const snd=await ev(t.id,'(function(){var r={};var btns=document.querySelectorAll("[role=button]");for(var i=0;i<Math.min(btns.length,10);i++){var b=btns[i];r[b.className.slice(0,30)]=b.offsetWidth+"x"+b.offsetHeight}return JSON.stringify(r)})()');
    console.log('Buttons:',snd.slice(0,300));
    
    // Check p tags for response detection
    const ps=await ev(t.id,'document.querySelectorAll("p").length');
    console.log('P tags:',ps);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
