import puppeteer from 'puppeteer';

const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';
const userDataDir = process.env.USER_DATA_DIR || '/home/phuong/.cache/vsbrain-real-profile-clone';
const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_CLONE_FORCED_20260529';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function safeEval(page, fn, ...args){
  try { return await page.evaluate(fn, ...args); }
  catch(err){ const msg=String(err?.message||err||''); if(/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null; throw err; }
}
async function fillAndSend(page, text){
  const selectors=['textarea','rich-textarea [contenteditable="true"]','[contenteditable="true"]','div[contenteditable="true"][role="textbox"]','div.ProseMirror'];
  for(const sel of selectors){
    const ok=await safeEval(page, async (selector,text)=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const el=document.querySelector(selector);
      if(!el) return false;
      el.focus(); el.click?.();
      if('value' in el){ el.value=text; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
      else { document.execCommand?.('selectAll',false); document.execCommand?.('insertText',false,text); el.textContent=text; el.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'})); }
      await sleep(500);
      const btn=[...document.querySelectorAll('button')].find(b=>{ const s=`${b.innerText||''} ${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''}`.toLowerCase(); const r=b.getBoundingClientRect?.(); return r&&r.width>0&&r.height>0&&!b.disabled&&/(send|gửi|submit|run|arrow)/i.test(s); });
      if(btn){ btn.click(); return true; }
      return false;
    }, sel, text);
    if(ok) return sel;
  }
  return null;
}
async function waitBodyHas(page, needle, timeout=45000){
  const start=Date.now();
  while(Date.now()-start<timeout){ const hit=await safeEval(page,n=>String(document.body?.innerText||'').includes(n),needle); if(hit) return true; await sleep(1000);} return false;
}
async function dump(page,label){
  return await safeEval(page, l=>({
    label:l,url:location.href,title:document.title,
    body:String(document.body?.innerText||'').slice(0,1200),
    hasInput:!!document.querySelector('textarea,[contenteditable="true"],[role="textbox"],div.ProseMirror'),
    turns:document.querySelectorAll('[data-message-author-role], [data-testid^="conversation-turn-"], user-query, model-response, message-content').length
  }),label);
}
const browser=await puppeteer.launch({
  headless:false,
  pipe:true,
  userDataDir,
  args:[
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--no-first-run',
    '--no-default-browser-check'
  ]
});
try{
  await sleep(7000);
  const targets=browser.targets().map(t=>({type:t.type(),url:t.url()}));
  const sw=targets.find(t=>t.type==='service_worker' && /background\.js$/.test(t.url));
  const extensionId=sw?sw.url.split('/')[2]:null;
  const chatgpt=await browser.newPage(); await chatgpt.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  const gemini=await browser.newPage(); await gemini.goto('https://gemini.google.com/app',{waitUntil:'domcontentloaded'});
  await sleep(8000);
  const chatSel=await fillAndSend(chatgpt,seed);
  const gemSel=await fillAndSend(gemini,seed);
  const chatHit=await waitBodyHas(chatgpt,'TEST_CLONE_FORCED_20260529');
  const gemHit=await waitBodyHas(gemini,'TEST_CLONE_FORCED_20260529');
  let popupState=null;
  if(extensionId){
    const popup=await browser.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`,{waitUntil:'domcontentloaded'}).catch(()=>{});
    await sleep(3000);
    popupState=await safeEval(popup,()=>({
      href:location.href,title:document.title,
      hasRefresh:!!document.querySelector('#refreshTabsBtn'),
      hasStart:!!document.querySelector('#startLoopBtn'),
      log:document.querySelector('#log')?.textContent||'',
      status:document.querySelector('#status')?.textContent||''
    }));
  }
  console.log(JSON.stringify({targets,extensionId,chatSel,gemSel,chatHit,gemHit,chatDump:await dump(chatgpt,'chatgpt'),gemDump:await dump(gemini,'gemini'),popupState},null,2));
} finally { await browser.close(); }
