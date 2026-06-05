import WebSocket from 'ws';
import http from 'http';

const CDP = 'http://127.0.0.1:9222';
const WAIT = ms => new Promise(r => setTimeout(r, ms));

function cdpFetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const tid = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);
    ws.on('open', () => { clearTimeout(tid); resolve(ws); });
    ws.on('error', e => { clearTimeout(tid); reject(e); });
  });
}

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

async function evalPage(ws, expr) {
  const r = await wsSend(ws, Math.random()*1e6|0, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}

async function main() {
  console.log('🔬 VS Brain Auto-Loop Real Test\n');
  const pages = await cdpFetch('/json/list');
  const chatgpt = pages.find(p => p.url?.includes('chatgpt.com'));
  const gemini = pages.find(p => p.url?.includes('gemini.google.com'));
  const popup = pages.find(p => p.url?.includes('popup.html'));
  
  const [wsChat, wsGem, wsPop] = await Promise.all([
    wsConnect(chatgpt.webSocketDebuggerUrl),
    wsConnect(gemini.webSocketDebuggerUrl),
    wsConnect(popup.webSocketDebuggerUrl)
  ]);
  
  for (const ws of [wsChat, wsGem, wsPop]) await wsSend(ws, 1, 'Runtime.enable');
  console.log('Connected ✓\n');
  
  // Get popup current log
  let log = await evalPage(wsPop, 'document.querySelector("#log")?.textContent?.slice(-200) || "no log"');
  console.log('Log before:', log.slice(-100));
  
  // === STEP 1: Click Start button ===
  console.log('\n▶ Clicking Start...');
  const startResult = await evalPage(wsPop, `
    (function(){
      const btn = document.querySelector('#oneClickStartBtn');
      if (!btn) return 'no_start_btn';
      if (btn.disabled) return 'start_btn_disabled';
      btn.click();
      return 'start_clicked';
    })()
  `);
  console.log('Start result:', startResult);
  await WAIT(5000);
  
  // Check log after start
  log = await evalPage(wsPop, 'document.querySelector("#log")?.textContent?.slice(-400) || "no log"');
  console.log('Log after Start:', log.slice(-300));
  
  // === STEP 2: Inject prompt into ChatGPT ===
  const PROMPT = `Write a Python function that calculates factorial using a for-loop. Just the code, no explanation. Very brief.`;
  console.log(`\n▶ Injecting: "${PROMPT}"`);
  
  await evalPage(wsChat, `
    (function(){
      const el = document.querySelector('#prompt-textarea') || document.querySelector('[contenteditable="true"]');
      if (!el) return 'noinput';
      el.focus();
      el.textContent = '';
      const p = document.createElement('p');
      p.textContent = ${JSON.stringify(PROMPT)};
      el.appendChild(p);
      el.dispatchEvent(new Event('input', {bubbles:true}));
      // Click send
      setTimeout(() => {
        const s = document.querySelector('[data-testid="send-button"]') || 
                  [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.includes('Send'));
        if (s) s.click();
      }, 500);
      return 'ok';
    })()
  `);
  
  // === STEP 3: Monitor for 90 seconds ===
  console.log('\n⏳ Monitoring relay loop (checking every 10s)...');
  
  let chatPrevLen = 0, gemPrevLen = 0;
  
  for (let i = 1; i <= 15; i++) {
    await WAIT(6000);
    
    const chatBody = await evalPage(wsChat, 'document.body.innerText.slice(0,2000)') || '';
    const gemBody = await evalPage(wsGem, 'document.body.innerText.slice(0,2000)') || '';
    const popupLog = await evalPage(wsPop, 'document.querySelector("#log")?.textContent?.slice(-600) || "no log"');
    const status = await evalPage(wsPop, 'document.querySelector("#status")?.textContent || ""');
    const loopCount = await evalPage(wsPop, 'document.querySelector("#loopCounter")?.textContent || "?"');
    
    const chatNew = chatBody.length - chatPrevLen;
    const gemNew = gemBody.length - gemPrevLen;
    
    console.log(`[${i*6}s] status=${status.slice(0,20)} | loop=${loopCount} | chat:${chatPrevLen}→${chatBody.length} | gem:${gemPrevLen}→${gemBody.length}`);
    
    // Show log if interesting
    if (popupLog.includes('relay') || popupLog.includes('send') || popupLog.includes('response') || popupLog.includes('extract') || popupLog.includes('paste') || popupLog.includes('stop')) {
      console.log(`  LOG: ${popupLog.slice(-200)}`);
    }
    
    // Check if loop stopped or blueprint generated
    if (popupLog.includes('finalize') || popupLog.includes('blueprint') || popupLog.includes('Finalized')) {
      console.log('\n🎯 DETECTED FINALIZATION!');
      console.log(popupLog.slice(-400));
      break;
    }
    
    // Check if loop is running
    if (status.includes('Running') && loopCount !== '?' && loopCount !== '0/100') {
      const [done, max] = loopCount.split('/').map(Number);
      if (done >= max) {
        console.log(`\n✅ Max steps reached: ${loopCount}`);
      }
    }
    
    chatPrevLen = chatBody.length;
    gemPrevLen = gemBody.length;
  }
  
  // === FINAL REPORT ===
  console.log('\n\n📊 FINAL REPORT');
  console.log('================');
  
  const finalLog = await evalPage(wsPop, 'document.querySelector("#log")?.textContent?.slice(-800) || "no log"');
  const finalStatus = await evalPage(wsPop, 'document.querySelector("#status")?.textContent || "?");
  const finalLoop = await evalPage(wsPop, 'document.querySelector("#loopCounter")?.textContent || "?');
  
  console.log(`Status: ${finalStatus}`);
  console.log(`Loop: ${finalLoop}`);
  console.log('\n--- Extension Log ---');
  console.log(finalLog);
  
  // Get last content from both
  const chatFinal = await evalPage(wsChat, 'document.body.innerText.slice(0,1500)') || '';
  const gemFinal = await evalPage(wsGem, 'document.body.innerText.slice(0,1500)') || '';
  
  console.log(`\nChatGPT body: ${chatFinal.length} chars`);
  console.log(`Gemini body: ${gemFinal.length} chars`);
  
  wsChat.close(); wsGem.close(); wsPop.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
