const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(CDP + path, res => { let d=''; res.on('data', c => d+=c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}
function wsCmd(ws, id, method, params={}) {
  return new Promise(resolve => {
    ws.send(JSON.stringify({id,method,params}));
    function onMsg(data) { try { const r = JSON.parse(data.toString()); if(r.id===id) { ws.removeListener('message',onMsg); resolve(r); } } catch(e) {} }
    ws.on('message', onMsg);
  });
}
async function openWS(url) {
  const ws = new ws_pkg.WebSocket(url);
  await new Promise((r,rej)=>{ws.on('open',r);ws.on('error',rej);setTimeout(()=>rej(new Error('timeout')),5000)});
  return ws;
}

async function main() {
  const pages = await fetchJSON('/json/list');
  const chatgptPage = pages.find(p => p.url?.includes('chatgpt.com'));
  const geminiPage = pages.find(p => p.url?.includes('gemini.google.com'));

  // === 1. Get ChatGPT's answer ===
  console.log('=== 1. Extract ChatGPT answer ===');
  const cws = await openWS(chatgptPage.webSocketDebuggerUrl);
  
  // Check if the 1+1 conversation exists, get URL
  const cUrl = await wsCmd(cws, 1, 'Runtime.evaluate', {
    expression: 'location.href',
    returnByValue: true
  });
  console.log('ChatGPT URL:', cUrl.result?.result?.value);

  // Get last assistant message
  const cAnswer = await wsCmd(cws, 2, 'Runtime.evaluate', {
    expression: `(() => {
      const all = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (!all.length) return 'NO_ASSISTANT';
      const last = all[all.length - 1];
      return last.innerText.trim();
    })()`,
    returnByValue: true
  });
  const chatgptAnswer = cAnswer.result?.result?.value || '';
  console.log('ChatGPT answer:', chatgptAnswer);
  cws.close();

  // === 2. Send to Gemini ===
  console.log('\n=== 2. Relay to Gemini ===');
  const gws = await openWS(geminiPage.webSocketDebuggerUrl);

  // Navigate to blank new chat
  await wsCmd(gws, 1, 'Page.navigate', {url: 'https://gemini.google.com/app'});
  await new Promise(r => setTimeout(r, 4000));

  // The relay message - build in JS so no shell escape issues
  const relayMsg = 'VS Brain critique relay:\\n\\nChatGPT was asked: "1+1=?"\\nChatGPT answered: ' + chatgptAnswer + '\\n\\nNow you answer: what is 1+1? Just the number.';

  // Type into gemini input
  const typeR = await wsCmd(gws, 2, 'Runtime.evaluate', {
    expression: `(() => {
      const msg = ${JSON.stringify(relayMsg)};
      const inputs = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
      for (const el of inputs) {
        if (el.offsetParent !== null) {
          el.focus();
          el.innerText = msg;
          el.dispatchEvent(new InputEvent('input', {bubbles: true, cancelable: true, composed: true}));
          return 'filled: ' + msg.length + ' chars';
        }
      }
      return 'no input found';
    })()`,
    returnByValue: true
  });
  console.log('Type result:', typeR.result?.result?.value);

  // Wait for send button to enable
  await new Promise(r => setTimeout(r, 1000));

  // Click send on Gemini
  const sendR = await wsCmd(gws, 3, 'Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('[aria-label="Gửi tin nhắn"]') || 
                  Array.from(document.querySelectorAll('button')).find(b => 
                    (b.getAttribute('aria-label')||'').toLowerCase().includes('gửi') && b.offsetParent && !b.disabled
                  );
      if (btn) { btn.click(); return 'clicked: ' + (btn.getAttribute('aria-label')||''); }
      return 'no send btn';
    })()`,
    returnByValue: true
  });
  console.log('Send:', sendR.result?.result?.value);

  // Wait for response
  console.log('Waiting 20s for Gemini...');
  await new Promise(r => setTimeout(r, 20000));

  // Read response
  const gResp = await wsCmd(gws, 4, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      responseCount: document.querySelectorAll('model-response').length,
      responses: Array.from(document.querySelectorAll('model-response')).map(m => m.innerText.trim().slice(0,200)),
      stopBtn: !!Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||'').includes('Ngừng'))
    })`,
    returnByValue: true
  });
  console.log('Gemini responses:', gResp.result?.result?.value);
  
  gws.close();

  console.log('\n=== RELAY RESULT ===');
  console.log('ChatGPT -> Gemini: ' + (gResp.result?.result?.value ? 'DONE' : 'FAILED'));
}
main().catch(e => console.error('FATAL:', e.message));
