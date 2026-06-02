(()=>{
  const STORE_KEY='vsbrain_runtime_checkpoint_v0';
  const FINALIZE_NONCE_KEY='vsbrain_finalize_nonce_v0';
  function nowIso(){return new Date().toISOString()}
  async function saveCheckpoint(payload){
    const prev=(await chrome.storage.local.get(STORE_KEY))?.[STORE_KEY]||{};
    const next={...prev,...payload,updatedAt:nowIso()};
    await chrome.storage.local.set({[STORE_KEY]:next});
    return next;
  }
  async function loadCheckpoint(){
    return (await chrome.storage.local.get(STORE_KEY))?.[STORE_KEY]||null;
  }
  async function clearCheckpoint(){ await chrome.storage.local.remove(STORE_KEY); }
  async function newFinalizeNonce(){
    const nonce=`fin_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    await chrome.storage.local.set({[FINALIZE_NONCE_KEY]:{nonce,createdAt:nowIso(),used:false}});
    return nonce;
  }
  async function getFinalizeNonce(){
    return (await chrome.storage.local.get(FINALIZE_NONCE_KEY))?.[FINALIZE_NONCE_KEY]||null;
  }
  async function consumeFinalizeNonce(expected){
    const rec=await getFinalizeNonce();
    if(!rec?.nonce||rec.used) return {ok:false,code:'ERR_FINALIZE_NONCE_MISSING'};
    if(expected!==rec.nonce) return {ok:false,code:'ERR_FINALIZE_NONCE_MISMATCH',current:rec.nonce};
    rec.used=true; rec.usedAt=nowIso();
    await chrome.storage.local.set({[FINALIZE_NONCE_KEY]:rec});
    return {ok:true,nonce:rec.nonce};
  }
  function parseTerminationEnvelope(text){
    const src=String(text||'');
    const matches=[...src.matchAll(/```vsbrain-termination\s*([\s\S]*?)```/g)];
    if(matches.length!==1) return {ok:false,code:matches.length===0?'ERR_TERMINATION_ENVELOPE_MISSING':'ERR_TERMINATION_ENVELOPE_MULTIPLE'};
    const body=matches[0][1].trim();
    // JSON-first: try JSON.parse, fallback to key-value line parser
    let jsonOk=false;
    let parsed=null;
    try {
      parsed=JSON.parse(body);
      jsonOk=(parsed!==null && typeof parsed==='object' && !Array.isArray(parsed));
    } catch(e){}
    if(jsonOk){
      const required=['status','session_nonce','should_continue','critical_remaining'];
      for(const k of required){
        if(!(k in parsed)) return {ok:false,code:`ERR_TERMINATION_FIELD_${k.toUpperCase()}_MISSING`,fields:parsed};
      }
      const norm={
        status:String(parsed.status||'').toLowerCase(),
        session_nonce:String(parsed.session_nonce||''),
        should_continue:parsed.should_continue===true||parsed.should_continue==='true'||parsed.should_continue===1,
        critical_remaining:parsed.critical_remaining===true||parsed.critical_remaining==='true'||parsed.critical_remaining===1,
        raw:body,
        fields:parsed,
        parser:'json'
      };
      if(norm.status!=='ready_to_finalize') return {ok:false,code:'ERR_TERMINATION_STATUS_INVALID',fields:parsed};
      return {ok:true,envelope:norm};
    }
    // Fallback: key-value line parser (backwards compat)
    const out={};
    for(const line of body.split(/\r?\n/)){
      const m=line.match(/^([a-zA-Z_]+)\s*:\s*(.+)$/);
      if(!m) continue;
      out[m[1].trim()]=m[2].trim();
    }
    const required=['status','session_nonce','should_continue','critical_remaining'];
    for(const k of required){ if(!(k in out)) return {ok:false,code:`ERR_TERMINATION_FIELD_${k.toUpperCase()}_MISSING`,fields:out}; }
    const norm={
      status:String(out.status||'').toLowerCase(),
      session_nonce:String(out.session_nonce||''),
      should_continue:/^(true|yes|1|có)$/i.test(String(out.should_continue||'')),
      critical_remaining:/^(true|yes|1|có)$/i.test(String(out.critical_remaining||'')),
      raw:body,
      fields:out,
      parser:'key-value'
    };
    return {ok:true,envelope:norm};
  }
  window.__vsbrainRecovery={STORE_KEY,saveCheckpoint,loadCheckpoint,clearCheckpoint,newFinalizeNonce,getFinalizeNonce,consumeFinalizeNonce};
})();