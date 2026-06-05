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

async function main() {
  const pages = await fetchJSON('/json/list');
  const popup = pages.find(p => p.url?.includes('popup.html'));
  const pws = new ws_pkg.WebSocket(popup.webSocketDebuggerUrl);
  await new Promise((r,rej) => { pws.on('open',r); pws.on('error',rej); setTimeout(()=>rej(new Error('timeout')),5000); });

  // Check if popup loaded successfully and updateEstimatorPill is defined
  const check = await wsCmd(pws, 1, 'Runtime.evaluate', {
    expression: 'JSON.stringify({typeof_up: typeof updateEstimatorPill, isFunc: typeof updateEstimatorPill === "function", typeof_setStatus: typeof setStatus, loopState: typeof loopState, statusText: (document.querySelector("#status")?.textContent||"")})',
    returnByValue: true
  });
  console.log('CHECK:', check.result?.result?.value);

  // We also need to check the service worker - the actual relay happens there
  // But first, let's try clicking the oneClickStartBtn button via CDP more directly
  // The button has class "running" - check if there's a way to restart
  
  // Let's look at the "Reset relay" button
  await wsCmd(pws, 2, 'Runtime.evaluate', {
    expression: 'JSON.stringify({resetText: document.querySelector("#resetRelayBtn")?.textContent, resetDisabled: document.querySelector("#resetRelayBtn")?.disabled})',
    returnByValue: true
  });

  pws.close();
}
main().catch(e => console.error(e.message));
