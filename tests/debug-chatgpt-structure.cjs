// Debug ChatGPT current structure — find editor + send
const WebSocket = require('ws');
const http = require('http');

async function main() {
  const tabs = await new Promise(r => http.get('http://127.0.0.1:9222/json/list', res => {
    let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d)));
  }));
  const gpt = tabs.find(t => t.url.includes('chatgpt.com'));
  if (!gpt) { console.log('no chatgpt'); return; }

  const ws = new WebSocket(gpt.webSocketDebuggerUrl);
  let mid = 1;
  ws.on('message', d => { const m = JSON.parse(d.toString());
    if (m.id === mid) {
      console.log(JSON.stringify(m.result, null, 2));
      if (mid >= 4) ws.close(); else runNext();
    }
  });
  ws.on('open', runNext);
  function runNext() { mid++;
    const code = [
      // 1. Find editor
      `(()=>{
        const el = document.querySelector('#prompt-textarea') ||
                    document.querySelector('[contenteditable="true"]');
        if (!el) return 'no-editor';
        const children = el.querySelectorAll('*');
        return {
          tag: el.tagName,
          id: el.id,
          class: (el.className||'').substring(0,40),
          children: children.length,
          contenteditable: el.getAttribute('contenteditable'),
          placeholder: el.getAttribute('data-placeholder') || '',
          text: (el.innerText||'').substring(0,40),
          rect: el.getBoundingClientRect().height
        };
      })()`,
      // 2. Find send buttons
      `(()=>{
        const btns = [];
        document.querySelectorAll('button').forEach(b => {
          const dt = b.getAttribute('data-testid') || '';
          const aria = b.getAttribute('aria-label') || '';
          if (dt || aria) btns.push({
            dt: dt.substring(0,30),
            aria: aria.substring(0,30),
            txt: (b.innerText||'').trim().substring(0,15),
            disabled: b.disabled,
            hidden: b.hidden
          });
        });
        return btns;
      })()`,
      // 3. Type text then check for send button
      `(()=>{
        const el = document.querySelector('#prompt-textarea') ||
                    document.querySelector('[contenteditable="true"]');
        if (!el) return 'no-editor';
        el.focus();
        el.innerText = 'Xin chao, test';
        el.dispatchEvent(new Event('input', {bubbles:true}));
        return 'typed';
      })()`,
    ][mid-2];
    ws.send(JSON.stringify({id: mid, method: 'Runtime.evaluate', params: {
      expression: code, returnByValue: true
    }}));
  }
}

main().catch(e => console.error(e));
