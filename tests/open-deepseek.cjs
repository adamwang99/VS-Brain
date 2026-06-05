// Open new tab for DeepSeek
const WS=require('ws'), http=require('http');
http.get('http://127.0.0.1:9222/json', r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{
  const ws=new WS(JSON.parse(d)[0].webSocketDebuggerUrl);
  ws.on('open',()=>ws.send(JSON.stringify({id:1,method:'Target.createTarget',params:{url:'https://chat.deepseek.com'}})));
  ws.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){console.log('DeepSeek tab:',r.result.targetId);ws.close();process.exit(0)}});
  setTimeout(()=>process.exit(1),10000);
})});
