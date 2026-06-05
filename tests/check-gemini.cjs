const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(CDP + path, res => { let d=''; res.on('data', c => d+=c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}
function wsCmd(ws, id, method, params={}) {
  return new Promise(resolve => {
    ws.send(JSON.stringify({id,method,params}));
    function onMsg(data) { try { const r = JSON.parse(data.toString()); if(r.id===id) { ws.removeListener('message',onMsg); resolve(r); } } catch(e) {} }
    ws.on('message', onMsg);
  });
}

async function main() {
  const pages = await fetchJSON('/json/list');
  const gemini = pages.find(p => p.url?.includes('gemini.google.com'));
  const gws = new ws_pkg.WebSocket(gemini.webSocketDebuggerUrl);
  await new Promise((r,rej) => { gws.on('open',r); gws.on('error',rej); setTimeout(()=>rej(new Error('t')),5000); });

  // 1. Check exact Gemini state
  const r1 = await wsCmd(gws, 1, 'Runtime.evaluate', {
    expression: `JSON.stringify({url:location.href, title:document.title, inputEditable: document.querySelectorAll('[contenteditable="true"]').length, responses: document.querySelectorAll('model-response').length, bodyHead: document.body.innerText.replace(/\\n{3,}/g,'\\n\\n').slice(0,600)})`,
    returnByValue: true
  });
  console.log('STATE:', r1.result?.result?.value);

  // 2. Try to find the input prompt area and type directly
  const r2 = await wsCmd(gws, 2, 'Runtime.evaluate', {
    expression: `(() => {
      const inputs = document.querySelectorAll('[contenteditable="true"], textarea');
      let result = [];
      for (const el of inputs) {
        if (el.offsetParent !== null || el.checkVisibility) {
          result.push({tag: el.tagName, id: el.id, role: el.getAttribute('role'), placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-label') || '', textLength: (el.innerText||el.value||'').length});
        }
      }
      return JSON.stringify(result);
    })()`,
    returnByValue: true
  });
  console.log('INPUTS:', r2.result?.result?.value);

  // 3. Check for any generating/sending indicator
  const r3 = await wsCmd(gws, 3, 'Runtime.evaluate', {
    expression: `(() => {
      const btns = document.querySelectorAll('button');
      let result = [];
      for (const b of btns) {
        if (b.offsetParent !== null && (b.querySelector('svg') || b.getAttribute('aria-label') || b.textContent.length < 20)) {
          result.push({text: (b.textContent||'').trim().slice(0,30), label: (b.getAttribute('aria-label')||'').slice(0,30), disabled: b.disabled});
        }
      }
      return JSON.stringify(result);
    })()`,
    returnByValue: true
  });
  console.log('BUTTONS:', r3.result?.result?.value);

  gws.close();
}
main().catch(e => console.error(e.message));
