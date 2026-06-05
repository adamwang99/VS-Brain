import WebSocket from 'ws';
import http from 'http';

// Fetch WS URLs
http.get('http://127.0.0.1:9222/json/list', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const checks = [];
    for (const p of pages) {
      const url = p.url || '';
      if (url.includes('chatgpt.com')) checks.push({ label: 'ChatGPT', ws: p.webSocketDebuggerUrl });
      if (url.includes('gemini.google.com')) checks.push({ label: 'Gemini', ws: p.webSocketDebuggerUrl });
    }
    
    console.log('Checks:', checks.length);
    
    checks.forEach(({ label, ws: wsUrl }) => {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: 1, method: "Runtime.evaluate",
          params: { expression: `document.body?.innerText?.slice(0,300) || 'no body'` }
        }));
      });
      let closed = false;
      ws.on('message', raw => {
        if (closed) return;
        try {
          const r = JSON.parse(raw.toString());
          if (r.id === 1) {
            const val = r.result?.result?.value || '';
            const loggedOut = val.includes('Log in') || val.includes('Sign in');
            console.log(`\n=== ${label} ===`);
            console.log('Logged out prompt:', loggedOut);
            console.log('Preview:', val.slice(0, 200).replace(/\n/g, ' | '));
          }
        } catch(e) {}
        ws.close();
        closed = true;
      });
      ws.on('error', e => {
        console.log(`${label} WS Error:`, e.message);
        if (!closed) { ws.close(); closed = true; }
      });
    });
    
    setTimeout(() => process.exit(0), 8000);
  });
});
