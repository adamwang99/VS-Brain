(()=>{
  const STORE_KEY = 'vsbrain_action_journal_v0';
  const SESSION_KEY = 'vsbrain_runtime_session_id_v0';

  function nowIso(){ return new Date().toISOString(); }
  function rand(){ return Math.random().toString(36).slice(2,10); }
  function makeId(prefix){ return `${prefix}_${Date.now()}_${rand()}`; }
  function hashText(input){
    let h = 2166136261;
    const s = String(input || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  async function loadJournal(){
    const raw = await chrome.storage.local.get(STORE_KEY);
    return Array.isArray(raw?.[STORE_KEY]) ? raw[STORE_KEY] : [];
  }
  async function saveJournal(rows){
    await chrome.storage.local.set({ [STORE_KEY]: rows.slice(-400) });
  }
  async function ensureSessionId(){
    const raw = await chrome.storage.local.get(SESSION_KEY);
    if (raw?.[SESSION_KEY]) return raw[SESSION_KEY];
    const id = makeId('sess');
    await chrome.storage.local.set({ [SESSION_KEY]: id });
    return id;
  }

  async function createAction({ actionType, payloadFingerprint, phaseVersion, target = {}, retryPolicy = 'none', meta = {} }) {
    const sessionId = await ensureSessionId();
    const rows = await loadJournal();
    const duplicate = rows.find(r =>
      r.sessionId === sessionId &&
      r.actionType === actionType &&
      r.payloadFingerprint === payloadFingerprint &&
      r.phaseVersion === phaseVersion &&
      ['created','acknowledged','executing','committed','unknown_commit_state','blocked_for_review'].includes(r.status)
    );
    if (duplicate) return { created: false, reason: 'duplicate_blocked', action: duplicate, sessionId };
    const action = {
      sessionId,
      actionId: makeId('act'),
      actionType,
      payloadFingerprint,
      phaseVersion,
      status: 'created',
      retryPolicy,
      retryCount: 0,
      target,
      meta,
      createdAt: nowIso(),
      committedAt: null,
      commitEvidence: null,
      lastError: null
    };
    rows.push(action);
    await saveJournal(rows);
    return { created: true, action, sessionId };
  }

  async function updateAction(actionId, patch){
    const rows = await loadJournal();
    const idx = rows.findIndex(r => r.actionId === actionId);
    if (idx < 0) return { ok: false, code: 'not_found' };
    rows[idx] = { ...rows[idx], ...patch };
    await saveJournal(rows);
    return { ok: true, action: rows[idx] };
  }

  async function acknowledge(actionId){ return updateAction(actionId, { status: 'acknowledged' }); }
  async function executing(actionId){ return updateAction(actionId, { status: 'executing' }); }
  async function committed(actionId, commitEvidence){ return updateAction(actionId, { status: 'committed', committedAt: nowIso(), commitEvidence }); }
  async function failedBeforeCommit(actionId, lastError){ return updateAction(actionId, { status: 'failed_before_commit', lastError }); }
  async function unknownCommit(actionId, lastError){ return updateAction(actionId, { status: 'unknown_commit_state', lastError }); }
  async function blockedForReview(actionId, lastError){ return updateAction(actionId, { status: 'blocked_for_review', lastError }); }

  async function latest(){ return loadJournal(); }

  window.__vsbrainActionJournal = {
    STORE_KEY,
    SESSION_KEY,
    hashText,
    ensureSessionId,
    createAction,
    acknowledge,
    executing,
    committed,
    failedBeforeCommit,
    unknownCommit,
    blockedForReview,
    latest
  };
})();
