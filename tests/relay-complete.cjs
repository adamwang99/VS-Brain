// CrossCritic Relay: ChatGPT <-> Gemini <-> ChatGPT <-> ... full loop
// Uses textContent for Gemini extraction, Enter key for send
const WebSocket = require('ws');
const http = require('http');

const CDP = 'http://127.0.0.1:9222/json';
const ROUNDS = 3;
const INITIAL = '1+1=?';

// --- helpers ---
function cdpFetch(path) {
  return new Promise((ok,err) => http.get(CDP+path, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>ok(JSON.parse(d))); r.on('error',err); }));
}
function findTab(urlMatch) { return cdpFetch('').then(ts => ts.find(t => t.url.includes(urlMatch))); }

function wsSend(ws, id, m, p) {
  return new Promise((ok,err) => {
    const l = (d) => { const r=JSON.parse(d.toString()); if(r.id===id) { ws.off('message',l); ok(r); } };
    ws.on('message', l);
    ws.on('error', err);
    ws.send(JSON.stringify({id,method:m,params:p}));
  });
}

async function wsCmd(tab, method, params) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,err) => ws.on('open',ok)); ws.on('error',()=>{});
  const r = await wsSend(ws, 1, method, params);
  ws.close();
  return r;
}

// --- actions ---
async function initTab(tabId) {
  const tab = await cdpFetch('/').then(ts => ts.find(t => t.id===tabId));
  if (!tab) throw new Error('tab not found: '+tabId);
  return tab;
}

async function navigate(tab, url) {
  console.log(`  Navigate to ${url}`);
  return wsCmd(tab, 'Page.navigate', {url});
}

async function getAllTabs() {
  return cdpFetch('');
}

// --- ChatGPT ---
async function chatgptSend(tab, msg) {
  console.log(`  Chat send: ${msg.slice(0,60)}`);
  // Type into contenteditable
  await wsCmd(tab, 'Runtime.evaluate', {
    expression: `(function(){const e=document.querySelector('[contenteditable=\"true\"]');if(!e)return 'no-input';e.focus();e.innerText='';e.textContent='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(msg)});return 'filled:'+e.innerText.length})()`,
    awaitPromise: false
  });
  // Wait a bit then click send button
  await new Promise(r => setTimeout(r, 1000));
  const ret = await wsCmd(tab, 'Runtime.evaluate', {
    expression: `(function(){const btn=document.querySelector('[data-testid=\"send-button\"]');if(!btn)return 'no-send';btn.click();return 'clicked'})()`,
    awaitPromise: false
  });
  console.log(`  Send click: ${ret.result.value}`);
}

async function chatgptExtract(tab) {
  // Wait for response — poll up to 30s
  for (let i = 0; i < 30; i++) {
    const r = await wsCmd(tab, 'Runtime.evaluate', {
      expression: `(function(){const e=document.querySelector('[data-message-author-role=\"assistant\"]:last-child');if(!e)return null;const t=e.innerText;if(t&&t.length>3&&!t.includes('Running'))return t;return null})()`,
      awaitPromise: false
    });
    const v = r.result.value;
    if (v && v !== null) {
      console.log(`  ChatGPT response (${v.length} chars): ${v.slice(0,100)}`);
      return v;
    }
    // Check if stop button gone = generation done
    const r2 = await wsCmd(tab, 'Runtime.evaluate', {
      expression: `document.querySelector('[data-testid=\"stop-button\"]') ? 'generating' : 'done'`,
      awaitPromise: false
    });
    if (r2.result.value === 'done' && i > 3) {
      // Try again after a moment
      await new Promise(r => setTimeout(r, 2000));
      const r3 = await wsCmd(tab, 'Runtime.evaluate', {
        expression: `(function(){const e=document.querySelector('[data-message-author-role=\"assistant\"]:last-child');if(!e)return null;const t=e.innerText;return t||null})()`
      });
      if (r3.result.value) { console.log(`  ChatGPT done response: ${r3.result.value.slice(0,100)}`); return r3.result.value; }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('  ChatGPT: timeout no response');
  return null;
}

// --- Gemini ---
async function geminiSendAndWait(tab, msg) {
  console.log(`  Gemini send: ${msg.slice(0,60)}`);
  
  // Navigate to fresh chat first
  await wsCmd(tab, 'Page.navigate', {url: 'https://gemini.google.com/app'});
  await new Promise(r => setTimeout(r, 4000));
  
  // Type into contenteditable
  await wsCmd(tab, 'Runtime.evaluate', {
    expression: `(function(){const e=document.querySelector('[contenteditable=\"true\"]');if(!e)return 'no-input';e.focus();e.innerText='';e.textContent='';const sel=window.getSelection();const r=document.createRange();r.selectNodeContents(e);sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,${JSON.stringify(msg)});return 'filled:'+e.innerText.length})()`,
    awaitPromise: false
  });
  await new Promise(r => setTimeout(r, 1500));
  
  // Send via Enter key
  const r = await wsCmd(tab, 'Runtime.evaluate', {
    expression: `(function(){const e=document.querySelector('[contenteditable=\"true\"]');if(!e)return 'no-input';e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true,composed:true}));return 'sent-enter'})()`,
    awaitPromise: false
  });
  console.log(`  Send: ${r.result.value}`);
  
  // Wait for response using textContent
  await new Promise(r => setTimeout(r, 10000));
  
  for (let i = 0; i < 20; i++) {
    const r2 = await wsCmd(tab, 'Runtime.evaluate', {
      expression: `(function(){const ms=document.querySelector('model-response');if(!ms)return null;const txt=ms.textContent;if(txt&&txt.length>3)return txt.trim();return null})()`,
      awaitPromise: false
    });
    const v = r2.result.value;
    if (v && v !== null) {
      console.log(`  Gemini response (${v.length} chars): ${v.slice(0,100)}`);
      return v;
    }
    // Check stop button status
    const r3 = await wsCmd(tab, 'Runtime.evaluate', {
      expression: `(function(){const s=document.querySelector('[aria-label*=\"ừng\"],[aria-label*=\"Ngừng\"]');const m=document.querySelector('model-response');if(!s&&m&&m.textContent)return 'done:'+m.textContent.trim();if(!s)return 'no-stop-no-msg';return 'generating'})()`
    });
    const s = r3.result.value;
    if (s && s !== 'generating') {
      const parsed = s.includes(':') ? s.split(':').slice(1).join(':') : null;
      if (parsed && parsed.length > 3) {
        console.log(`  Gemini done via stop: ${parsed.slice(0,100)}`);
        return parsed;
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('  Gemini: timeout');
  return null;
}

// --- MAIN ---
(async () => {
  console.log('=== CrossCritic Full Relay Loop ===\n');
  
  // Find tabs
  let chatTab = await findTab('chatgpt.com');
  let gemTab = await findTab('gemini.google.com');
  
  if (!chatTab) throw new Error('ChatGPT tab not found');
  if (!gemTab) throw new Error('Gemini tab not found');
  
  console.log(`ChatGPT: ${chatTab.url}`);
  console.log(`Gemini: ${gemTab.url}`);
  console.log(`Rounds: ${ROUNDS}, Initial: ${INITIAL}\n`);
  
  // First: seed ChatGPT with initial question
  await navigate(chatTab, 'https://chatgpt.com');
  await new Promise(r => setTimeout(r, 4000));
  
  let currentMsg = INITIAL;
  let turn = 'chat';
  
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`--- Round ${round}: ${turn} sends "${currentMsg.slice(0,50)}" ---`);
    
    if (turn === 'chat') {
      // ChatGPT turn
      await chatgptSend(chatTab, currentMsg);
      const reply = await chatgptExtract(chatTab);
      
      if (!reply) {
        console.log(`  ❌ Round ${round}: ChatGPT returned nothing, trying final extract...`);
        // One last check
        const r = await wsCmd(chatTab, 'Runtime.evaluate', {
          expression: `(function(){const e=document.querySelector('[data-message-author-role=\"assistant\"]:last-child');if(!e)return null;return e.innerText})()`
        });
        if (r.result.value) {
          currentMsg = r.result.value;
          console.log(`  Last-ditch extract: ${currentMsg.slice(0,100)}`);
          turn = 'gem';
          continue;
        }
        console.log(`  ❌ FAIL at round ${round}`);
        break;
      }
      currentMsg = reply;
      turn = 'gem';
    } else {
      // Gemini turn
      await geminiSendAndWait(gemTab, currentMsg);
      
      // Wait a bit more then extract
      await new Promise(r => setTimeout(r, 3000));
      const r = await wsCmd(gemTab, 'Runtime.evaluate', {
        expression: `(function(){const ms=document.querySelector('model-response');if(!ms)return null;const t=ms.textContent.trim();if(t&&t.length>3)return t;return null})()`
      });
      const reply = r.result.value;
      
      if (!reply) {
        console.log(`  ❌ FAIL at round ${round}: Gemini returned nothing`);
        break;
      }
      currentMsg = reply;
      turn = 'chat';
    }
    
    console.log(`  ✅ Round ${round} complete\n`);
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n=== RELAY COMPLETE ===`);
  console.log(`Final message: ${currentMsg.slice(0,200)}`);
  console.log(`PASS status: ${turn === 'gem' ? 'at least 1 full ChatGPT→Gemini cycle' : 'partial'}`);
  
  // Report full chain
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
