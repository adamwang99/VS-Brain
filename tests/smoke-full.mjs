import WebSocket from 'ws';
import http from 'http';

const CDP = 'http://127.0.0.1:9222';

// Fetch a URL via CDP
function fetchCDP(path) {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Send command to WS and wait for response
function wsCommand(ws, id, method, params = {}) {
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

// Evaluate JS in a page
async function evalInPage(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('connection timeout')), 5000);
  });
  const result = await wsCommand(ws, 99, 'Runtime.evaluate', { expression, returnByValue: true });
  ws.close();
  return result.result?.result?.value;
}

async function main() {
  const pages = await fetchCDP('/json/list');
  
  // Find tabs
  const chatgpt = pages.find(p => p.url?.includes('chatgpt.com'));
  const gemini = pages.find(p => p.url?.includes('gemini.google.com'));
  const popup = pages.find(p => p.url?.includes('popup.html'));
  
  console.log('=== 1. Login Check ===');
  
  // Check ChatGPT login
  const chatgptBody = await evalInPage(chatgpt.webSocketDebuggerUrl, 'document.body.innerText.slice(0,400)');
  const chatgptLoggedIn = !chatgptBody.includes('Log in') && !chatgptBody.includes('Sign up');
  console.log(`ChatGPT: ${chatgptLoggedIn ? '✅ LOGGED IN' : '❌ NOT LOGGED IN'}`);
  console.log(`  Preview: ${chatgptBody.slice(0,150).replace(/\n/g, ' | ')}`);
  
  // Check Gemini login
  const geminiBody = await evalInPage(gemini.webSocketDebuggerUrl, 'document.body.innerText.slice(0,400)');
  const geminiLoggedIn = !geminiBody.includes('Sign in');
  console.log(`Gemini:  ${geminiLoggedIn ? '✅ LOGGED IN' : '❌ NOT LOGGED IN'}`);
  console.log(`  Preview: ${geminiBody.slice(0,150).replace(/\n/g, ' | ')}`);

  if (!chatgptLoggedIn || !geminiLoggedIn) {
    console.log('\n❌ Login required. Cannot proceed with relay test.');
    process.exit(1);
  }

  console.log('\n=== 2. VS Brain Popup State ===');
  
  // Refresh tabs from popup
  await evalInPage(popup.webSocketDebuggerUrl, 'if(typeof refreshTabs==="function") refreshTabs()');
  await new Promise(r => setTimeout(r, 3000));
  
  const popupState = await evalInPage(popup.webSocketDebuggerUrl, `JSON.stringify({
    sourceOpts: Array.from(document.querySelectorAll("#sourceTab option")).map(o=>({v:o.value,t:o.textContent})),
    status: document.querySelector("#status")?.textContent || "",
    log: (document.querySelector("#log")?.textContent || "").slice(-500),
    startBtnDisabled: document.querySelector("#startStop")?.disabled
  })`);
  console.log(JSON.parse(popupState));

  console.log('\n=== 3. Extension Info ===');
  const extInfo = await evalInPage(popup.webSocketDebuggerUrl, `JSON.stringify({
    version: document.querySelector("#version")?.textContent || document.title || "",
    runtimeMarker: (()=>{
      const el = document.querySelector("#log");
      if(!el) return "?";
      const t = el.textContent;
      const m = t.match(/runtime marker: ([^\\n]+)/);
      return m ? m[1] : "not found";
    })(),
    runtimeVersion: (()=>{
      const el = document.querySelector("#log");
      if(!el) return "?";
      const t = el.textContent;
      const m = t.match(/runtime version: ([^\\n]+)/);
      return m ? m[1] : "not found";
    })()
  })`);
  console.log(JSON.parse(extInfo));
  
  console.log('\n=== 4. Summary ===');
  console.log(`ChatGPT login: ${chatgptLoggedIn ? 'PASS' : 'FAIL'}`);
  console.log(`Gemini login:  ${geminiLoggedIn ? 'PASS' : 'FAIL'}`);
  console.log(`Extension:    LOADED`);
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
