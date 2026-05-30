const BASE = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function httpJson(path){ const r = await fetch(`${BASE}${path}`); return await r.json(); }
async function cdp(wsUrl){
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const {resolve, reject} = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  const send = (method, params={}) => new Promise((resolve,reject)=>{
    const mid = ++id;
    pending.set(mid,{resolve,reject});
    ws.send(JSON.stringify({id:mid,method,params}));
  });
  return { ws, send, close: ()=>ws.close() };
}
const list = await httpJson('/json/list');
const popup = list.find(x => x.url && x.url.includes('chrome-extension://') && x.url.endsWith('/popup.html'));
if (!popup) throw new Error('popup target not found in /json/list');
const api = await cdp(popup.webSocketDebuggerUrl);
try {
  await api.send('Runtime.enable');
  await api.send('Page.enable');
  const evalExpr = async (expression) => {
    const r = await api.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };
  const before = await evalExpr(`(()=>({
    href: location.href,
    title: document.title,
    ready: document.readyState,
    hasRefresh: !!document.querySelector('#refreshTabsBtn'),
    hasStart: !!document.querySelector('#startLoopBtn'),
    log: document.querySelector('#log')?.textContent || '',
    status: document.querySelector('#status')?.textContent || '',
    options: [...document.querySelectorAll('#sourceTab option')].map(o=>({value:o.value,text:o.textContent}))
  }))()`);
  await api.send('Runtime.evaluate', { expression: `document.querySelector('#refreshTabsBtn')?.click()`, awaitPromise: true });
  await sleep(3000);
  const afterRefresh = await evalExpr(`(()=>({
    log: document.querySelector('#log')?.textContent || '',
    status: document.querySelector('#status')?.textContent || '',
    options: [...document.querySelectorAll('#sourceTab option')].map(o=>({value:o.value,text:o.textContent})),
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    startDisabled: !!document.querySelector('#startLoopBtn')?.disabled
  }))()`);
  await api.send('Runtime.evaluate', { expression: `(()=>{ const a=document.querySelector('#autoSendToggle'); if(a) a.checked=true; document.querySelector('#startLoopBtn')?.click(); })()`, awaitPromise: true });
  await sleep(5000);
  const afterStart = await evalExpr(`(()=>({
    log: document.querySelector('#log')?.textContent || '',
    status: document.querySelector('#status')?.textContent || '',
    sourceVal: document.querySelector('#sourceTab')?.value || '',
    targetVal: document.querySelector('#targetTab')?.value || '',
    startDisabled: !!document.querySelector('#startLoopBtn')?.disabled,
    stopVisible: (document.querySelector('#log')?.textContent || '').includes('auto-loop stopped')
  }))()`);
  console.log(JSON.stringify({ popupUrl: popup.url, before, afterRefresh, afterStart }, null, 2));
} finally {
  api.close();
}
