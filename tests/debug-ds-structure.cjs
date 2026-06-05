// Scan DeepSeek body structure for message containers
const WS=require('ws'),http=require('http');
const J=JSON.stringify;
const t=()=>new Promise(o=>http.get('http://127.0.0.1:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>o(JSON.parse(d)))}));
const sl=m=>new Promise(r=>setTimeout(r,m));
function ev(id,e){return new Promise(async(ok)=>{
  const ts=await t();const tab=ts.find(x=>x.id===id);
  if(!tab)return ok('no tab');
  const w=new WS(tab.webSocketDebuggerUrl);
  w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:e,awaitPromise:false}})));
  w.on('message',d=>{const r=JSON.parse(d+'');if(r.id===1){w.close();const v=r.result.result;ok(v.value!==undefined?v.value:(v.description||null))}});
  setTimeout(()=>{try{w.close()}catch(e){};ok('TO')},8000);
})}

(async()=>{
  const ts=await t();
  const d=ts.find(x=>x.url.includes('deepseek.com'));
  console.log('URL:',d.url.slice(0,100));
  
  // Get body HTML structure (tags + classes, first 3000 chars)
  const html=await ev(d.id,'(function(){function walk(el,d){if(!el||d>3)return"";var s="";var c=el.className?el.className.toString().slice(0,60):"";var name=el.tagName||"";s+="  ".repeat(d)+"<"+name+(c?" class=\\""+c+"\\"":"")+">";if(el.children&&el.children.length){s+="\\n";for(var i=0;i<Math.min(el.children.length,5);i++)s+=walk(el.children[i],d+1)}return s}return walk(document.body,0).slice(0,5000)})()');
  console.log('Body structure:');
  console.log(html);
  
  // Also check if there's any main content area
  const main=await ev(d.id,'document.querySelector("main")&&document.querySelector("main").innerHTML.slice(0,2000)');
  console.log('\nMain content:',main.slice(0,1000));
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
