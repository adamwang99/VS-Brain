// Copilot solo v3 — dùng CDP Input.dispatchKeyEvent (native) thay vì JS KeyboardEvent
const WebSocket = require('ws');
const http = require('http');

async function cdpCall(wsUrl, method, params) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    let mid = 1;
    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id === mid) { ws.close(); res(m.result); }
    });
    ws.on('open', () => ws.send(JSON.stringify({id: mid, method, params})));
    ws.on('error', rej);
  });
}

async function evalJS(wsUrl, code) {
  const result = await cdpCall(wsUrl, 'Runtime.evaluate', {
    expression: `(${code.toString()})()`,
    returnByValue: true
  });
  return result && result.value;
}

async function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const tabs = await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d)));
  }));
  const tab = tabs.find(t => t.url.includes('copilot.microsoft.com'));
  if (!tab) { console.log('Copilot tab not found'); return; }
  const wsUrl = tab.webSocketDebuggerUrl;
  console.log(`Tab: ${tab.id.substring(0,8)} | ${(tab.title||'').substring(0,50)}`);
  
  // Get textarea element info
  const taInfo = await evalJS(wsUrl, function() {
    const ta = document.querySelector('textarea');
    if (!ta) return null;
    const r = ta.getBoundingClientRect();
    return {x: r.x, y: r.y, w: r.width, h: r.height, ph: ta.placeholder};
  });
  console.log('Textarea:', JSON.stringify(taInfo));

  // Step 1: Focus and type via CDP Input.insertText
  await cdpCall(wsUrl, 'Runtime.evaluate', {
    expression: `(()=>{
      const ta=document.querySelector('textarea');
      ta.focus();
      ta.value='1+1 bang may? Tra loi.';
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()`,
    returnByValue: true
  });
  await waitMs(500);

  // Step 2: Native Enter via CDP Input.dispatchKeyEvent
  console.log('Sending native Enter...');
  await cdpCall(wsUrl, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Enter',
    keyCode: 13,
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    text: '\r',
    unmodifiedText: '\r',
    autoRepeat: false,
    isKeypad: false,
    isSystemKey: false
  });
  await waitMs(50);
  await cdpCall(wsUrl, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    keyCode: 13,
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  });
  console.log('Enter sent');

  // Poll for new messages
  for (let t = 2; t <= 30; t += 2) {
    await waitMs(2000);
    const check = await evalJS(wsUrl, function() {
      try {
        const all = [];
        document.querySelectorAll('[class*="message"]').forEach(m => {
          const t = m.innerText || '';
          if (t.trim()) all.push(t.trim().substring(0,200));
        });
        const taVal = document.querySelector('textarea')?.value || '';
        return {count: all.length, texts: all, ta: taVal.substring(0,50)};
      } catch(e) { return {error: e.message}; }
    });
    const val = check;
    if (!val || val.error) { console.log(`t=${t}s ERROR`); continue; }
    console.log(`t=${t}s msgs:${val.count} ta:"${(val.ta||'').substring(0,30)}"`);
    val.texts.slice(-3).forEach((tx,i) => console.log(`  [${i}] ${tx.substring(0,80)}`));
    
    // Check if textarea cleared = message was sent
    if (val.ta && val.ta.trim() === '') {
      console.log('\n✅ Message sent (textarea cleared)!');
      val.texts.slice(-2).forEach(tx => console.log(`  ${tx.substring(0,120)}`));
      break;
    }
  }
}

main().catch(e => console.error(e));
