// Debug: reproduce Gemini expression with real message
const http=require('http');
const C='http://127.0.0.1:9222/json';
const tabs=()=>new Promise(o=>http.get(C,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const WS=require('ws');
const J=JSON.stringify;

async function testExpr(){
  const ts=await tabs();
  const gt=ts.find(t=>t.url.includes('gemini.google.com'));
  if(!gt){console.log('Gemini tab missing');process.exit(1);}
  
  // Simulate real message from v10 step 2
  const msg='Đây là vòng phản biện AI. Model trước (ChatGPT) vừa nói:\n\n"[ChatGPT] Tôi phản đối việc giao quyền quản lý AI hoàn toàn cho một bên. Chính phủ cần đặt ra tiêu chuẩn tối thiểu, cộng đồng mã nguồn mở thúc đẩy đổi mới nhanh hơn."\n\nHãy đóng vai phản biện (rebuttal): phân tích lập luận của model trước, chỉ ra điểm yếu hoặc bổ sung góc nhìn đối lập. Trả lời ngắn gọn trong 2-3 câu.';
  
  console.log('MSG length:', msg.length);
  
  // Test: evaluate a simple expression to check connection
  const expr1='(function(){return 1+1})()';
  const w1=new WS(gt.webSocketDebuggerUrl);
  w1.on('open',()=>{
    w1.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr1,awaitPromise:false}}));
  });
  w1.on('message',d=>{
    const r=JSON.parse(d+'');
    if(r.id===1){
      console.log('Simple expr:', r.result.result.value);
      w1.close();
    }
  });
  await new Promise(r=>setTimeout(r,2000));
  
  // Test: expression with full message similar to v10's Gemini type expression
  const expr2='(function(){var e=document.querySelector(\'[contenteditable="true"]\');if(!e)return"no-input";e.innerText='+J(msg)+';e.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true}))})()';
  
  console.log('EXPR2 length:', expr2.length);
  console.log('EXPR2 first 200:', expr2.slice(0,200));
  
  const w2=new WS(gt.webSocketDebuggerUrl);
  let result;
  w2.on('open',()=>{
    w2.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expr2,awaitPromise:false}}));
  });
  w2.on('message',d=>{
    const r=JSON.parse(d+'');
    if(r.id===1){
      result=r;
      w2.close();
    }
  });
  w2.on('error',e=>{console.log('WS error:', e.message);});
  
  await new Promise(r=>setTimeout(r,3000));
  
  if(result){
    console.log('Result:', result.result.result.value||result.result.exceptionDetails?.text);
    if(result.result.exceptionDetails)console.log('Exception:', JSON.stringify(result.result.exceptionDetails));
  } else {
    console.log('No result (timeout)');
  }
}

testExpr().catch(console.error);
