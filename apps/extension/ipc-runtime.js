(()=>{
  const PROTOCOL_VERSION = 'vsbrain.ipc.v0.1';
  const TYPE = {
    SESSION_REGISTER: 'SESSION_REGISTER',
    ACTION_REQUEST: 'ACTION_REQUEST',
    ACTION_ACK: 'ACTION_ACK',
    ACTION_EXECUTING: 'ACTION_EXECUTING',
    ACTION_COMMITTED: 'ACTION_COMMITTED',
    ACTION_FAILED: 'ACTION_FAILED',
    EMERGENCY_STOP: 'EMERGENCY_STOP'
  };
  const STORE_KEY = 'vsbrain_ipc_events_v0';

  function nowIso(){ return new Date().toISOString(); }
  function rand(){ return Math.random().toString(36).slice(2,10); }
  function makeId(prefix){ return `${prefix}_${Date.now()}_${rand()}`; }

  async function loadEvents(){
    const raw = await chrome.storage.local.get(STORE_KEY);
    return Array.isArray(raw?.[STORE_KEY]) ? raw[STORE_KEY] : [];
  }
  async function saveEvents(rows){
    await chrome.storage.local.set({ [STORE_KEY]: rows.slice(-500) });
  }

  async function emit({ messageType, sessionId, actorId, tabId = null, actionId = null, phaseVersion = 0, expectedAck = false, retryCount = 0, payload = {}, errorCode = null, correlationId = null }) {
    if (!sessionId) throw new Error('ERR_UNKNOWN_SESSION');
    const msg = {
      protocol_version: PROTOCOL_VERSION,
      message_type: messageType,
      session_id: sessionId,
      actor_id: actorId || 'popup',
      tab_id: tabId,
      action_id: actionId,
      phase_version: Number(phaseVersion || 0),
      correlation_id: correlationId || makeId('corr'),
      created_at: nowIso(),
      expected_ack: !!expectedAck,
      retry_count: Number(retryCount || 0),
      payload,
      error_code: errorCode
    };
    const rows = await loadEvents();
    rows.push(msg);
    await saveEvents(rows);
    return msg;
  }

  function validate(msg, currentPhaseVersion = 0) {
    if (!msg?.protocol_version || msg.protocol_version !== PROTOCOL_VERSION) return { ok: false, code: 'ERR_PROTOCOL_VERSION' };
    if (!msg?.session_id) return { ok: false, code: 'ERR_UNKNOWN_SESSION' };
    if (Number(msg.phase_version || 0) < Number(currentPhaseVersion || 0)) return { ok: false, code: 'ERR_STALE_PHASE' };
    return { ok: true };
  }

  window.__vsbrainIPC = { PROTOCOL_VERSION, TYPE, emit, validate, loadEvents };
})();
