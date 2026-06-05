// Raw CDP output debugging
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
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.on('open',()=>{
      // Simple: 1+1
      ws.send(JSON.stringify({id:1, method:'Runtime.evaluate', params:{expression:'1+1',awaitPromise:false}}));
    });
    let results=[];
    ws.on('message',d=>{
      const r=JSON.parse(d.toString());
      results.push(r);
      if(r.id===1){
        console.log('FULL RAW:', JSON.stringify(r,null,2));
        // Now try JSON.stringify
        ws.send(JSON.stringify({id:2, method:'Runtime.evaluate', params:{expression:'JSON.stringify({a:1,b:[1,2,3]})',awaitPromise:false}}));
      }
      if(r.id===2){
        console.log('JSONSTRINGIFY RAW:', JSON.stringify(r,null,2));
        ws.close();
        process.exit(0);
      }
    });
    ws.on('error',e=>{console.log('WS ERR:',e);process.exit(1);});
    setTimeout(()=>{console.log('TIMEOUT');process.exit(1);},10000);
  });
});
