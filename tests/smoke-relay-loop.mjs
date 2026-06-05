import WebSocket from 'ws';
import http from 'http';

const CDP = 'http://127.0.0.1:9222';
const WAIT = ms => new Promise(r => setTimeout(r, ms));

// Fetch CDP resource
function cdpFetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// WS command
function wsSend(ws, id, method, params = {}) {
  return new Promise(resolve => {
    ws.send(JSON.stringify({ id, method, params }));
    function onMsg(data) {
      try {
        const r = JSON.parse(data.toString());
        if (r.id === id) { ws.removeListener('message', onMsg); resolve(r); }
      } catch(e) {}
    }
    ws.on('message', onMsg);
  });
}

// Open WS connection
function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const tid = setTimeout(() => { ws.close(); reject(new Error('ws timeout')); }, 10000);
    ws.on('open', () => { clearTimeout(tid); resolve(ws); });
    ws.on('error', e => { clearTimeout(tid); reject(e); });
  });
}

// Evaluate JS in page via WS
async function evalInPage(ws, expression, timeout = 8000) {
  const rid = Math.floor(Math.random() * 100000);
  const p = wsSend(ws, rid, 'Runtime.evaluate', { expression, returnByValue: true });
  const result = await Promise.race([p, WAIT(timeout).then(() => null)]);
  return result?.result?.result?.value;
}

// Get body text
async function getBodyText(ws, label) {
  const text = await evalInPage(ws, 'document.body.innerText.slice(0,2000)') || '';
  console.log(`\n--- ${label} Body ---`);
  console.log(text.slice(0,500));
  return text;
}

// Check if generating
async function isGenerating(ws) {
  const val = await evalInPage(ws, 
    `document.querySelector('[data-testid="stop-button"], .stop-btn, .result-streaming, [aria-label="Stop streaming"], .stop-generating') !== null || 
     !!document.querySelector('.result-thinking, .streaming, .thinking')`);
  return val === true;
}

// Type text into ChatGPT input
async function typeIntoChatGPT(ws, text) {
  // ChatGPT uses #prompt-textarea or contentEditable
  // First find the input
  const inputInfo = await evalInPage(ws, `JSON.stringify({
    prompt: document.querySelector('#prompt-textarea')?.tagName || 'none',
    editable: document.querySelector('[contenteditable="true"]')?.tagName || 'none',
    textarea: document.querySelector('textarea')?.tagName || 'none'
  })`);
  console.log('  Input elements:', inputInfo);
  
  // Try to focus and type
  // For ChatGPT, it's typically #prompt-textarea (a div with contentEditable)
  await evalInPage(ws, `
    (function(){
      const el = document.querySelector('#prompt-textarea') || 
                 document.querySelector('[contenteditable="true"][data-id]') ||
                 document.querySelector('textarea');
      if (!el) return 'no input found';
      el.focus();
      el.textContent = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', {bubbles:true}));
      return 'typed: ' + el.tagName;
    })()
  `);
}

// Click send button
async function clickSend(ws) {
  return await evalInPage(ws, `
    (function(){
      const btn = document.querySelector('[data-testid="send-button"]') ||
                  document.querySelector('button[aria-label="Send prompt"]') ||
                  document.querySelector('button.absolute.bottom-1\\\.5.right-1\\\.5') ||
                  document.querySelector('button:has(svg)');
      if (!btn) return 'no send button';
      btn.click();
      return 'clicked';
    })()
  `);
}

async function main() {
  console.log('🔍 VS Brain Relay Loop Smoke Test');
  console.log('=================================\n');
  
  // Get pages
  const pages = await cdpFetch('/json/list');
  const chatgpt = pages.find(p => p.url?.includes('chatgpt.com'));
  const gemini = pages.find(p => p.url?.includes('gemini.google.com'));
  const popup = pages.find(p => p.url?.includes('popup.html'));
  
  if (!chatgpt || !gemini || !popup) {
    console.log('❌ Missing tabs:', { chatgpt: !!chatgpt, gemini: !!gemini, popup: !!popup });
    process.exit(1);
  }
  
  console.log('📋 Tabs OK: ChatGPT + Gemini + VS Brain popup\n');
  
  // Connect to all three
  const [wsChat, wsGemini, wsPopup] = await Promise.all([
    wsConnect(chatgpt.webSocketDebuggerUrl),
    wsConnect(gemini.webSocketDebuggerUrl),
    wsConnect(popup.webSocketDebuggerUrl)
  ]);
  console.log('🔗 WebSocket connections: OK');
  
  // Enable runtime for all
  for (const [label, ws] of [['ChatGPT', wsChat], ['Gemini', wsGemini], ['Popup', wsPopup]]) {
    await wsSend(ws, 1, 'Runtime.enable');
  }
  
  // ============ STEP 1: Verify login ============
  console.log('\n📌 STEP 1: Verify login state');
  
  const chatLogin = await evalInPage(wsChat, 'document.body.innerText.includes("Log in") || document.body.innerText.includes("Sign up") ? "NOT LOGGED IN" : "LOGGED IN"');
  const gemLogin = await evalInPage(wsGemini, 'document.body.innerText.includes("Sign in") ? "NOT LOGGED IN" : "LOGGED IN"');
  console.log(`  ChatGPT: ${chatLogin}`);
  console.log(`  Gemini:  ${gemLogin}`);
  
  if (chatLogin === 'NOT LOGGED IN' || gemLogin === 'NOT LOGGED IN') {
    console.log('❌ Login required!');
    process.exit(1);
  }
  
  // ============ STEP 2: Setup popup ============
  console.log('\n📌 STEP 2: Setup VS Brain popup');
  
  // Refresh tabs first
  await evalInPage(wsPopup, 'if(typeof refreshTabs==="function") refreshTabs()');
  await WAIT(2000);
  
  // Check source/target tabs
  const tabsInfo = await evalInPage(wsPopup, `JSON.stringify({
    sources: Array.from(document.querySelectorAll("#sourceTab option")).map(o=>({v:o.value, t:o.textContent.slice(0,40)})),
    status: document.querySelector("#status")?.textContent || "",
    sendBtn: document.querySelector("#startStop")?.textContent || "",
    sendDisabled: document.querySelector("#startStop")?.disabled
  })`);
  console.log('  Popup:', tabsInfo);
  
  // ============ STEP 3: Get pre-test body snapshots ============
  console.log('\n📌 STEP 3: Pre-test snapshots');
  const chatPre = await evalInPage(wsChat, 'document.body.innerText.slice(0,500)');
  console.log(`  ChatGPT pre (${chatPre?.length || 0} chars)`);
  const gemPre = await evalInPage(wsGemini, 'document.body.innerText.slice(0,500)');
  console.log(`  Gemini pre (${gemPre?.length || 0} chars)`);
  
  // ============ STEP 4: Type prompt into ChatGPT ============
  const TOPIC = `Write a Python function sum_list(lst) that takes a list of integers and returns the sum. Implement it using a simple for-loop. Keep it short - just the function, no explanation.`;
  
  console.log('\n📌 STEP 4: Inject prompt into ChatGPT');
  console.log(`  Topic: ${TOPIC.slice(0,80)}...`);
  
  // Focus and type
  const typed = await evalInPage(wsChat, `
    (function(){
      const el = document.querySelector('#prompt-textarea') || 
                 document.querySelector('p[data-placeholder]') ||
                 document.querySelector('[contenteditable="true"]');
      if (!el) return 'no_input_found';
      el.focus();
      // Clear existing content
      if (el.tagName === 'TEXTAREA') {
        el.value = ${JSON.stringify(TOPIC)};
      } else {
        el.textContent = '';
        const p = document.createElement('p');
        p.textContent = ${JSON.stringify(TOPIC)};
        el.appendChild(p);
      }
      el.dispatchEvent(new Event('input', {bubbles:true}));
      return 'typed_into_' + el.tagName;
    })()
  `);
  console.log(`  Type result: ${typed}`);
  
  await WAIT(1000);
  
  // Click send
  const sent = await evalInPage(wsChat, `
    (function(){
      const btn = document.querySelector('[data-testid="send-button"]') ||
                  document.querySelector('button[aria-label="Send prompt"]') ||
                  document.querySelector('#composer-background button[type="submit"]') ||
                  [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.includes('Send'));
      if (!btn) return 'no_send_button:' + JSON.stringify([...document.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label')).slice(0,5));
      btn.click();
      return 'send_clicked';
    })()
  `);
  console.log(`  Send result: ${sent}`);
  
  // ============ STEP 5: Monitor ChatGPT response ============
  console.log('\n📌 STEP 5: Wait for ChatGPT response');
  
  let chatResponse = null;
  for (let i = 0; i < 30; i++) {
    await WAIT(3000);
    
    const stillGenerating = await isGenerating(wsChat);
    const currentBody = await evalInPage(wsChat, 'document.body.innerText.slice(0,1000)');
    
    // Check if body has grown (new response)
    if (currentBody && currentBody !== chatPre) {
      // Get the new content after "Write a Python"
      const newContent = currentBody.replace(chatPre?.slice(0,200) || '', '').trim();
      if (newContent.length > 50 && !stillGenerating) {
        chatResponse = newContent;
        console.log(`  ChatGPT response (${i * 3}s): ${newContent.slice(0,200)}...`);
        break;
      }
    }
    
    const dot = stillGenerating ? '⏳' : '.';
    if (i % 3 === 0) process.stdout.write(dot);
  }
  
  if (!chatResponse) {
    console.log('\n  ⚠️ No clear ChatGPT response detected, getting current body');
    chatResponse = await evalInPage(wsChat, 'document.body.innerText.slice(0,1000)') || '';
  }
  
  // ============ STEP 6: Wait for relay to Gemini ============
  console.log('\n\n📌 STEP 6: Wait for relay → Gemini');
  
  let gemResponse = null;
  const gemPreLen = gemPre?.length || 0;
  
  // Refresh popup tabs
  await evalInPage(wsPopup, 'if(typeof refreshTabs==="function") refreshTabs()');
  await WAIT(2000);
  
  for (let i = 0; i < 25; i++) {
    await WAIT(4000);
    
    const stillG = await isGenerating(wsGemini);
    const currentBody = await evalInPage(wsGemini, 'document.body.innerText.slice(0,1000)');
    
    if (currentBody && currentBody.length > gemPreLen + 100 && !stillG) {
      gemResponse = currentBody.slice(gemPreLen).trim();
      console.log(`  Gemini response found after ${(i+1)*4}s`);
      console.log(`  Preview: ${gemResponse.slice(0,300)}...`);
      break;
    }
    
    if (i % 3 === 0) process.stdout.write(stillG ? '⏳' : '.');
  }
  
  if (!gemResponse) {
    console.log('\n  ⚠️ Gemini may not have responded via relay. Checking...');
    const gemFull = await evalInPage(wsGemini, 'document.body.innerText.slice(0,2000)');
    console.log(`  Gemini body (${gemFull?.length || 0} chars): ${gemFull?.slice(gemPreLen, gemPreLen + 300) || ''}`);
  }
  
  // ============ STEP 7: Check extension log ============
  console.log('\n\n📌 STEP 7: VS Brain Extension Log');
  const extLog = await evalInPage(wsPopup, `
    (function(){
      const log = document.querySelector("#log");
      return log ? log.textContent.slice(-800) : "no log element";
    })()
  `);
  console.log(extLog);
  
  // ============ STEP 8: Final state ============
  console.log('\n\n📌 STEP 8: Final State Summary');
  
  const popupFinal = await evalInPage(wsPopup, `JSON.stringify({
    sourceOpts: Array.from(document.querySelectorAll("#sourceTab option")).map(o => o.textContent.slice(0,40)),
    status: document.querySelector("#status")?.textContent || "",
    sendState: document.querySelector("#startStop")?.textContent || ""
  })`);
  console.log('  Popup:', popupFinal);
  
  // Check ChatGPT final
  const chatFinal = await evalInPage(wsChat, 'document.body.innerText.slice(0,1500)');
  console.log(`\n  ChatGPT final (${chatFinal?.length || 0} chars): ${chatFinal?.slice(0,300)}`);
  
  const gemFinal = await evalInPage(wsGemini, 'document.body.innerText.slice(0,1500)');
  console.log(`\n  Gemini final (${gemFinal?.length || 0} chars): ${gemFinal?.slice(gemPreLen, gemPreLen + 300)}`);
  
  // Cleanup
  wsChat.close();
  wsGemini.close();
  wsPopup.close();
  
  console.log('\n\n✅ Smoke test complete');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
