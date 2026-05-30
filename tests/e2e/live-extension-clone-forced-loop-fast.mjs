import puppeteer from 'puppeteer';
import fs from 'node:fs';

const extensionPath = '/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension';
const userDataDir = process.env.USER_DATA_DIR || '/home/phuong/.cache/vsbrain-default-snapshot-consistent';
const out = '/home/phuong/.openclaw/workspace/projects/crosscritic/tmp/live-loop-fast-result.json';
const seed = 'Reply with exactly 2 lines: line 1 = OK, line 2 = TEST_LOOP_FAST_20260529';
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function safeEval(page, fn, ...args){ try { return await page.evaluate(fn, ...args); } catch(err){ const msg=String(err?.message||err||''); if(/detached frame|context was destroyed|Cannot find context|Promise was collected/i.test(msg)) return null; throw err; } }
async function fillAndSend(page, text){ const selectors=['textarea','rich-textarea [contenteditable="true"]','[contenteditable="true"]','div[contenteditable="true"][role="textbox"]','div.ProseMirror']; for(const sel of selectors){ const ok=await safeEval(page, async (selector,text)=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const el=document.querySelector(selector); if(!el) return false; el.focus(); el.click?.(); if('value' in el){ el.value=text; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); } else { document.execCommand?.('selectAll',false); document.execCommand?.('insertText',false,text); el.textContent=text; el.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'})); } await sleep(400); const btn=[...document.querySelectorAll('button')].find(b=>{ const s=`${b.innerText||''} ${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''}`.toLowerCase(); const r=b.getBoundingClientRect?.(); return r&&r.width>0&&r.height>0&&!b.disabled&&/(send|gửi|submit|run|arrow)/i.test(s); }); if(btn){ btn.click(); return true; } return false; }, sel, text); if(ok) return sel; } return null; }
async function waitNeedle(page, needle, timeout=20000){ const start=Date.now(); while(Date.now()-start<timeout){ const hit=await safeEval(page,n=>String(document.body?.innerText||'').includes(n),needle); if(hit) return true; await sleep(800);} return false; }
const browser=await puppeteer.launch({ headless:false, pipe:true, userDataDir, args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`,'--disable-component-extensions-with-background-pages','--disable-default-apps','--no-first-run','--no-default-browser-check']});
const result={};
try{
  await sleep(5000);
  result.targets=browser.targets().map(t=>({type:t.type(),url:t.url()}));
  const sw=result.targets.find(t=>t.type==='service_worker' && /background\.js$/.test(t.url));
  result.extensionId=sw?sw.url.split('/')[2]:null;
  const chatgpt=await browser.newPage(); await chatgpt.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  const gemini=await browser.newPage(); await gemini.goto('https://gemini.google.com/app',{waitUntil:'domcontentloaded'});
  await sleep(6000);
  result.chatSel=await fillAndSend(chatgpt,seed);
  result.gemSel=await fillAndSend(gemini,seed);
  result.chatHit=await waitNeedle(chatgpt,'TEST_LOOP_FAST_20260529');
  result.gemHit=await waitNeedle(gemini,'TEST_LOOP_FAST_20260529');
  result.chatDump=await safeEval(chatgpt,()=>({title:document.title,body:String(document.body?.innerText||'').slice(0,800)}));
  result.gemDump=await safeEval(gemini,()=>({title:document.title,body:String(document.body?.innerText||'').slice(0,800)}));
  if(result.extensionId){
    const popup=await browser.newPage();
    await popup.goto(`chrome-extension://${result.extensionId}/popup.html`,{waitUntil:'domcontentloaded'}).catch(()=>{});
    await sleep(2000);
    await popup.click('#refreshTabsBtn').catch(()=>{});
    await sleep(3000);
    result.before=await safeEval(popup,()=>({sourceVal:document.querySelector('#sourceTab')?.value||'',targetVal:document.querySelector('#targetTab')?.value||'',startLoopDisabled:!!document.querySelector('#startLoopBtn')?.disabled,log:document.querySelector('#log')?.textContent||'',status:document.querySelector('#status')?.textContent||''}));
    await safeEval(popup,()=>{ const a=document.querySelector('#autoSendToggle'); if(a) a.checked=true; document.querySelector('#startLoopBtn')?.click(); return true; });
    await sleep(5000);
    result.after=await safeEval(popup,()=>({startLoopDisabled:!!document.querySelector('#startLoopBtn')?.disabled,log:document.querySelector('#log')?.textContent||'',status:document.querySelector('#status')?.textContent||''}));
  }
} catch(e){ result.error=String(e?.stack||e); }
finally { fs.writeFileSync(out, JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2)); await browser.close(); }
