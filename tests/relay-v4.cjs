// CrossCritic Relay v4 — fix Gemini input + ChatGPT fresh conversation
const WebSocket = require('ws');
const http = require('http');
const CDP_URL = 'http://127.0.0.1:9222/json';

function getTabs() {
  return new Promise((ok,err) => http.get(CDP_URL, r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok(JSON.parse(d)));r.on('error',err)}));
}

function evalInTab(tabId, expr, timeoutMs = 15000) {
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
      setTimeout(() => { try{ws.close()}catch{}; err('TIMEOUT:'+expr.slice(0,60)); }, timeoutMs);
    } catch(e) { err(e); }
  });
}

function navigateTab(tabId, url) {
  return new Promise(async (ok,err) => {
    try {
      const tabs = await getTabs();
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return err('tab not found');
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      ws.on('open', () => { ws.send(JSON.stringify({id:1,method:'Page.navigate',params:{url}})); });
      ws.on('message', d => {
        const r = JSON.parse(d.toString());
        if (r.id === 1) { ws.close(); ok(r.result); }
      });
      ws.on('error', err);
      setTimeout(() => { try{ws.close()}catch{}; err('nav timeout'); }, 20000);
    } catch(e) { err(e); }
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeIntoContentEditable(tabId, text, inputTimeout = 30000) {
  // Try multiple methods to set text into contenteditable
  const methods = [
    // Method 1: execCommand insertText
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.innerText='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(text)});return'e1:'+e.innerText.length})()`,
    // Method 2: innerText + input event
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.innerText=${JSON.stringify(text)};e.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:true,composed:true}));return'e2:'+e.innerText.length})()`,
    // Method 3: textContent + input event + focus
    `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.focus();e.textContent='';e.textContent=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return'e3:'+e.textContent.length})()`,
  ];
  
  for (const m of methods) {
    const r = await evalInTab(tabId, m, inputTimeout);
    if (r && r.startsWith('e1:') || r.startsWith('e2:') || r.startsWith('e3:')) {
      const len = parseInt(r.split(':')[1]);
      if (len > 0) { console.log(`  Type OK (${r})`); return r; }
    }
    console.log(`  Type attempt failed: ${r}`);
  }
  return null;
}

async function waitChatGPT(tabId) {
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    const r = await evalInTab(tabId,
      `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;const t=e.innerText;if(typeof t==='string'&&t.length>3&&!t.includes('is thinking')&&!t.includes('is writing')&&!t.includes('Running'))return t;return null})()`
    );
    if (r && typeof r === 'string' && r.length > 3) { console.log(`  ChatGPT @${i}s: ${r.slice(0,60)}`); return r; }
    if (i % 5 === 0) console.log(`  wait chat... ${i}s`);
  }
  return null;
}

async function waitGemini(tabId) {
  await delay(10000); // initial wait
  for (let i = 0; i < 15; i++) {
    await delay(2000);
    const r = await evalInTab(tabId,
      `(function(){const m=document.querySelector('model-response');if(!m)return null;const t=m.textContent;if(t&&t.length>3)return t.trim();return null})()`
    );
    if (r && typeof r === 'string' && r.length > 3) { console.log(`  Gemini @${i*2+10}s: ${r.slice(0,60)}`); return r; }
    const s = await evalInTab(tabId,
      `(function(){const sb=document.querySelector('[aria-label*="ung"],[aria-label*="ừng"]');if(sb)return'gen';const m=document.querySelector('model-response');if(!m||!m.textContent||m.textContent.length<3)return'wait';return m.textContent.trim()})()`
    );
    if (s && s !== 'gen' && s !== 'wait' && s.length > 3) { console.log(`  Gemini stop @${i*2+10}s`); return s; }
    if (i % 3 === 0) console.log(`  wait gemini... ${i*2+10}s`);
  }
  return null;
}

// ===== MAIN =====
(async () => {
  console.log('===== CROSS CRITIC RELAY v4 =====\n');
  
  let chatId = null, gemId = null;
  for (const t of await getTabs()) {
    if (t.url.includes('chatgpt.com')) chatId = t.id;
    if (t.url.includes('gemini.google.com')) gemId = t.id;
  }
  if (!chatId || !gemId) { console.log('Missing tabs'); process.exit(1); }
  console.log(`ChatGPT: ${chatId}`);
  console.log(`Gemini: ${gemId}\n`);
  
  const ROUNDS = 3;
  let msg = 'trả lời ngắn gọn: 1+1=?';
  let turn = 'chat';
  
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`--- Round ${round}: ${turn.toUpperCase()} ---`);
    
    if (turn === 'chat') {
      // Fresh ChatGPT conversation
      console.log('  New chat...');
      await navigateTab(chatId, 'https://chatgpt.com');
      await delay(5000);
      
      await typeIntoContentEditable(chatId, msg);
      await delay(1000);
      
      const snd = await evalInTab(chatId,
        `(function(){const sels=['button[data-testid="send-button"]','button[aria-label*="send"]','button[aria-label*="Send"]','button[aria-label*="Gửi"]'];for(const s of sels){const b=document.querySelector(s);if(b){b.click();return s}}return'no-send'})()`
      );
      console.log(`  Send: ${snd}`);
      
      const reply = await waitChatGPT(chatId);
      if (!reply) { console.log('  FAIL: no ChatGPT response'); break; }
      msg = reply;
      turn = 'gem';
      
    } else {
      // Gemini — navigate to /app for fresh chat
      console.log('  Fresh Gemini...');
      await navigateTab(gemId, 'https://gemini.google.com/app');
      await delay(5000);
      
      const typed = await typeIntoContentEditable(gemId, msg);
      await delay(1000);
      
      // Send via Enter
      const sent = await evalInTab(gemId,
        `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true,composed:true}));return'sent';})()`
      );
      console.log(`  Send: ${sent}`);
      
      const reply = await waitGemini(gemId);
      if (!reply) { console.log('  FAIL: no Gemini response'); break; }
      msg = reply;
      turn = 'chat';
    }
    
    console.log(`  ✅ Round ${round}: "${msg.slice(0,60)}"\n`);
  }
  
  console.log(`===== DONE =====`);
  console.log(`Rounds: ${turn === 'gem' ? '>=1' : '0'}`);
  console.log(`Final: ${msg.slice(0,200)}`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
