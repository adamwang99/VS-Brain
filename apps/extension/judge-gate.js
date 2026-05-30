(()=>{
  const STORE_KEY='vsbrain_judge_gate_v0';
  function nowIso(){return new Date().toISOString()}
  async function saveLastVerdict(verdict){ await chrome.storage.local.set({[STORE_KEY]:{...verdict,savedAt:nowIso()}}); return verdict; }
  async function loadLastVerdict(){ return (await chrome.storage.local.get(STORE_KEY))?.[STORE_KEY]||null; }
  function parseVerdict(text){
    const src=String(text||'');
    const m=src.match(/```vsbrain-judge\s*([\s\S]*?)```/);
    if(!m) return {ok:false,code:'ERR_JUDGE_ENVELOPE_MISSING'};
    const body=m[1].trim();
    const out={};
    for(const line of body.split(/\r?\n/)){
      const kv=line.match(/^([a-zA-Z_]+)\s*:\s*(.+)$/);
      if(!kv) continue;
      out[kv[1].trim()]=kv[2].trim();
    }
    const verdict=String(out.verdict||'').toLowerCase();
    if(!['veto','review_required','no_veto'].includes(verdict)) return {ok:false,code:'ERR_JUDGE_VERDICT_INVALID',fields:out};
    return {
      ok:true,
      verdict:{
        verdict,
        reason:String(out.reason||''),
        confidence:out.confidence==null?null:Number(out.confidence),
        raw:body,
        fields:out,
        judgedAt:nowIso()
      }
    };
  }
  function decide(verdictResult, deterministicGate){
    if(!deterministicGate?.ok) return {ok:false,code:'ERR_DETERMINISTIC_GATE_FAILED',verdict:'veto'};
    if(!verdictResult?.ok) return {ok:false,code:verdictResult?.code||'ERR_JUDGE_PARSE',verdict:'veto'};
    if(verdictResult.verdict.verdict==='veto') return {ok:false,code:'ERR_JUDGE_VETO',verdict:'veto'};
    if(verdictResult.verdict.verdict==='review_required') return {ok:false,code:'ERR_JUDGE_REVIEW_REQUIRED',verdict:'review_required'};
    return {ok:true,code:'OK_JUDGE_NO_VETO',verdict:'no_veto'};
  }
  window.__vsbrainJudgeGate={STORE_KEY,saveLastVerdict,loadLastVerdict,parseVerdict,decide};
})();