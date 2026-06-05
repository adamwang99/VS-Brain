const ws_pkg = require('ws');
const http = require('http');

const CDP = 'http://127.0.0.1:9222';

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(CDP + path, res => {
      let d=''; res.on('data', c => d+=c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}
function wsCmd(ws, id, method, params={}) {
  return new Promise(resolve => {
    ws.send(JSON.stringify({id,method,params}));
    function onMsg(data) {
      try { const r = JSON.parse(data.toString()); if(r.id===id) { ws.removeListener('message',onMsg); resolve(r); } }
      catch(e) {}
    }
    ws.on('message', onMsg);
  });
}

async function openWS(url) {
  const ws = new ws_pkg.WebSocket(url);
  await new Promise((r, rej) => { ws.on('open',r); ws.on('error',rej); setTimeout(()=>rej(new Error('timeout')),5000); });
  return ws;
}

async function main() {
  const pages = await fetchJSON('/json/list');
  const chatgptPage = pages.find(p => p.url?.includes('chatgpt.com'));
  const geminiPage = pages.find(p => p.url?.includes('gemini.google.com'));
  const popup = pages.find(p => p.url?.includes('popup.html'));

  // Step 1: Open a new chat in ChatGPT with a simple question
  console.log('=== STEP 1: Send new prompt to ChatGPT ===');
  const cws = await openWS(chatgptPage.webSocketDebuggerUrl);
  
  // Navigate to new chat
  await wsCmd(cws, 1, 'Page.navigate', { url: 'https://chatgpt.com/' });
  await new Promise(r => setTimeout(r, 3000));

  // Type and send prompt
  const typeR = await wsCmd(cws, 2, 'Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('#prompt-textarea');
      if (!el) return 'input not found';
      el.focus();
      el.innerText = 'What is 1+1? Just answer the number, nothing else.';
      el.dispatchEvent(new InputEvent('input', {bubbles: true}));
      return 'typed';
    })()`,
    returnByValue: true
  });
  console.log('Type:', typeR.result?.result?.value);
  
  // Click send
  await new Promise(r => setTimeout(r, 500));
  const sendR = await wsCmd(cws, 3, 'Runtime.evaluate', {
    expression: `(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.querySelector('svg') && b.offsetParent && !b.disabled) {
          b.click(); return 'send clicked';
        }
      }
      // Try by data-testid
      const b = document.querySelector('[data-testid="send-button"]');
      if (b && !b.disabled) { b.click(); return 'send testid'; }
      return 'no send';
    })()`,
    returnByValue: true
  });
  console.log('Send:', sendR.result?.result?.value);

  // Wait for ChatGPT to respond
  await new Promise(r => setTimeout(r, 8000));
  
  const chatgptTitle = await wsCmd(cws, 4, 'Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true
  });
  console.log('ChatGPT title:', chatgptTitle.result?.result?.value);
  
  const chatgptBody = await wsCmd(cws, 5, 'Runtime.evaluate', {
    expression: 'document.body.innerText.slice(-500)',
    returnByValue: true
  });
  console.log('ChatGPT last text:', chatgptBody.result?.result?.value);
  cws.close();

  // Step 2: Relay the response to Gemini via the popup's relay button
  console.log('\n=== STEP 2: Click relay button on popup ===');
  const pws = await openWS(popup.webSocketDebuggerUrl);
  const relayClick = await wsCmd(pws, 1, 'Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#relayBtn');
      if (!btn) return 'no relayBtn';
      if (btn.disabled) return 'relayBtn disabled: ' + btn.textContent;
      btn.click();
      return 'clicked relayBtn';
    })()`,
    returnByValue: true
  });
  console.log('Relay click:', relayClick.result?.result?.value);
  
  // Wait for paste
  await new Promise(r => setTimeout(r, 2000));
  
  const popupLog = await wsCmd(pws, 2, 'Runtime.evaluate', {
    expression: '(document.querySelector("#log")?.textContent||"").slice(-500)',
    returnByValue: true
  });
  console.log('Popup log after relay:', popupLog.result?.result?.value);
  pws.close();

  // Step 3: Check Gemini - did it receive the paste?
  console.log('\n=== STEP 3: Check Gemini for relayed text ===');
  const gws = await openWS(geminiPage.webSocketDebuggerUrl);
  const geminiInput = await wsCmd(gws, 1, 'Runtime.evaluate', {
    expression: `(() => {
      const inputs = document.querySelectorAll('[contenteditable="true"], textarea');
      for (const el of inputs) {
        const txt = el.innerText || el.value || '';
        if (txt.length > 20) return txt.slice(0, 500);
      }
      return 'no text found in any input';
    })()`,
    returnByValue: true
  });
  console.log('Gemini input text:', geminiInput.result?.result?.value);
  gws.close();
}

main().catch(e => console.error('FATAL:', e.message));
