const ws_pkg = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222';
function f(p) { return new Promise((r,rej) => http.get(CDP+p,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',rej)); }
function wc(ws,id,m,p) { return new Promise(r=>{ws.send(JSON.stringify({id,method:m,params:p}));function o(d){try{const x=JSON.parse(d.toString());if(x.id==id){ws.removeListener('message',o);r(x)}}catch(e){}}ws.on('message',o)}); }

(async () => {
  const pages = await f('/json/list');
  const cPage = pages.find(p => p.url.indexOf('chatgpt.com') >= 0);
  const gPage = pages.find(p => p.url.indexOf('gemini.google.com') >= 0);

  const cws = new ws_pkg.WebSocket(cPage.webSocketDebuggerUrl);
  const gws = new ws_pkg.WebSocket(gPage.webSocketDebuggerUrl);
  await new Promise(r => cws.on('open',r));
  await new Promise(r => gws.on('open',r));

  // === Extract Gemini response with raw HTML parsing ===
  console.log('=== Extract Gemini in-progress response ===');
  let r = await wc(gws, 1, 'Runtime.evaluate', {expression:
    `(() => {
      const mr = document.querySelector('model-response');
      if (!mr) return JSON.stringify({error:'NO_MR'});
      
      // Try to find the actual message content via multiple paths
      const html = mr.innerHTML;
      
      // Direct regex extraction from raw HTML
      const match = html.match(/<p[^>]*class="[^"]*pending[^"]*"[^>]*>\\s*<span[^>]*class="[^"]*pending[^"]*"[^>]*>([^<]*)<\\/span>/);
      
      // Also try getting innerText of the message-content element directly  
      const mc = mr.querySelector('message-content');
      const mcText = mc ? mc.innerText : 'NO_MC';
      const mcTextContent = mc ? mc.textContent : 'NO_MC';
      
      // Try structured-content-container
      const scc = mr.querySelector('structured-content-container');
      
      // Check for data-path-to-node
      const dataNode = mr.querySelector('[data-path-to-node="0"]');
      const dataNodeText = dataNode ? dataNode.innerText : 'NONE';
      const dataNodeTextContent = dataNode ? dataNode.textContent : 'NONE';
      
      // Check the span directly
      const pendingSpans = mr.querySelectorAll('.pending');
      const spanTexts = Array.from(pendingSpans).map(s => s.innerText + ' | tc:' + s.textContent);
      
      // Check if generate button is gone meaning response is complete
      const genBtn = Array.from(document.querySelectorAll('button')).find(b => 
        (b.getAttribute('aria-label')||'').includes('Ng\u1eebng') || (b.getAttribute('aria-label')||'').includes('Stop')
      );
      
      return JSON.stringify({
        htmlLen: html.length,
        regexMatch: match ? match[1] : 'NO_MATCH',
        mcText: mcText.slice(0,200),
        mcTC: mcTextContent.slice(0,200),
        dataNodeText: dataNodeText.slice(0,200),
        dataNodeTC: dataNodeTextContent.slice(0,200),
        spanTexts: spanTexts.slice(0,5).join(' || '),
        isGenerating: !!genBtn,
        genBtnLabel: genBtn ? genBtn.getAttribute('aria-label') : 'none',
        ariaBusy: mr.querySelector('[class*="markdown-main-panel"]')?.getAttribute('aria-busy')
      });
    })()`,
  returnByValue: true});
  console.log('GEMINI_EXTRACT:', r.result?.result?.value);

  gws.close();
  cws.close();
})().catch(e => console.error('ERR:', e.message));
