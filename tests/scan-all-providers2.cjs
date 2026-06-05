// Scan tất cả provider tabs - dùng direct eval
// Chạy: node scan-all-providers2.cjs
const WebSocket = require('ws');
const http = require('http');

const CDP_PORT = 9222;

async function js(url, code) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let mid = 1;
    ws.on('message', d => {
      const m = JSON.parse(d.toString());
      if (m.id === mid) { ws.close(); res(m.result); }
    });
    ws.on('open', () => {
      ws.send(JSON.stringify({id: mid, method: 'Runtime.evaluate', params: {
        expression: `(${code})`,
        returnByValue: true, awaitPromise: false
      }}));
    });
    ws.on('error', rej);
  });
}

async function main() {
  const tabs = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d)));
    });
  }).catch(e => { console.error('CDP error:', e.message); process.exit(1); });

  const pages = tabs.filter(t => t.type === 'page' && t.url.startsWith('http'));

  for (const t of pages) {
    const url = t.webSocketDebuggerUrl;
    console.log('\n' + '='.repeat(70));
    console.log(`${t.id.substring(0,8)} | ${(t.title||'').substring(0,60)}`);
    console.log(`  ${t.url.substring(0,120)}`);

    try {
      // Input fields
      const input = await js(url, `function(){ 
        const ce = document.querySelector('[contenteditable="true"]');
        const ta = document.querySelector('textarea');
        const inp = document.querySelector('input[type="text"]');
        const r = [];
        if(ce) r.push({type:'ce', ph:(ce.getAttribute('placeholder')||'').substring(0,30), txt:(ce.innerText||'').substring(0,60)});
        if(ta) r.push({type:'ta', ph:(ta.getAttribute('placeholder')||'').substring(0,30), rows:ta.rows, txt:(ta.value||'').substring(0,60)});
        if(inp) r.push({type:'inp', ph:(inp.getAttribute('placeholder')||'').substring(0,30)});
        if(!r.length) r.push('no-input-found');
        return r;
      }()`);
      console.log(`  Input: ${JSON.stringify(input)}`);

      // Send buttons
      const send = await js(url, `function(){
        const b=[];
        document.querySelectorAll('button,[role="button"],[type="submit"]').forEach(x=>{
          const t=(x.innerText||x.getAttribute('aria-label')||'').trim().toLowerCase().substring(0,40);
          const dt=x.getAttribute('data-testid')||'';
          const cl=(x.className||'').substring(0,40);
          if(t.includes('send')||t.includes('gửi')||t.includes('enter')||t.includes('arrow')||t.includes('→')||
             dt.includes('send')||dt.includes('submit')||cl.includes('send')||cl.includes('submit')||
             x.querySelector('svg')&&(t.includes('')&&x.tagName==='BUTTON'))
            b.push({text:t,'data-testid':dt,class:cl,tag:x.tagName});
        });
        return b.length?b:'no-send-btn';
      }()`);
      console.log(`  Send: ${JSON.stringify(send)}`);

      // Main content area (responses)
      const content = await js(url, `function(){
        const c=[];
        const sels=['[class*="message"]','[class*="chat-line"]','main','article','[data-testid*="conversation"]',
                    '[data-testid*="message"]','.prose','.markdown','[class*="response"]'];
        sels.forEach(s=>{
          const e=document.querySelector(s);
          if(e) c.push({sel:s,txt:(e.innerText||'').substring(0,80)});
        });
        return c.length?c.slice(0,5):'no-content-area';
      }()`);
      console.log(`  Content: ${JSON.stringify(content)}`);
    } catch(e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
}

main().catch(console.error);
