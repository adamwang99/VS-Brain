// CrossCritic Relay v6 — robust ChatGPT + Gemini loop
// ChatGPT: keep same thread, track msg count. Gemini: /app each round.
const WS = require('ws');
const http = require('http');
const C = 'http://127.0.0.1:9222/json';

const tabs = () => new Promise((o,e)=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)));r.on('error',e)}));
const delay = ms => new Promise(r=>setTimeout(r,ms));

function evalTab(id, expr, to=20000) {
  return new Promise(async(o,e)=>{
    try {
      const ts=await tabs(); const t=ts.find(x=>x.id===id);
      if(!t) return e('no tab');
      const w=new WS(t.webSocketDebuggerUrl);
      w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})));
      w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;o(v.value!==undefined?v.value:v.description||null)}});
      w.on('error',e);
      setTimeout(()=>{try{w.close()}catch{};e('TO:'+expr.slice(0,40))},to);
    }catch(x){e(x)}
  });
}

function navTab(id,url) {
  return new Promise(async(o,e)=>{
    try {
      const ts=await tabs(); const t=ts.find(x=>x.id===id);
      if(!t) return e('no tab');
      const w=new WS(t.webSocketDebuggerUrl);
      w.on('open',()=>w.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})));
      w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();o(r.result)}});
      w.on('error',e);
      setTimeout(()=>{try{w.close()}catch{};e('nav TO')},20000);
    }catch(x){e(x)}
  });
}

function escapeJson(s) { return JSON.stringify(s); }

// Type & send to ChatGPT
async function chatGPT(typeText) {
  const tid = (await tabs()).find(t=>t.url.includes('chatgpt.com')).id;
  
  // Count existing assistant messages
  const before = await evalTab(tid,'document.querySelectorAll("[data-message-author-role=assistant]").length');
  console.log(`  ChatGPT existing msgs: ${before}`);
  
  // Type
  const t1 = await evalTab(tid,
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-inp';e.focus();e.innerText='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${escapeJson(typeText)});return't:'+e.innerText.length})()`
  );
  if (!t1 || !t1.startsWith('t:')) {
    // fallback
    await evalTab(tid,
      `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return;e.focus();e.innerText=${escapeJson(typeText)};e.dispatchEvent(new InputEvent('input',{bubbles:true}))})()`
    );
  }
  console.log(`  Type: ${t1}`);
  await delay(1500);
  
  // Click send
  const snd = await evalTab(tid,
    `(function(){const b=document.querySelector('[data-testid="send-button"]');if(b){b.click();return'sent'}return'no-send'})()`
  );
  console.log(`  Send: ${snd}`);
  
  // Poll for NEW assistant message
  for (let i=0; i<40; i++) {
    await delay(1000);
    const now = await evalTab(tid,'document.querySelectorAll("[data-message-author-role=assistant]").length');
    if (now > before) {
      const txt = await evalTab(tid,
        `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;return e.innerText})()`
      );
      if (txt && txt.length>3 && !txt.includes('is thinking')&&!txt.includes('is writing')&&!txt.includes('Running')) {
        console.log(`  ChatGPT @${i}s: "${txt.slice(0,80)}"`);
        return txt;
      }
      console.log(`  New msg but still generating... ${i}s`);
    }
    // Alternative: check if last assistant innerText changed
    const t = await evalTab(tid,
      `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;const x=e.innerText;return (x&&x.length>3&&!x.includes('is thinking')&&!x.includes('is writing'))?x:null})()`
    );
    if (t && t!==null) {
      console.log(`  ChatGPT alt @${i}s: "${t.slice(0,80)}"`);
      return t;
    }
    if (i%5===0) console.log(`  wait... ${i}s`);
  }
  return null;
}

// Gemini: navigate + type + send + wait
async function gemini(typeText) {
  const tid = (await tabs()).find(t=>t.url.includes('gemini.google.com')).id;
  
  // Navigate to /app
  console.log('  Gemini navigating /app...');
  try { await navTab(tid,'https://gemini.google.com/app'); } catch(e) {}
  await delay(5000);
  
  // Type - innerText + InputEvent
  await evalTab(tid,
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return;e.focus();e.innerText=${escapeJson(typeText)};e.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,composed:true}));return})()`
  );
  await delay(1000);
  
  // Verify text
  const v = await evalTab(tid,
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no';return'check:'+e.innerText.length})()`
  );
  console.log(`  Gemini type check: ${v}`);
  await delay(500);
  
  // Send Enter
  await evalTab(tid,
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return;e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true,composed:true}));return})()`
  );
  console.log('  Gemini sent');
  await delay(8000);
  
  // Poll for response using textContent
  for (let i=0; i<20; i++) {
    await delay(2000);
    const r = await evalTab(tid,
      `(function(){const m=document.querySelector('model-response');if(!m)return null;const t=m.textContent;return (t&&t.length>3)?t.trim():null})()`
    );
    if (r && r!==null && r.length>3) { console.log(`  Gemini @${i*2+8}s: "${r.slice(0,80)}"`); return r; }
    const s = await evalTab(tid,
      `(function(){const sb=document.querySelector('[aria-label*="ung"],[aria-label*="ừng"]');if(sb)return'gen';const m=document.querySelector('model-response');if(!m||!m.textContent||m.textContent.length<3)return'wait';return m.textContent.trim()})()`
    );
    if (s && s!=='gen' && s!=='wait' && s.length>3) { console.log(`  Gemini stop @${i*2+8}s`); return s; }
    if (i%3===0) console.log(`  wait gemini ${i*2+8}s`);
  }
  return null;
}

// ==== MAIN ====
(async () => {
  console.log('===== CROSS CRITIC RELAY v6 =====\n');
  
  const ts = await tabs();
  let chatId, gemId;
  for (const t of ts) { if(t.url.includes('chatgpt.com')) chatId=t.id; if(t.url.includes('gemini.google.com')) gemId=t.id; }
  if (!chatId || !gemId) { console.log('Tabs missing'); process.exit(1); }
  
  console.log(`ChatGPT: ${chatId}\nGemini: ${gemId}`);
  
  const ROUNDS = 3;
  let msg = 'Chỉ trả lời kết quả, không giải thích: 1+1=?';
  let turn = 'chat';
  
  for (let round=1; round<=ROUNDS; round++) {
    console.log(`\n=== ROUND ${round} - ${turn.toUpperCase()} ===`);
    let reply;
    
    if (turn === 'chat') {
      reply = await chatGPT(msg);
      turn = 'gem';
    } else {
      reply = await gemini(msg);
      turn = 'chat';
    }
    
    if (!reply) { console.log(`  ❌ ROUND ${round} FAIL`); break; }
    msg = reply;
    console.log(`  ✅ ROUND ${round} PASS`);
  }
  
  console.log(`\n===== COMPLETE =====`);
  console.log(`Final (${turn==='gem'?'fromGem':'fromChat'}): "${msg.slice(0,200)}"`);
  process.exit(0);
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
