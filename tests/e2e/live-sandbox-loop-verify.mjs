import puppeteer from 'puppeteer';

const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';
const userDataDir = '/home/phuong/.cache/crosscritic-live-profile';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function safeEval(page, fn, ...args){
  try { return await page.evaluate(fn, ...args); }
  catch(err){ const msg=String(err?.message||err||''); if(/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null; throw err; }
}
async function fillAndSend(page, text){
  const selectors=['textarea','[contenteditable="true"]','div[contenteditable="true"][role="textbox"]','div.ProseMirror'];
  for(const sel of selectors){
    const ok=await safeEval(page, async (selector,text)=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const el=document.querySelector(selector);
      if(!el) return false;
      el.focus(); el.click?.();
      if('value' in el){ el.value=text; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
      else { document.execCommand?.('selectAll',false); document.execCommand?.('insertText',false,text); el.textContent=text; el.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'})); }
      await sleep(500);
      const btn=[...document.querySelectorAll('button')].find(b=>{
        const s=`${b.innerText||''} ${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''}`.toLowerCase();
        const r=b.getBoundingClientRect?.();
        return r&&r.width>0&&r.height>0&&!b.disabled&&/(send|gửi|submit|arrow|send-button|run)/i.test(s);
      });
      if(btn){ btn.click(); return true; }
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
      el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));
      return true;
    }, sel, text);
    if(ok) return sel;
  }
  return null;
}
async function surface(page){
  return await safeEval(page,()=>({
    url:location.href,title:document.title,
    body:String(document.body?.innerText||'').slice(0,1000),
    hasInput:!!document.querySelector('textarea,[contenteditable="true"],div.ProseMirror,[role="textbox"]'),
    turns:document.querySelectorAll('[data-message-author-role], [data-testid^="conversation-turn-"], user-query, model-response, message-content').length,
    latest:String([...document.querySelectorAll('[data-message-author-role="assistant"], [data-testid^="conversation-turn-"], model-response, message-content')].slice(-1)[0]?.innerText||'').slice(0,300)
  }));
}
async function ensureSeed(page, provider){
  await page.bringToFront(); await sleep(4000);
  let s=await surface(page);
  if(s?.turns>0) return {ok:true,seeded:false,state:s};
  if(/log in|sign in|sign up for free|meet gemini/i.test(s?.body||'')) return {ok:false,reason:'LOGIN_OR_LANDING',state:s};
  const sent=await fillAndSend(page, `Reply with exactly 2 short bullet points. Provider=${provider}.`);
  if(!sent) return {ok:false,reason:'INPUT_NOT_FOUND',state:s};
  const start=Date.now();
  while(Date.now()-start<120000){ s=await surface(page); if(s?.turns>0) return {ok:true,seeded:true,state:s}; await sleep(1500); }
  return {ok:false,reason:'NO_RESPONSE_AFTER_SEED',state:s};
}
async function waitLog(popup,text,timeout=60000){
  const start=Date.now();
  while(Date.now()-start<timeout){ const log=await popup.$eval('#log',el=>el.textContent||''); if(log.includes(text)) return log; await sleep(500); }
  throw new Error('log timeout: '+text);
}
const browser=await puppeteer.launch({headless:false,pipe:true,userDataDir,enableExtensions:[extensionPath]});
try{
  const workerTarget=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().endsWith('background.js'),{timeout:30000});
  const worker=await workerTarget.worker();
  const extensionId=await worker.evaluate(()=>chrome.runtime.id);
  const chatgpt=await browser.newPage(); await chatgpt.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  const gemini=await browser.newPage(); await gemini.goto('https://gemini.google.com/app',{waitUntil:'domcontentloaded'});
  const chatState=await ensureSeed(chatgpt,'chatgpt');
  const geminiState=await ensureSeed(gemini,'gemini');
  const popup=await browser.newPage(); await popup.goto(`chrome-extension://${extensionId}/popup.html`,{waitUntil:'domcontentloaded'});
  await popup.waitForSelector('#refreshTabsBtn',{timeout:30000}).catch(async err=>{
    const dump=await safeEval(popup,()=>({title:document.title,url:location.href,body:String(document.body?.innerText||'').slice(0,2000),html:String(document.documentElement?.outerHTML||'').slice(0,4000)}));
    throw new Error(`popup_load_failed: ${JSON.stringify(dump)}`);
  });
  await popup.click('#refreshTabsBtn'); await waitLog(popup,'AI tabs scanned',30000);
  const before=await popup.evaluate(()=>({
    sourceOptions:[...document.querySelectorAll('#sourceTab option')].map(o=>({value:o.value,text:o.textContent})),
    sourceVal:document.querySelector('#sourceTab')?.value||'', targetVal:document.querySelector('#targetTab')?.value||'',
    disabled:!!document.querySelector('#startLoopBtn')?.disabled, log:document.querySelector('#log')?.textContent||''
  }));
  await popup.evaluate(()=>document.querySelector('#startLoopBtn')?.click());
  await waitLog(popup,'auto-loop started',60000);
  await sleep(35000);
  const after=await popup.evaluate(()=>({status:document.querySelector('#status')?.textContent||'',loopCounter:document.querySelector('#loopCounter')?.textContent||'',log:document.querySelector('#log')?.textContent||''}));
  try{await popup.evaluate(()=>document.querySelector('#stopLoopBtn')?.click())}catch{}
  console.log(JSON.stringify({extensionId,chatState,geminiState,before,after},null,2));
} finally { await browser.close(); }
