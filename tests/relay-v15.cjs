// relay-v15.cjs — ChatGPT ↔ Gemini relay loop
// Chat: type into textarea + click send-button [data-testid="send-button"]
// Gemini: type into contenteditable + CDP Input.dispatchKeyEvent Enter + model-response
// 2 rounds: ChatGPT→Gemini→ChatGPT→Gemini
const WebSocket = require('ws');
const http = require('http');

function makeWS(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}

function cdp(ws, method, params) {
  return new Promise((res, rej) => {
    const id = Date.now() + Math.random();
    const cb = (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) { ws.removeListener('message', cb); res(m); }
    };
    ws.on('message', cb);
    ws.on('error', rej);
    ws.send(JSON.stringify({id, method, params}));
  });
}

async function js(ws, code) {
  const r = await cdp(ws, 'Runtime.evaluate', {
    expression: `(${code})()`,
    returnByValue: true
  });
  return r.result.value;
}

async function nativeEnter(ws) {
  await cdp(ws, 'Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Enter', keyCode: 13, code: 'Enter',
    windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13
  });
  await new Promise(r => setTimeout(r, 50));
  await cdp(ws, 'Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Enter', keyCode: 13, code: 'Enter'
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

const SEED = `Quản trị AI nên do chính phủ kiểm soát hoàn toàn hay cộng đồng mã nguồn mở tự quản? Hãy đưa ra quan điểm của bạn và lập luận ngắn gọn.`;

const INSTRUCTION = (prevName, prevText) => `PHẢN BIỆN: ${prevName} vừa nói: "${prevText}"

Hãy phản biện lại — phân tích điểm yếu trong lập luận trên, hoặc đưa ra góc nhìn đối lập. Trả lời bằng tiếng Việt.`;

// ====== CHATGPT ======
async function chatgptSend(ws, text) {
  // Fresh thread
  await cdp(ws, 'Runtime.evaluate', {
    expression: `(()=>{window.location.href='https://chatgpt.com/';})()`,
    returnByValue: false
  });
  console.log('  ChatGPT: fresh thread...');
  await wait(5000); // Wait for page load
  
  // Type into the message editor
  await cdp(ws, 'Runtime.evaluate', {
    expression: `(()=>{
      const editor = document.querySelector('p[data-placeholder="Message ChatGPT"]');
      if (!editor) return 'no-editor';
      editor.focus();
      document.execCommand('insertText', false, ${JSON.stringify(text)});
      return 'typed';
    })()`,
    returnByValue: true
  });
  console.log('  ChatGPT: typed');
  await wait(1000);

  // Click send
  const clickR = await cdp(ws, 'Runtime.evaluate', {
    expression: `(()=>{
      const btn = document.querySelector('[data-testid="send-button"]');
      if (!btn || btn.disabled) return 'no-send-btn';
      btn.click();
      return 'sent';
    })()`,
    returnByValue: true
  });
  console.log('  ChatGPT: send =>', clickR.result.value);

  // Wait for response
  const resp = await waitForChatGPT(ws, 60000);
  return resp;
}

async function waitForChatGPT(ws, timeoutMs) {
  const start = Date.now();
  let lastLen = 0, stable = 0;
  while (Date.now() - start < timeoutMs) {
    await wait(3000);
    const r = await js(ws, `function(){
      try {
        const msgs = document.querySelectorAll('[data-testid="conversation-turn"]');
        if (!msgs.length) return {status:'waiting', turns:0};
        // Get last turn text (assistant response)
        const last = msgs[msgs.length-1];
        const txt = (last.innerText||'').trim();
        return {status:'ok', turns: msgs.length, text: txt.substring(0,500), len: txt.length};
      } catch(e) { return {status:'error', msg: e.message}; }
    }`);
    if (!r || r.status === 'error') continue;
    console.log(`  ChatGPT: t=${Math.round((Date.now()-start)/1000)}s turns=${r.turns} len=${r.len}`);
    if (r.turns > 1 && r.len > 30) {
      if (r.len === lastLen) {
        stable++;
        if (stable >= 3) return `[ChatGPT] ${r.text}`;
      } else { stable = 0; lastLen = r.len; }
    }
  }
  return null;
}

// ====== GEMINI ======
async function geminiSend(ws, text) {
  // Type into contenteditable
  const typeR = await cdp(ws, 'Runtime.evaluate', {
    expression: `(()=>{
      const ce = document.querySelector('[contenteditable="true"]');
      if (!ce) return 'no-contenteditable';
      ce.focus();
      ce.innerText = '';
      ce.dispatchEvent(new Event('input',{bubbles:true}));
      return 'cleared';
    })()`,
    returnByValue: true
  });
  console.log('  Gemini: clear =>', typeR.result.value);

  await wait(300);
  
  // Insert text via CDP native
  await cdp(ws, 'Input.insertText', { text: text });
  console.log('  Gemini: typed');
  await wait(500);

  // Send via native Enter
  await nativeEnter(ws);
  console.log('  Gemini: sent (native Enter)');

  // Wait for model-response
  const resp = await waitForGemini(ws, 60000);
  return resp;
}

async function waitForGemini(ws, timeoutMs) {
  const start = Date.now();
  let lastLen = 0, stable = 0;
  while (Date.now() - start < timeoutMs) {
    await wait(3000);
    const r = await js(ws, `function(){
      try {
        const mr = document.querySelector('model-response');
        if (!mr) return {status:'waiting', msg:'no-model-response'};
        const txt = (mr.shadowRoot || mr).textContent || mr.innerText || '';
        if (!txt.trim()) return {status:'waiting', msg:'empty'};
        // Strip "Gemini đã nói" prefix
        var t = txt.trim();
        var idx = t.indexOf('Gemini đã nói');
        if (idx !== -1) t = t.substring(idx + 13).trim();
        // Strip "Interpreting the Prompt" prefix
        idx = t.indexOf('Interpreting the Prompt');
        if (idx === 0) t = t.substring(24).trim();
        return {status:'ok', text: t.substring(0,500), len: t.length};
      } catch(e) { return {status:'error', msg: e.message}; }
    }`);
    if (!r || r.status !== 'ok') { console.log(`  Gemini: t=${Math.round((Date.now()-start)/1000)}s ${r?.status||'null'}`); continue; }
    console.log(`  Gemini: t=${Math.round((Date.now()-start)/1000)}s len=${r.len}`);
    if (r.len > 30) {
      if (r.len === lastLen) {
        stable++;
        if (stable >= 3) return `[Gemini] ${r.text}`;
      } else { stable = 0; lastLen = r.len; }
    }
  }
  return null;
}

// ====== MAIN RELAY ======
async function main() {
  const tabs = await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d)));
  }));
  
  const chatTab = tabs.find(t => t.url.includes('chatgpt.com') && t.type === 'page');
  const gemTab = tabs.find(t => t.url.includes('gemini.google.com/app') && t.type === 'page');

  if (!chatTab || !gemTab) {
    console.log('Missing tabs:', {chatgpt: !!chatTab, gemini: !!gemTab});
    return;
  }

  console.log('ChatGPT:', chatTab.id.substring(0,8), chatTab.url.substring(0,80));
  console.log('Gemini:', gemTab.id.substring(0,8), gemTab.url.substring(0,80));

  const cWS = await makeWS(chatTab.webSocketDebuggerUrl);
  const gWS = await makeWS(gemTab.webSocketDebuggerUrl);

  // === ROUND 1: ChatGPT với seed topic ===
  console.log('\n=== ROUND 1: ChatGPT (seed) ===');
  const c1 = await chatgptSend(cWS, SEED);
  if (!c1) { console.log('FAIL: ChatGPT round 1 no response'); return; }
  console.log(`\n✅ ChatGPT: ${c1.substring(0,200)}...`);

  // === ROUND 2: Gemini phản biện ChatGPT ===
  console.log('\n=== ROUND 2: Gemini rebuttal ===');
  const g1 = await geminiSend(gWS, INSTRUCTION('ChatGPT', c1));
  if (!g1) { console.log('FAIL: Gemini round 2 no response'); return; }
  console.log(`\n✅ Gemini: ${g1.substring(0,200)}...`);

  // === ROUND 3: ChatGPT phản biện Gemini ===
  console.log('\n=== ROUND 3: ChatGPT rebuttal ===');
  const c2 = await chatgptSend(cWS, INSTRUCTION('Gemini', g1));
  if (!c2) { console.log('FAIL: ChatGPT round 3 no response'); return; }
  console.log(`\n✅ ChatGPT: ${c2.substring(0,200)}...`);

  // === ROUND 4: Gemini phản biện ChatGPT ===
  console.log('\n=== ROUND 4: Gemini final rebuttal ===');
  const g2 = await geminiSend(gWS, INSTRUCTION('ChatGPT', c2));
  if (!g2) { console.log('FAIL: Gemini round 4 no response'); return; }
  console.log(`\n✅ Gemini: ${g2.substring(0,200)}...`);

  console.log('\n\n=== RELAY COMPLETE ===');
  console.log(`[ChatGPT→Gemini→ChatGPT→Gemini]: ALL PASS`);

  cWS.close();
  gWS.close();
}

main().catch(e => console.error(e));
