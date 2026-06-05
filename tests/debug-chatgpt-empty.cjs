// Check for error messages, rate limits, paywalls in ChatGPT
const WS=require('ws'),http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const ev=(id,expr)=>new Promise(async(ok,rej)=>{const ts=await tabs();const t=ts.find(x=>x.id===id);if(!t)return rej();const w=new WS(t.webSocketDebuggerUrl);w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr}})));w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();ok(r.result.result.value||r.result.result.description||null)}});w.on('error',rej);setTimeout(()=>{try{w.close()}catch(e){};rej('TO')},8000)});

(async()=>{
  const c=(await tabs()).find(t=>t.url.includes('chatgpt.com'));
  if(!c){console.log('no');return;}
  
  const checks=[
    // Check for error banners
    "document.querySelector('[role=alert]')?.innerText?.slice(0,200)||'no alert'",
    "document.querySelector('[class*=error],[class*=warning],[class*=rate],[class*=limit]')?.innerText?.slice(0,200)||'no error cls'",
    "document.body.innerText.match(/rate|limit|error|sorry|try again|lỗi|giới hạn|thử lại/i)?.[0]||'no error text'",
    // Check all text content of the last assistant message more carefully
    `(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");if(!es.length)return"none";var m=es[es.length-1];return JSON.stringify({
      innerHTML:m.innerHTML.slice(200,500),
      childCount:m.children.length,
      firstChildCls:m.firstElementChild?.className?.slice(0,60),
      innerTextLen:m.innerText.length,
      textContentLen:m.textContent.length
    })})()`,
    // Check the last assistant message innerHTML FULL
    `(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");if(!es.length)return"none";return es[es.length-1].innerHTML})()`,
    // Check all text nodes in the last assistant
    `(function(){var es=document.querySelectorAll("[data-message-author-role=assistant]");if(!es.length)return"none";var m=es[es.length-1];var nodes=[];var tw=document.createTreeWalker(m,NodeFilter.SHOW_TEXT,null,false);while(tw.nextNode()){nodes.push(tw.currentNode.textContent)};return JSON.stringify(nodes)})()`,
    // Maybe the text is in a comment node or rendered via pseudo-element
    "document.querySelector('[data-message-author-role=assistant]:last-child')?.querySelectorAll('*').length||0",
  ];
  
  for(const ck of checks){
    console.log('\n---');
    const r=await ev(c.id,ck);
    console.log((r||'null').toString().slice(0,800));
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
