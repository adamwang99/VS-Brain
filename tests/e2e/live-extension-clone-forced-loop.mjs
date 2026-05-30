import puppeteer from 'puppeteer';

const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';
const userDataDir = process.env.USER_DATA_DIR || '/home/phuong/.cache/vsbrain-default-only-clone';
const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_LOOP_20260529';
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
  if(!extensionId) throw new Error('extension worker missing');

  const chatgpt=await browser.newPage(); await chatgpt.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  const gemini=await browser.newPage(); await gemini.goto('https://gemini.google.com/app',{waitUntil:'domcontentloaded'});
  await sleep(8000);
  const chatSel=await fillAndSend(chatgpt,seed);
  const gemSel=await fillAndSend(gemini,seed);
  const chatHit=await waitBodyHas(chatgpt,'TEST_LOOP_20260529');
  const gemHit=await waitBodyHas(gemini,'TEST_LOOP_20260529');

  const popup=await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`,{waitUntil:'domcontentloaded'});
  await sleep(3000);
  await popup.click('#refreshTabsBtn');
  await sleep(4000);
  const before=await popup.evaluate(()=>({
    sourceOptions:[...document.querySelectorAll('#sourceTab option')].map(o=>({value:o.value,text:o.textContent})),
    sourceVal:document.querySelector('#sourceTab')?.value||'',
    targetVal:document.querySelector('#targetTab')?.value||'',
    startLoopDisabled:!!document.querySelector('#startLoopBtn')?.disabled,
    log:document.querySelector('#log')?.textContent||'',
    status:document.querySelector('#status')?.textContent||''
  }));
  await popup.evaluate(()=>{ const a=document.querySelector('#autoSendToggle'); if(a) a.checked=true; document.querySelector('#startLoopBtn')?.click(); });
  await sleep(8000);
  const after=await popup.evaluate(()=>({
    startLoopDisabled:!!document.querySelector('#startLoopBtn')?.disabled,
    log:document.querySelector('#log')?.textContent||'',
    status:document.querySelector('#status')?.textContent||''
  }));
  const result={extensionId,chatSel,gemSel,chatHit,gemHit,before,after};
  console.log(JSON.stringify(result,null,2));
  const fs = await import('node:fs');
  fs.writeFileSync('/home/phuong/.openclaw/workspace/projects/crosscritic/tmp/live-extension-clone-forced-loop-result.json', JSON.stringify(result,null,2));
} finally { await browser.close(); }
