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

  // Check which functions are defined/undefined from ui.js
  const check = await wsCmd(pws, 1, 'Runtime.evaluate', {
    expression: `JSON.stringify({
      stopLoop: typeof stopLoop,
      loopStep: typeof loopStep,
      setLoopRunning: typeof setLoopRunning,
      executeRelay: typeof executeRelay,
      scan: typeof scan,
      refreshTabs: typeof refreshTabs,
      chooseSourceAndTarget: typeof chooseSourceAndTarget,
      updateEstimatorPill: typeof updateEstimatorPill,
      startAutoLoopWithTabs: typeof startAutoLoopWithTabs,
      finalizeAndSave: typeof finalizeAndSave,
      loopState_val: typeof loopState,
      currentScan: typeof currentScan
    })`,
    returnByValue: true
  });
  console.log('Function check:', check.result?.result?.value);

  // Look at the actual script error
  // Enable runtime to catch exceptions
  const bodyContents = await wsCmd(pws, 2, 'Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('script')).map(s => ({src: s.src, textStart: (s.textContent||'').slice(0,80)}))`,
    returnByValue: true
  });
  console.log('Script tags:', bodyContents.result?.result?.value);

  pws.close();
}
main().catch(e => console.error(e.message));
