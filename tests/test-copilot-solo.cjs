// Copilot solo test — textarea + Enter key
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

async function main() {
  const tabs = await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d)));
  }));
  const tab = tabs.find(t => t.url.includes('copilot.microsoft.com'));
  if (!tab) { console.log('Copilot tab not found'); return; }
  const ws = tab.webSocketDebuggerUrl;
  console.log(`Tab: ${tab.id.substring(0,8)} | ${tab.title}`);

  // Check textarea + send button
  const info = await js(ws, function() {
    const ta = document.querySelector('textarea');
    if (!ta) return {error:'no textarea'};
    // Find send: the Enter-key-like button near textarea
    const parent = ta.closest('[class*="composer"]') || ta.parentElement;
    const btns = parent.querySelectorAll('button');
    const btnInfo = [];
    btns.forEach(b => {
      const aria = b.getAttribute('aria-label') || '';
      const txt = (b.innerText || '').trim();
      btnInfo.push({aria: aria.substring(0,30), txt: txt.substring(0,20), 
                    dt: (b.getAttribute('data-testid')||'').substring(0,30),
                    disabled: b.disabled,
                    cls: (b.className||'').substring(0,30)});
    });
    // Try: Enter key works on Copilot
    return {ph:ta.placeholder, rows:ta.rows, btns: btnInfo};
  });
  console.log('State:', JSON.stringify(info, null, 2));

  // Clear + type
  console.log('\n--- SENDING ---');
  await new Promise(r => setTimeout(r, 500));
  const typed = await js(ws, function() {
    const ta = document.querySelector('textarea');
    ta.focus();
    ta.value = '1+1 bang may? Tra loi ngan gon.';
    ta.dispatchEvent(new Event('input', {bubbles:true}));
    return ta.value;
  });
  console.log('Typed:', typed.result.value);

  // Try Enter
  await new Promise(r => setTimeout(r, 300));
  const sent = await js(ws, function() {
    const ta = document.querySelector('textarea');
    ta.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', keyCode:13, which:13, bubbles:true, cancelable:true}));
    return 'enter';
  });
  console.log('Send: Enter');

  // Poll for response
  for (let t = 2; t <= 30; t += 2) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await js(ws, function() {
      try {
        const msgs = document.querySelectorAll('[class*="message"]');
        const all = [];
        msgs.forEach(m => { const t = m.innerText || ''; if (t.trim()) all.push(t.trim().substring(0,200)); });
        return {count: all.length, texts: all};
      } catch(e) { return {error: e.message}; }
    });
    const val = check.result.value;
    if (!val || val.error) { console.log(`t=${t}s ERROR`); continue; }
    console.log(`t=${t}s msgs:${val.count}`);
    val.texts.forEach((tx,i) => console.log(`  [${i}] ${tx.substring(0,100)}`));
    if (val.count >= 3) { console.log(`\n✅ Copilot responded`); break; }
    // Also check main element
    if (t >= 15 && val.count <= 1) {
      const altCheck = await js(ws, function() {
        const main = document.querySelector('main');
        return main ? main.innerText.substring(0,300) : 'no-main';
      });
      console.log(`  main-text: ${(altCheck.result.value||'').substring(0,150)}`);
    }
  }
}

main().catch(e => console.error(e));
