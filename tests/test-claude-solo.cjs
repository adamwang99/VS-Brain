// Claude solo test — gửi tin + đọc response qua CDP
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
  const tab = tabs.find(t => t.url.includes('chatbotapp.ai'));
  if (!tab) { console.log('Claude tab not found'); return; }
  const ws = tab.webSocketDebuggerUrl;
  console.log(`Tab: ${tab.id.substring(0,8)} | ${tab.title}`);

  // Find textarea + send button
  const info = await js(ws, function() {
    const ta = document.querySelector('textarea');
    // Find the closest button to the textarea — the send button
    let sendBtn = null;
    let minDist = Infinity;
    if (ta) {
      const taRect = ta.getBoundingClientRect();
      const buttons = ta.closest('form').querySelectorAll('button');
      buttons.forEach(b => {
        const r = b.getBoundingClientRect();
        const dist = Math.abs(r.x + r.width/2 - (taRect.x + taRect.width/2)) +
                     Math.abs(r.y + r.height/2 - (taRect.y + taRect.height/2));
        if (dist < minDist) { minDist = dist; sendBtn = b; }
      });
    }
    return {
      textarea: ta ? {ph:ta.placeholder, rows:ta.rows, val:ta.value.substring(0,50), h:ta.getBoundingClientRect().height} : null,
      sendBtn: sendBtn ? {
        txt: sendBtn.innerText.substring(0,20),
        cls: sendBtn.className.substring(0,40),
        tag: sendBtn.tagName,
        disabled: sendBtn.disabled
      } : null,
      messages: document.querySelectorAll('[class*="message"]').length
    };
  });
  console.log('State before:', JSON.stringify(info, null, 2));

  // Type message
  console.log('\n--- SENDING ---');
  await js(ws, function() {
    const ta = document.querySelector('textarea');
    if (!ta) return 'no-textarea';
    ta.value = '1+1=mấy? Chỉ trả lời ngắn gọn.';
    ta.dispatchEvent(new Event('input', {bubbles:true}));
    ta.dispatchEvent(new Event('change', {bubbles:true}));
    return 'typed';
  });
  console.log('Typed');

  // Click send
  await new Promise(r => setTimeout(r, 500));
  const sent = await js(ws, function() {
    const ta = document.querySelector('textarea');
    const btn = ta.closest('form').querySelector('button[type="submit"]');
    if (btn) { btn.click(); return 'clicked-submit'; }
    // fallback: try Enter
    ta.focus();
    ta.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
    return 'enter';
  });
  console.log('Send:', sent);

  // Wait for response
  for (let t = 3; t <= 30; t += 3) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await js(ws, function() {
      const msgs = document.querySelectorAll('[class*="message"]');
      const texts = [];
      msgs.forEach(m => texts.push(m.innerText.substring(0,120)));
      return {count: msgs.length, texts: texts.slice(-5)};
    });
    console.log(`t=${t}s msgs:${check.count}`);
    check.texts.forEach(tx => console.log(`  ${tx}`));
    if (check.count >= 2) {
      const answer = check.texts.find(t => t !== check.texts[0] && t.length > 10);
      if (answer) {
        console.log(`\n✅ Claude answered: "${answer}"`);
        break;
      }
    }
  }
}

main().catch(e => console.error(e));
