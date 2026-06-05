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

async function main() {
  const pages = await fetchJSON('/json/list');
  const gemini = pages.find(p => p.url?.includes('gemini.google.com'));
  const gws = new ws_pkg.WebSocket(gemini.webSocketDebuggerUrl);
  await new Promise((r,rej) => { gws.on('open',r); gws.on('error',rej); setTimeout(()=>rej(new Error('t')),5000); });

  // Check if Gemini is still generating
  const r1 = await wsCmd(gws, 1, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      stopBtnCount: Array.from(document.querySelectorAll('button')).filter(b=>b.getAttribute('aria-label')?.includes('Ngừng')||b.getAttribute('aria-label')?.includes('Stop')).length,
      responseText: Array.from(document.querySelectorAll('model-response')).map(m=>m.innerText.slice(0,500)).join(' ||| '),
      inputText: (document.querySelector('[contenteditable="true"]')?.innerText||''),
      modelResponseCount: document.querySelectorAll('model-response').length,
    })`,
    returnByValue: true
  });
  console.log('GEMINI:', r1.result?.result?.value);
  gws.close();
}
main().catch(e => console.error(e.message));
