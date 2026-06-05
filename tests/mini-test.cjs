// Minimal CDP test
const WebSocket = require('ws');
const http = require('http');
const CDP = 'http://127.0.0.1:9222/json';

http.get(CDP, res => {
  let d='';
  res.on('data',c=>d+=c);
  res.on('end',()=>{
    const tabs=JSON.parse(d);
    const t=tabs.find(t=>t.url.includes('chatgpt.com'));
    if(!t){console.log('no tab');return;}
    console.log('Tab:', t.url);
    console.log('WS:', t.webSocketDebuggerUrl.slice(0,60));
    
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.on('open',()=>{
      console.log('WS OPEN');
      ws.send(JSON.stringify({id:1, method:'Runtime.evaluate', params:{expression:'document.title',awaitPromise:false}}));
    });
    ws.on('message',d=>{
      const r=JSON.parse(d.toString());
      if(r.id===1){
        console.log('RESULT:', JSON.stringify(r.result));
        ws.close();
        process.exit(0);
      }
    });
    ws.on('error',e=>{console.log('WS ERR:',e);process.exit(1);});
    setTimeout(()=>{console.log('TIMEOUT');process.exit(1);},10000);
  });
});
