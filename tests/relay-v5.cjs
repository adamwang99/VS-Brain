// CrossCritic Relay v5 — ChatGPT giữ conversation cũ, Gemini navigate /app mỗi round
const WebSocket = require('ws');
const http = require('http');
const CDP_URL = 'http://127.0.0.1:9222/json';

function getTabs() {
  return new Promise((ok,err) => http.get(CDP_URL, r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok(JSON.parse(d)));r.on('error',err)}));
}

function rawEval(tabId, expr, timeoutMs = 20000) {
  return new Promise(async (ok,err) => {
    try {
      const tabs = await getTabs();
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return err('tab not found');
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      ws.on('open', () => { ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}})); });
      ws.on('message', d => {
        const r = JSON.parse(d.toString());
        if (r.id === 1) { ws.close(); ok(r.result.result.value !== undefined ? r.result.result.value : r.result.result.description || null); }
      });
      ws.on('error', err);
      setTimeout(() => { try{ws.close()}catch{}; err('TO:'+expr.slice(0,50)); }, timeoutMs);
    } catch(e) { err(e); }
  });
}

function rawNavigate(tabId, url) {
  return new Promise(async (ok,err) => {
    try {
      const tabs = await getTabs();
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return err('tab not found');
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      ws.on('open', () => { ws.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})); });
      ws.on('message', d => { const r=JSON.parse(d.toString()); if(r.id===1){ws.close();ok(r.result);} });
      ws.on('error', err);
      setTimeout(()=>{try{ws.close()}catch{};err('nav timeout');},20000);
    } catch(e) { err(e); }
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeText(tabId, text) {
  const r = await rawEval(tabId,
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.innerText='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(text)});return 't:'+e.innerText.length})()`
  );
  if (r && (r.startsWith('t:') || r.startsWith('e1:'))) {
    const len = parseInt(r.split(':')[1]);
    if (len > 0) return r;
  }
  // Fallback: innerText+input event
  const r2 = await rawEval(tabId,
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.innerText=${JSON.stringify(text)};e.dispatchEvent(new InputEvent('input',{bubbles:true}));return't2:'+e.innerText.length})()`
  );
  return r2;
}

// ===== MAIN =====
(async () => {
  console.log('===== CROSS CRITIC RELAY v5 =====\n');
  
  const allTabs = await getTabs();
  let chatId = null, gemId = null;
  for (const t of allTabs) {
    if (t.url.includes('chatgpt.com')) chatId = t.id;
    if (t.url.includes('gemini.google.com')) gemId = t.id;
  }
  if (!chatId) { console.log('No ChatGPT tab'); process.exit(1); }
  if (!gemId) { console.log('No Gemini tab'); process.exit(1); }
  console.log('ChatGPT:', chatId);
  console.log('Gemini:', gemId, '\n');
  
  // Seed ChatGPT with initial conversation (use existing tab)
  // First, type and send the initial question
  console.log('--- Seed ChatGPT ---');
  const initial = 'trả lời ngắn gọn: 1+1=?';
  await typeText(chatId, initial);
  await delay(1500);
  await rawEval(chatId,
    `(function(){const s=document.querySelector('[data-testid="send-button"]');if(s){s.click();return'sent'}return'no-send'})()`
  );
  console.log('  Sent to ChatGPT');
  
  let msg = null;
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    const r = await rawEval(chatId,
      `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;const t=e.innerText;if(t&&t.length>3&&!t.includes('is thinking')&&!t.includes('is writing')&&!t.includes('Running'))return t;return null})()`
    );
    if (r && r.length > 3) { msg = r; console.log(`  ChatGPT: ${r.slice(0,80)}`); break; }
    if (i % 5 === 0) console.log(`  wait... ${i}s`);
  }
  if (!msg) { console.log('FAIL seed'); process.exit(1); }
  
  const ROUNDS = 3;
  let turn = 'gem';
  
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n--- Round ${round}: ${turn.toUpperCase()} sends "${msg.slice(0,50)}" ---`);
    
    if (turn === 'gem') {
      // Fresh Gemini conversation
      console.log('  Gemini fresh...');
      try { await rawNavigate(gemId, 'https://gemini.google.com/app'); } catch(e) { console.log('  Nav err:', e.message); }
      await delay(5000);
      
      // Wait for page to load
      await rawEval(gemId, 'new Promise(r=>setTimeout(r,2000))');
      
      // Type - use fallback chain
      let typed = 'none';
      // Method 1: direct innerText + input event
      const r1 = await rawEval(gemId,
        `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.innerText=${JSON.stringify(msg)};e.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,composed:true}));return'inner:'+e.innerText.length})()`
      );
      if (!r1 || r1.startsWith('no') || (r1.startsWith('inner:') && parseInt(r1.split(':')[1]) < 2)) {
        // Method 2: execCommand
        const r2 = await rawEval(gemId,
          `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.innerText='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(msg)});return'ins:'+e.innerText.length})()`
        );
        typed = r2;
      } else {
        typed = r1;
      }
      console.log(`  Type: ${typed}`);
      await delay(1500);
      
      // Send via Enter
      const sent = await rawEval(gemId,
        `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true,composed:true}));return'sent'})()`
      );
      console.log(`  Send: ${sent}`);
      
      // Wait for response
      await delay(8000);
      let reply = null;
      for (let i = 0; i < 15; i++) {
        await delay(2000);
        const r = await rawEval(gemId,
          `(function(){const m=document.querySelector('model-response');if(!m)return null;const t=m.textContent;if(t&&t.length>3)return t.trim();return null})()`
        );
        if (r && r.length > 3) { reply = r; console.log(`  Gemini @${i*2+8}s: ${r.slice(0,80)}`); break; }
        const s = await rawEval(gemId,
          `(function(){const sb=document.querySelector('[aria-label*="ung"],[aria-label*="ừng"]');if(sb)return'gen';const m=document.querySelector('model-response');if(!m||!m.textContent||m.textContent.length<3)return'wait';return m.textContent.trim()})()`
        );
        if (s && s !== 'gen' && s !== 'wait' && s.length > 3) { reply = s; console.log(`  Gemini done @${i*2+8}s`); break; }
        if (i % 3 === 0) console.log(`  wait gemini... ${i*2+8}s`);
      }
      
      if (!reply) { console.log('  FAIL: Gemini no response'); break; }
      msg = reply;
      turn = 'chat';
      
    } else {
      // ChatGPT — type into existing conversation
      console.log('  ChatGPT same thread...');
      await delay(1000);
      
      const typed = await typeText(chatId, msg);
      console.log(`  Type: ${typed}`);
      await delay(1500);
      
      const sent = await rawEval(chatId,
        `(function(){const s=document.querySelector('[data-testid="send-button"]');if(s){s.click();return'sent'}return'no-send'})()`
      );
      console.log(`  Send: ${sent}`);
      
      // Wait for response
      let reply = null;
      for (let i = 0; i < 30; i++) {
        await delay(1000);
        const r = await rawEval(chatId,
          `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;const t=e.innerText;if(t&&t.length>3&&!t.includes('is thinking')&&!t.includes('is writing')&&!t.includes('Running'))return t;return null})()`
        );
        if (r && r.length > 3) { reply = r; console.log(`  ChatGPT @${i}s: ${r.slice(0,80)}`); break; }
        if (i % 5 === 0) console.log(`  wait chat... ${i}s`);
      }
      
      if (!reply) { console.log('  FAIL: ChatGPT no response'); break; }
      msg = reply;
      turn = 'gem';
    }
    
    console.log(`  ✅ Round ${round}: "${msg.slice(0,60)}"`);
  }
  
  console.log(`\n===== RELAY COMPLETE =====`);
  console.log(`Final msg from ${turn === 'gem' ? 'Gemini' : 'ChatGPT'}:`);
  console.log(`"${msg.slice(0,300)}"`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
