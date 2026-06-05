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
async function openWS(url) { const ws = new ws_pkg.WebSocket(url); await new Promise((r,rej)=>{ws.on('open',r);ws.on('error',rej);setTimeout(()=>rej(new Error('timeout')),5000)}); return ws; }

async function main() {
  const pages = await fetchJSON('/json/list');
  const chatgptPage = pages.find(p => p.url?.includes('chatgpt.com'));
  const geminiPage = pages.find(p => p.url?.includes('gemini.google.com'));

  // Quick topic: "What is 1+1?"
  console.log('=== TEST: Manual relay ChatGPT -> Gemini with "1+1=?" ===');

  // 1. Navigate ChatGPT to new chat
  const cws = await openWS(chatgptPage.webSocketDebuggerUrl);
  await wsCmd(cws, 1, 'Page.navigate', {url:'https://chatgpt.com/'});
  await new Promise(r => setTimeout(r, 4000));

  // 2. Send new prompt to ChatGPT
  await wsCmd(cws, 2, 'Runtime.evaluate', {
    expression: `(()=>{const e=document.querySelector('#prompt-textarea');if(!e)return'nf';e.innerText='1+1=?';e.dispatchEvent(new InputEvent('input',{bubbles:true}));return'ok'})()`,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 500));

  await wsCmd(cws, 3, 'Runtime.evaluate', {
    expression: `(()=>{const b=document.querySelector('[data-testid="send-button"]')||Array.from(document.querySelectorAll('button')).find(x=>x.querySelector('svg')&&x.offsetParent);if(b&&!b.disabled){b.click();return'clicked'}return'nosend'})()`,
    returnByValue: true
  });

  // 3. Wait for ChatGPT response
  console.log('Waiting for ChatGPT to respond...');
  await new Promise(r => setTimeout(r, 10000));

  // 4. Extract ChatGPT response
  const cResponse = await wsCmd(cws, 4, 'Runtime.evaluate', {
    expression: `(()=>{const ms=document.querySelectorAll('[data-message-author-role="assistant"]');if(!ms.length)return'no-response';const last=ms[ms.length-1];return last.innerText.trim().slice(0,200)})()`,
    returnByValue: true
  });
  console.log('ChatGPT: "1+1=?" => ', cResponse.result?.result?.value);

  // 5. Now relay to Gemini
  // First check Gemini is on a valid chat page
  const gws = await openWS(geminiPage.webSocketDebuggerUrl);
  const gUrl = await wsCmd(gws, 1, 'Runtime.evaluate', {expression:'location.href',returnByValue:true});
  console.log('Gemini URL:', gUrl.result?.result?.value);

  // Navigate to Gemini chat if on homepage
  if (gUrl.result?.result?.value?.includes('/app') && !gUrl.result?.result?.value?.includes('/app/')) {
    // Start a new conversation
    await wsCmd(gws, 2, 'Runtime.evaluate', {
      expression: `(()=>{const inputs=document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');for(const e of inputs){if(!e.disabled&&e.offsetParent){e.focus();e.innerText='';return'focused '+e.tagName}}return'no input'})()`,
      returnByValue: true
    });
  }

  // 6. Paste ChatGPT response into Gemini input
  const relayText = 'Critique: "1+1=?"\nChatGPT answered: ' + (cResponse.result?.result?.value || '2') + '\n\nNow answer yourself: what is 1+1?';
  
  const fillR = await wsCmd(gws, 3, 'Runtime.evaluate', {
    expression: `(()=>{const t="${relayText.replace(/"/g,'\\"').replace(/\n/g,'\\n')}";const inputs=document.querySelectorAll('[contenteditable="true"], textarea');for(const e of inputs){if(e.offsetParent&&!e.disabled){e.focus();e.innerText=t;e.dispatchEvent(new InputEvent('input',{bubbles:true}));return'filled: '+(e.innerText||'').slice(0,40)}}return'no input found'})()`,
    returnByValue: true
  });
  console.log('Gemini fill:', fillR.result?.result?.value);

  // 7. Click send on Gemini
  await new Promise(r => setTimeout(r, 500));
  const sendGR = await wsCmd(gws, 4, 'Runtime.evaluate', {
    expression: `(()=>{const btns=document.querySelectorAll('button');for(const b of btns){const lbl=(b.getAttribute('aria-label')||'').toLowerCase();if((lbl.includes('send')||lbl.includes('gửi')||b.querySelector('svg[data-testid="send-button"]'))&&b.offsetParent&&!b.disabled){b.click();return'clicked: '+lbl}}return'no send button'})()`,
    returnByValue: true
  });
  console.log('Gemini send:', sendGR.result?.result?.value);

  // 8. Wait for Gemini response
  console.log('Waiting for Gemini to respond...');
  await new Promise(r => setTimeout(r, 15000));

  // 9. Extract Gemini response
  const gResponse = await wsCmd(gws, 5, 'Runtime.evaluate', {
    expression: `(()=>{const ms=document.querySelectorAll('model-response, .model-response-text, message-content');if(!ms.length)return document.body.innerText.slice(0,500);const last=ms[ms.length-1];return last.innerText.trim().slice(0,300)})()`,
    returnByValue: true
  });
  console.log('Gemini response:', gResponse.result?.result?.value);

  gws.close();
  cws.close();

  console.log('\n=== RESULT ===');
  console.log('Relay ChatGPT->Gemini: ' + (gResponse.result?.result?.value ? '✅ RELAY WORKED' : '❌ No relay response'));
}

main().catch(e => console.error('FATAL:', e.message));
