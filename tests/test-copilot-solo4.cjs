// Copilot solo v4 — CDP direct, no eval wrapper confusion
const WebSocket = require('ws');
const http = require('http');

function makeWS(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}

function cdp(ws, method, params) {
  return new Promise((res, rej) => {
    const id = Date.now();
    const cb = (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) { ws.removeListener('message', cb); res(m); }
    };
    ws.on('message', cb);
    ws.on('error', rej);
    ws.send(JSON.stringify({id, method, params}));
  });
}

async function js(ws, code) {
  const r = await cdp(ws, 'Runtime.evaluate', {
    expression: `(${code})()`,
    returnByValue: true
  });
  return r.result.value;
}

async function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const tabs = await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d)));
  }));
  const tab = tabs.find(t => t.url.includes('copilot.microsoft.com'));
  if (!tab) { console.log('Copilot tab not found'); return; }
  
  const ws = await makeWS(tab.webSocketDebuggerUrl);
  console.log(`Tab: ${tab.id.substring(0,8)}`);

  // Check login + textarea
  const taInfo = await js(ws, `function(){
    const ta = document.querySelector('textarea');
    if(!ta) return 'no-textarea';
    const r = ta.getBoundingClientRect();
    return {x:r.x, y:r.y, w:r.width, h:r.height, ph:ta.placeholder, rows:ta.rows};
  }`);
  console.log('Textarea:', JSON.stringify(taInfo));
  
  if (typeof taInfo === 'string') { console.log(taInfo); return; }

  // Type text
  await cdp(ws, 'Runtime.evaluate', {expression: `(()=>{
    const ta=document.querySelector('textarea');
    ta.focus(); ta.value='1+1 bang may? Chi tra loi so.'; 
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    ta.dispatchEvent(new Event('change',{bubbles:true}));
  })()`, returnByValue: true});
  console.log('Typed');
  await waitMs(500);

  // Check textarea value
  const val = await js(ws, `function(){
    return document.querySelector('textarea').value;
  }`);
  console.log('Textarea value:', val);

  // Try CDP Input.insertText (native)
  console.log('Inserting text via Input.insertText...');
  await cdp(ws, 'Input.insertText', {text: '\r'});  // carriage return

  await waitMs(1000);

  // Check if textarea cleared
  const check1 = await js(ws, `function(){
    return document.querySelector('textarea').value;
  }`);
  console.log('After Enter, textarea:', check1);

  // If not sent, try typing text directly via CDP Input
  if (check1 && check1.length > 0) {
    console.log('Text not sent. Trying Input.dispatchKeyEvent...');
    await cdp(ws, 'Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', keyCode:13, code:'Enter', windowsVirtualKeyCode:13, nativeVirtualKeyCode:13, text:'\r'});
    await waitMs(100);
    await cdp(ws, 'Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', keyCode:13, code:'Enter'});
    await waitMs(1000);
    
    const check2 = await js(ws, `function(){ return document.querySelector('textarea').value; }`);
    console.log('After 2nd try:', check2);
  }

  // Poll for new messages
  for (let t = 2; t <= 30; t += 2) {
    await waitMs(2000);
    const allMsgs = await js(ws, `function(){
      try {
        const txs = [];
        document.querySelectorAll('[class*="message"]').forEach(m => {
          const t = m.innerText || '';
          if(t.trim()) txs.push(t.trim().substring(0,150));
        });
        return {count: txs.length, texts: txs.slice(-3), ta: (document.querySelector('textarea')||{}).value || ''};
      } catch(e) { return {error: e.message}; }
    }`);
    console.log(`t=${t}s msgs:${allMsgs.count} ta:"${(allMsgs.ta||'').substring(0,30)}"`);
    allMsgs.texts?.forEach((tx,i) => console.log(`  [${i}] ${tx.substring(0,80)}`));
    if (allMsgs.ta === '' || allMsgs.count > 5) break;
  }

  ws.close();
}

main().catch(e => console.error(e));
