// Claude solo test v2 — find correct send button + robust response
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
  console.log(`Tab: ${tab.id.substring(0,8)} | ${tab.title}\n`);

  // Find ALL buttons near textarea, sorted by distance
  const btns = await js(ws, function() {
    const ta = document.querySelector('textarea');
    if (!ta) return {error:'no textarea'};
    const taRect = ta.getBoundingClientRect();
    const b = [];
    document.querySelectorAll('button').forEach(btn => {
      const r = btn.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return; // hidden
      const dist = Math.hypot(r.x + r.width/2 - taRect.x - taRect.width/2, 
                               r.y + r.height/2 - taRect.y - taRect.height/2);
      const hasSvg = !!btn.querySelector('svg');
      const aria = btn.getAttribute('aria-label') || '';
      const txt = (btn.innerText || '').trim().substring(0,30);
      b.push({txt, aria:aria.substring(0,30), hasSvg, dist:Math.round(dist), 
              cls:(btn.className||'').substring(0,35), x:r.x, y:r.y});
    });
    b.sort((a,b) => a.dist - b.dist);
    return b.slice(0,8);
  });
  console.log('Buttons near textarea:', JSON.stringify(btns, null, 2));

  // Try: find submit button or nearest button with SVG
  const targetBtn = await js(ws, function() {
    const form = document.querySelector('textarea').closest('form');
    if (!form) return {found:'no-form'};
    // ChatGPT-style: button[type="submit"] inside form
    const submit = form.querySelector('button[type="submit"]');
    if (submit) return {found:'submit', disabled:submit.disabled, cls:submit.className.substring(0,40)};
    
    // Find nearest button with SVG (send icon)
    const ta = document.querySelector('textarea');
    const taRect = ta.getBoundingClientRect();
    let best = null, bestDist = Infinity;
    form.querySelectorAll('button').forEach(b => {
      if (!b.querySelector('svg')) return;
      const r = b.getBoundingClientRect();
      const d = Math.hypot(r.x - taRect.x, r.y - taRect.y);
      if (d < bestDist) { bestDist = d; best = b; }
    });
    return best ? {found:'svg-btn', disabled:best.disabled} : {found:'none'};
  });
  console.log('Target:', JSON.stringify(targetBtn));

  // Clear + type
  console.log('\n--- SENDING ---');
  await js(ws, function() {
    const ta = document.querySelector('textarea');
    ta.value = '';
    ta.dispatchEvent(new Event('input', {bubbles:true}));
  });
  await new Promise(r => setTimeout(r, 300));
  await js(ws, function() {
    const ta = document.querySelector('textarea');
    ta.value = '1+1 bang may? Tra loi ngan gon.';
    ta.dispatchEvent(new Event('input', {bubbles:true}));
    ta.dispatchEvent(new Event('change', {bubbles:true}));
    return 'typed';
  });

  // Click submit
  await new Promise(r => setTimeout(r, 300));
  const sent = await js(ws, function() {
    const ta = document.querySelector('textarea');
    // Try submit button first
    const submit = ta.closest('form').querySelector('button[type="submit"]');
    if (submit && !submit.disabled) {
      submit.click(); return 'submitted';
    }
    // Try Enter
    ta.focus();
    ta.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', keyCode:13, bubbles:true}));
    return 'enter';
  });
  console.log('Send:', sent.result.value);

  // Poll for response
  console.log('\n--- POLLING ---');
  for (let t = 2; t <= 40; t += 2) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await js(ws, function() {
      try {
        const msgs = document.querySelectorAll('[class*="message"]');
        const all = [];
        msgs.forEach(m => { const t = m.innerText || ''; if (t.trim()) all.push(t.trim().substring(0,150)); });
        return {count: all.length, texts: all};
      } catch(e) { return {error: e.message}; }
    });
    const val = check.result.value;
    if (!val || val.error) { console.log(`t=${t}s ERROR:`, val); continue; }
    console.log(`t=${t}s msgs:${val.count}`);
    val.texts.forEach((tx,i) => console.log(`  [${i}] ${tx.substring(0,100)}`));
    if (val.count >= 3) {
      console.log(`\n✅ Claude responded`);
      break;
    }
  }
}

main().catch(e => console.error(e));
