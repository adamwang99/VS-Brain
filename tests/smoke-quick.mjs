import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/4380480303914CE25B25AFB48B8B94A4');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: {
      expression: `JSON.stringify({
        tabs: Array.from(document.querySelectorAll("#sourceTab option")).map(o=>({v:o.value,t:o.textContent})),
        status: document.querySelector("#status")?.textContent,
        log: (document.querySelector("#log")?.textContent || "").slice(-400)
      })`
    }
  }));
});

ws.on('message', data => {
  try {
    const r = JSON.parse(data.toString());
    if (r.id === 1) console.log(r.result?.result?.value);
  } catch(e) {}
  ws.close();
});

ws.on('error', e => console.log('WS Error:', e.message));

setTimeout(() => { ws.close(); process.exit(0); }, 5000);
