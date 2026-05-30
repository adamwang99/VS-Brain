(()=>{
  const STORE_KEY = 'vsbrain_lease_store_v0';
  const LEASE_TTL_MS = 45000;
  const STATES = {
    UNCLAIMED: 'unclaimed',
    ACQUIRING: 'acquiring',
    ACTIVE: 'active',
    RENEWING: 'renewing',
    EXPIRED: 'expired',
    CONFLICTED: 'conflicted',
    RELEASED: 'released',
    TAKEOVER_PENDING: 'takeover_pending',
    BLOCKED: 'blocked'
  };

  function now(){ return Date.now(); }
  function nowIso(){ return new Date().toISOString(); }
  function rand(){ return Math.random().toString(36).slice(2,10); }
  function makeId(prefix){ return `${prefix}_${Date.now()}_${rand()}`; }

  async function loadStore(){
    const raw = await chrome.storage.local.get(STORE_KEY);
    return raw?.[STORE_KEY] && typeof raw[STORE_KEY] === 'object' ? raw[STORE_KEY] : {};
  }
  async function saveStore(store){ await chrome.storage.local.set({ [STORE_KEY]: store }); }

  function isExpired(record){ return !record?.expiresAt || record.expiresAt <= now(); }

  async function acquire({ sessionId, ownerId, currentPhase = 0 }) {
    const store = await loadStore();
    const rec = store[sessionId];
    if (!rec || [STATES.UNCLAIMED, STATES.RELEASED, STATES.EXPIRED].includes(rec.status) || isExpired(rec)) {
      const next = {
        sessionId,
        leaseOwnerId: ownerId,
        leaseToken: makeId('lease'),
        leaseVersion: Number(rec?.leaseVersion || 0) + 1,
        status: STATES.ACTIVE,
        currentPhase,
        activeActionId: null,
        acquiredAt: nowIso(),
        lastRenewedAt: nowIso(),
        expiresAt: now() + LEASE_TTL_MS
      };
      store[sessionId] = next;
      await saveStore(store);
      return { ok: true, lease: next };
    }
    if (rec.leaseOwnerId === ownerId) {
      rec.status = STATES.ACTIVE;
      rec.currentPhase = currentPhase;
      rec.lastRenewedAt = nowIso();
      rec.expiresAt = now() + LEASE_TTL_MS;
      store[sessionId] = rec;
      await saveStore(store);
      return { ok: true, lease: rec };
    }
    return { ok: false, code: 'ERR_LEASE_CONFLICT', lease: rec };
  }

  async function renew({ sessionId, leaseToken, currentPhase = 0 }) {
    const store = await loadStore();
    const rec = store[sessionId];
    if (!rec) return { ok: false, code: 'ERR_NO_LEASE' };
    if (rec.leaseToken !== leaseToken) return { ok: false, code: 'ERR_LEASE_TOKEN' };
    rec.status = STATES.ACTIVE;
    rec.currentPhase = currentPhase;
    rec.lastRenewedAt = nowIso();
    rec.expiresAt = now() + LEASE_TTL_MS;
    store[sessionId] = rec;
    await saveStore(store);
    return { ok: true, lease: rec };
  }

  async function release({ sessionId, leaseToken }) {
    const store = await loadStore();
    const rec = store[sessionId];
    if (!rec) return { ok: false, code: 'ERR_NO_LEASE' };
    if (rec.leaseToken !== leaseToken) return { ok: false, code: 'ERR_LEASE_TOKEN' };
    rec.status = STATES.RELEASED;
    rec.activeActionId = null;
    rec.expiresAt = now();
    store[sessionId] = rec;
    await saveStore(store);
    return { ok: true, lease: rec };
  }

  async function markAction({ sessionId, leaseToken, actionId }) {
    const store = await loadStore();
    const rec = store[sessionId];
    if (!rec || rec.leaseToken !== leaseToken) return { ok: false, code: 'ERR_LEASE_TOKEN' };
    rec.activeActionId = actionId || null;
    store[sessionId] = rec;
    await saveStore(store);
    return { ok: true, lease: rec };
  }

  async function block({ sessionId, reason }) {
    const store = await loadStore();
    const rec = store[sessionId] || { sessionId, leaseVersion: 0 };
    rec.status = STATES.BLOCKED;
    rec.blockedReason = reason || 'unknown';
    rec.expiresAt = now() + LEASE_TTL_MS;
    store[sessionId] = rec;
    await saveStore(store);
    return { ok: true, lease: rec };
  }

  async function validate({ sessionId, leaseToken }) {
    const store = await loadStore();
    const rec = store[sessionId];
    if (!rec) return { ok: false, code: 'ERR_NO_LEASE' };
    if (isExpired(rec)) return { ok: false, code: 'ERR_LEASE_EXPIRED', lease: rec };
    if (rec.status === STATES.BLOCKED) return { ok: false, code: 'ERR_LEASE_BLOCKED', lease: rec };
    if (rec.leaseToken !== leaseToken) return { ok: false, code: 'ERR_LEASE_TOKEN', lease: rec };
    return { ok: true, lease: rec };
  }

  async function get(sessionId){ const store = await loadStore(); return store[sessionId] || null; }

  window.__vsbrainLease = { STATES, LEASE_TTL_MS, acquire, renew, release, markAction, block, validate, get };
})();
