// Deep debug ChatGPT 5.5 response — find actual text content
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{const ts=await tabs();const t=ts.find(x=>x.id===id);if(!t)return rej();const w=new WS(t.webSocketDebuggerUrl);w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr}})));w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:v.description||null)}});w.on('error',rej);setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},8000)});

(async()=>{
  const ts=await tabs();
  const c=ts.find(t=>t.url.includes('chatgpt.com'));
  if(!c){console.log('no chat');return;}

  const checks=[
    // Find the actual content (not sidebar)
    '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";var m=ms[ms.length-1];return JSON.stringify({fullInnerText:m.innerText,fullTextContent:m.textContent,fullInnerHTML:m.innerHTML.slice(0,1000)})})()',
    // Try to find the final markdown/prose output (not thinking)
    '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";var m=ms[ms.length-1];var p=m.querySelectorAll("p,li,td,pre");var txts=Array.from(p).map(function(e){return e.innerText}).join("\\n");return txts.length?txts.slice(0,300):"no-p-tags"})()',
    // Is there a "thinking" collapse element?
    '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";var m=ms[ms.length-1];return JSON.stringify({thinking:m.querySelector("[class*=thinking],[class*=reasoning]")?1:0,resultChoice:m.querySelector("[class*=result]")?1:0,prose:m.querySelector(".prose")?1:0,markdown:m.querySelector("[class*=markdown]")?1:0})})()',
    // Check if the main body content area has the text
    '(function(){var main=document.querySelector("main,[role=main],.chat-content");if(!main)return"no main";return main.innerText.slice(0,500)})()',
    // Try ALL elements with any text inside the assistant message
    '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";var m=ms[ms.length-1];var all=m.querySelectorAll("*");var withText=[];all.forEach(function(e){if(e.children.length===0&&e.innerText.trim())withText.push(e.tagName+":"+e.innerText.trim().slice(0,60))});return withText.slice(0,20).join(" | ")})()',
    // Maybe the text is in a shadow root?
    '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";var m=ms[ms.length-1];return"shadow:"+(m.shadowRoot?"yes":"no")+" open:"+(m.openOrClosedShadowRoot?"yes":"no")})()',
    // Check what css classes are on the empty div
    '(function(){var ms=document.querySelectorAll("[data-message-author-role=assistant]");if(!ms.length)return"no";var m=ms[ms.length-1];var empty=m.querySelector("[class*=\"empty\"]");return empty?JSON.stringify({cls:empty.className,display:getComputedStyle(empty).display,visibility:getComputedStyle(empty).visibility}):"no empty"})()',
    // Just get all visible text nodes
    'document.title',
  ];

  for(const ck of checks){
    console.log('\n---');
    const r=await ev(c.id,ck);
    console.log((r||'null').toString().slice(0,800));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
