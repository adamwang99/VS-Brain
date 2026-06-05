// CrossCritic Full Relay — CDP raw, mỗi lệnh một WebSocket mới
const WebSocket = require('ws');
const http = require('http');
const CDP_URL = 'http://127.0.0.1:9222/json';

function getTabs() {
  return new Promise((ok,err) => http.get(CDP_URL, r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>ok(JSON.parse(d)));r.on('error',err)}));
}

function evalInTab(tabId, expr, timeoutMs = 15000) {
  return new Promise(async (ok,err) => {
    const tabs = await getTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return err('tab '+tabId+' not found');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:false}}));
    });
    ws.on('message', d => {
      const r = JSON.parse(d.toString());
      if (r.id === 1) {
        ws.close();
        // result is inside r.result.result
        const v = r.result.result;
        ok(v.value !== undefined ? v.value : (v.description || null));
      }
    });
    ws.on('error', err);
    setTimeout(() => { try{ws.close()}catch{}; err('timeout')}, timeoutMs);
  });
}

function getTabId(urlMatch) {
  return getTabs().then(ts => {
    const t = ts.find(t => t.url.includes(urlMatch));
    return t ? t.id : null;
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== MAIN =====
(async () => {
  console.log('===== CROSS CRITIC RELAY =====\n');
  
  let chatId = await getTabId('chatgpt.com');
  let gemId = await getTabId('gemini.google.com');
  if (!chatId) { console.log('ChatGPT tab not found'); process.exit(1); }
  if (!gemId) { console.log('Gemini tab not found'); process.exit(1); }
  console.log('ChatGPT tab:', chatId);
  console.log('Gemini tab:', gemId, '\n');
  
  const ROUNDS = 3;
  let msg = '1+1=?';
  let turn = 'chat';
  
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`--- Round ${round}: ${turn.toUpperCase()} sends ---`);
    console.log(`MSG: ${msg.slice(0,60)}`);

    if (turn === 'chat') {
      // === CHATGPT SECTION ===
      // Navigate to fresh
      await delay(500);
      
      // Type message into contenteditable
      const typeResult = await evalInTab(chatId, 
        `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return 'no-input';e.focus();e.innerText='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(msg)});return 'typed:'+e.innerText.length})()`
      );
      console.log('Type:', typeResult);
      await delay(1500);
      
      // Click send button — try all possible selectors
      const sendResult = await evalInTab(chatId,
        `(function(){const sels=['button[data-testid="send-button"]','button[aria-label*="Send"]','button[aria-label*="send"]','button[aria-label*="Gửi"]','button[data-testid*="send"]','form button[type="submit"]'];for(const sel of sels){const b=document.querySelector(sel);if(b){b.click();return 'clicked:'+sel}}return 'no-send'})()`
      );
      console.log('Send:', sendResult);
      
      // Wait for response (poll with innerText)
      let reply = null;
      for (let i = 0; i < 30; i++) {
        await delay(1000);
        const r = await evalInTab(chatId,
          `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;const t=e.innerText;if(t&&t.length>3&&!t.includes('is thinking')&&!t.includes('is writing')&&!t.includes('Running'))return t;return null})()`
        );
        if (r && r !== null && r.length > 3) {
          reply = r;
          console.log(`ChatGPT res (i=${i}): ${r.slice(0,80)}`);
          break;
        }
        // Check stop
        const s = await evalInTab(chatId,
          `(function(){const sb=document.querySelector('[data-testid="stop-button"],button[aria-label*="Stop"],button[aria-label*="stop"]');if(sb)return'generating';const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return'no-msg';return e.innerText||'empty'})()`
        );
        if (s && s !== 'generating' && s !== 'no-msg' && s !== 'empty' && s.length > 3) {
          reply = s;
          console.log(`ChatGPT done (i=${i}): ${s.slice(0,80)}`);
          break;
        }
        if (i % 5 === 0) console.log(`  waiting... (${i}s)`);
      }
      
      if (!reply) {
        // Last resort
        reply = await evalInTab(chatId,
          `(function(){const e=document.querySelector('[data-message-author-role="assistant"]:last-child');if(!e)return null;return e.innerText})()`
        );
      }
      
      if (!reply || reply.length < 2) {
        console.log('FAIL: ChatGPT no response');
        break;
      }
      
      msg = reply;
      turn = 'gem';
      
    } else {
      // === GEMINI SECTION ===
      
      // Navigate to /app
      const navResult = await evalInTab(gemId, 'window.location.href');
      if (navResult && !navResult.includes('gemini.google.com/app')) {
        // Navigate if not on /app already
        console.log('Navigating to /app...');
        // Can't navigate via eval, so we note this
      } else {
        console.log('Gemini URL:', navResult);
      }
      
      // Type into input
      await delay(2000);
      const typeResult = await evalInTab(gemId,
        `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return 'no-input';e.focus();e.innerText='';e.textContent='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(msg)});return 'typed:'+e.innerText.length})()`
      );
      console.log('Gemini type:', typeResult);
      await delay(1000);
      
      // Send via Enter key
      const sendResult = await evalInTab(gemId,
        `(function(){const e=document.querySelector('[contenteditable="true"]');if(!e)return'no-input';e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true,composed:true}));return'sent-enter'})()`
      );
      console.log('Gemini send:', sendResult);
      
      // Wait for response using textContent
      await delay(8000);
      let reply = null;
      for (let i = 0; i < 15; i++) {
        await delay(2000);
        const r = await evalInTab(gemId,
          `(function(){const m=document.querySelector('model-response');if(!m)return null;const t=m.textContent;if(t&&t.length>3)return t.trim();return null})()`
        );
        if (r && r !== null && r.length > 3) {
          reply = r;
          console.log(`Gemini res (i=${i}): ${r.slice(0,80)}`);
          break;
        }
        // Check stop button
        const s = await evalInTab(gemId,
          `(function(){const sb=document.querySelector('[aria-label*="ung"],[aria-label*="ừng"]');if(sb)return'generating';const m=document.querySelector('model-response');if(!m||!m.textContent||m.textContent.length<3)return'waiting';return m.textContent.trim()})()`
        );
        if (s && s !== 'generating' && s !== 'waiting' && s.length > 3) {
          reply = s;
          console.log(`Gemini done (i=${i}): ${s.slice(0,80)}`);
          break;
        }
        if (i % 3 === 0) console.log(`  waiting... (${i*2+8}s)`);
      }
      
      if (!reply) {
        console.log('FAIL: Gemini no response');
        break;
      }
      
      msg = reply;
      turn = 'chat';
    }
    
    console.log(`Round ${round} PASS: "${msg.slice(0,60)}..."\n`);
  }
  
  console.log(`\n===== RELAY COMPLETE =====`);
  console.log(`Rounds: ${turn === 'gem' ? '>=1' : '0'}, Last msg: "${msg.slice(0,100)}"`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
