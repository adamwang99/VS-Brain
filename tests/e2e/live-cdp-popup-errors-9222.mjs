const BASE = process.env.BROWSER_URL || 'http://127.0.0.1:9222';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function httpJson(path){ const r = await fetch(`${BASE}${path}`); return await r.json(); }
async function cdp(wsUrl){
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const {resolve, reject} = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  const send = (method, params={}) => new Promise((resolve,reject)=>{
    const mid = ++id;
    pending.set(mid,{resolve,reject});
    ws.send(JSON.stringify({id:mid,method,params}));
  });
  return { ws, send, events, close: ()=>ws.close() };
}
const list = await httpJson('/json/list');
const popup = list.find(x => x.url && x.url.includes('chrome-extension://') && x.url.endsWith('/popup.html'));
if (!popup) throw new Error('popup target not found in /json/list');
const api = await cdp(popup.webSocketDebuggerUrl);
try {
  await api.send('Runtime.enable');
  await api.send('Page.enable');
  await api.send('Log.enable');
  await api.send('Console.enable').catch(()=>{});
  await api.send('Runtime.evaluate', { expression: 'location.reload()', awaitPromise: false }).catch(()=>{});
  await sleep(5000);
  const snapshot = await api.send('Runtime.evaluate', { expression: `(()=>({ href: location.href, title: document.title, html: document.documentElement.outerHTML.slice(0,1000), body: document.body?.innerText?.slice(0,1000) || '' }))()`, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify({
    popupUrl: popup.url,
    snapshot: snapshot.result?.value,
    events: api.events.slice(0,100)
  }, null, 2));
} finally {
  api.close();
}
