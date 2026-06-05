// Copilot solo v2 — click send button, not Enter
const WebSocket = require('ws');
const http = require('http');

async function js(wsUrl, fn) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    let mid = 1;
    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id === mid) { ws.close(); res(m.result); }
    });
    ws.on('open', () => ws.send(JSON.stringify({id: mid, method: 'Runtime.evaluate',
      params: { expression: `(${fn.toString()})()`, returnByValue: true }
    })));
    ws.on('error', rej);
  });
}

async function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const tabs = await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d)));
  }));
  const tab = tabs.find(t => t.url.includes('copilot.microsoft.com'));
  if (!tab) { console.log('Copilot tab not found'); return; }
  const ws = tab.webSocketDebuggerUrl;
  console.log(`Tab: ${tab.id.substring(0,8)}`);

  // Find the actual send button — look for submit or [Enter] key press area
  const btns = await js(ws, function() {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const parent = ta.closest('form') || ta.closest('[class*="input"]') || ta.parentElement;
    // Find ALL buttons in parent chain
    const all = document.querySelectorAll('button');
    const infos = [];
    all.forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width > 0) infos.push({
        aria: (b.getAttribute('aria-label')||'').substring(0,40),
        dt: (b.getAttribute('data-testid')||'').substring(0,40),
        txt: (b.innerText||'').trim().substring(0,20),
        cls: (b.className||'').substring(0,25),
        type: (b.getAttribute('type')||''),
        x: Math.round(r.x), y: Math.round(r.y)
      });
    });
    return infos;
  });
  console.log('All buttons:', JSON.stringify(btns, null, 2));

  // Send a clean new message: clear textarea first
  console.log('\n--- NEW THREAD ---');
  // First: fresh page load to clear old messages
  await js(ws, function() {
    const ta = document.querySelector('textarea');
    ta.value = 'Xin chao, 1+1 bang may?';
    ta.dispatchEvent(new Event('input', {bubbles:true}));
  });
  await waitMs(500);

  // Try pressing Enter to send
  const result = await js(ws, function() {
    const ta = document.querySelector('textarea');
    // Create and dispatch proper Enter keydown
    const evt = new KeyboardEvent('keydown', {
      key: 'Enter', keyCode: 13, code: 'Enter',
      bubbles: true, cancelable: true, composed: true
    });
    return ta.dispatchEvent(evt);
  });
  console.log('Enter dispatch:', result);

  // Wait for new message
  for (let t = 2; t <= 30; t += 2) {
    await waitMs(2000);
    const check = await js(ws, function() {
      try {
        const all = [];
        document.querySelectorAll('[class*="message"]').forEach(m => {
          const t = m.innerText || '';
          if (t.trim()) all.push(t.trim().substring(0,200));
        });
        // Also check the textarea for new value
        const taVal = document.querySelector('textarea')?.value || '';
        return {count: all.length, texts: all.slice(-5), ta: taVal.substring(0,50)};
      } catch(e) { return {error: e.message}; }
    });
    const val = check.result.value;
    console.log(`t=${t}s msgs:${val?.count || 0} ta:"${(val?.ta||'').substring(0,30)}"`);
    if (val?.count >= 4) { // 2 old + 2 new
      console.log('\n✅ Copilot new messages appeared!');
      val.texts.forEach(tx => console.log(`  ${tx.substring(0,120)}`));
      break;
    }
  }
}

main().catch(e => console.error(e));
