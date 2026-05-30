import puppeteer from 'puppeteer';

const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';
const userDataDir = process.env.USER_DATA_DIR || '/home/phuong/.cache/vsbrain-real-profile-clone';
const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_CHATGPT_GATE_20260529';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function safeEval(page, fn, ...args){
  try { return await page.evaluate(fn, ...args); }
  catch(err){ const msg=String(err?.message||err||''); if(/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null; throw err; }
}
async function snap(page,label){
  return await safeEval(page, l => ({
    label:l,
    url:location.href,
    title:document.title,
    body:String(document.body?.innerText||'').slice(0,1500),
    html:String(document.documentElement?.outerHTML||'').slice(0,2500),
    hasInput:!!document.querySelector('textarea,[contenteditable="true"],[role="textbox"],div.ProseMirror'),
    btns:[...document.querySelectorAll('button,a')].slice(0,20).map(x=>({text:String(x.innerText||'').slice(0,80),aria:x.getAttribute('aria-label'),href:x.getAttribute('href')}))
  }),label);
}
async function clickByText(page, patterns){
  return await safeEval(page, pats => {
    const els=[...document.querySelectorAll('button,a,div[role="button"]')];
    for(const el of els){
      const txt=`${el.innerText||''} ${el.getAttribute('aria-label')||''}`.toLowerCase();
      const r=el.getBoundingClientRect?.();
      if(!(r&&r.width>0&&r.height>0)) continue;
      if(pats.some(p=>txt.includes(p))){ el.click(); return {ok:true,text:txt.slice(0,120)}; }
    }
    return {ok:false};
  }, patterns.map(s=>s.toLowerCase()));
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
      const btn=[...document.querySelectorAll('button')].find(b=>{ const s=`${b.innerText||''} ${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''}`.toLowerCase(); const r=b.getBoundingClientRect?.(); return r&&r.width>0&&r.height>0&&!b.disabled&&/(send|gửi|submit|run|arrow)/i.test(s); });
      if(btn){ btn.click(); return true; }
      return false;
    }, sel, text);
    if(ok) return sel;
  }
  return null;
}
async function waitUsable(page, timeout=90000){
  const start=Date.now();
  let last=null;
  while(Date.now()-start<timeout){
    last=await snap(page,'poll');
    if(last?.hasInput) return {ok:true,state:last};
    if(/chờ một chút|just a moment|verify you are human|checking your browser|cloudflare|captcha/i.test(`${last?.title||''} ${last?.body||''}`.toLowerCase())){
      await clickByText(page,['reload','thử lại','continue','tiếp tục']);
    }
    await page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});
    await sleep(4000);
  }
  return {ok:false,state:last};
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
  const page=await browser.newPage();
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  await sleep(5000);
  const before=await snap(page,'before');
  const usable=await waitUsable(page,90000);
  let sel=null, hit=false;
  if(usable.ok){
    sel=await fillAndSend(page,seed);
    const start=Date.now();
    while(Date.now()-start<45000){
      const s=await snap(page,'after-seed');
      if((s?.body||'').includes('TEST_CHATGPT_GATE_20260529')){ hit=true; break; }
      await sleep(1000);
    }
  }
  const after=await snap(page,'after');
  console.log(JSON.stringify({before,usable,sel,hit,after},null,2));
} finally { await browser.close(); }
