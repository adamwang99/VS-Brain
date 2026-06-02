/* quota.js — per-session round counting with reload persistence */
(function(global) {
  var VS = global.VS_BRAIN || {};

  // ── Session identity ────────────────────────────────────
  var SESSION_KEY = 'vsbrain_session_quota';

  async function loadSession() {
    var data = {};
    try {
      var result = await chrome.storage.local.get(SESSION_KEY);
      data = result && result[SESSION_KEY];
    } catch(e) {}
    return {
      sessionId: data && data.sessionId || null,
      roundCount: data && typeof data.roundCount === 'number' ? data.roundCount : 0,
      createdAt: data && data.createdAt || 0
    };
  }

  async function saveSession(session) {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }

  // ── Public API ──────────────────────────────────────────

  // Get current session's round count
  VS.getRoundCount = async function() {
    var session = await loadSession();
    return session.roundCount || 0;
  };

  // Get remaining rounds for the current tier
  VS.getRemainingRounds = async function() {
    var quota = await VS.getQuota();
    var count = await VS.getRoundCount();
    if (quota.maxRounds === Infinity) return Infinity;
    return Math.max(0, quota.maxRounds - count);
  };

  // Increment round count for current session
  VS.incrementRound = async function() {
    var session = await loadSession();
    if (!session.sessionId) {
      session.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      session.createdAt = Date.now();
    }
    session.roundCount = (session.roundCount || 0) + 1;
    await saveSession(session);
    return session.roundCount;
  };

  // Check if quota is exceeded for current tier
  VS.isQuotaExceeded = async function() {
    var quota = await VS.getQuota();
    var count = await VS.getRoundCount();
    if (quota.maxRounds === Infinity) return false;
    return count >= quota.maxRounds;
  };

  // Reset session quota (e.g. on manual "new session")
  VS.resetSessionQuota = async function() {
    var fresh = { sessionId: null, roundCount: 0, createdAt: 0 };
    await saveSession(fresh);
  };

  // Create a new session (preserves old data for forensics)
  VS.startNewQuotaSession = async function() {
    var newSession = {
      sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      roundCount: 0,
      createdAt: Date.now()
    };
    await saveSession(newSession);
  };

  // Session quota info for UI display
  VS.getQuotaInfo = async function() {
    var quota = await VS.getQuota();
    var count = await VS.getRoundCount();
    var remaining = quota.maxRounds === Infinity ? Infinity : Math.max(0, quota.maxRounds - count);
    var exceeded = quota.maxRounds !== Infinity && count >= quota.maxRounds;
    var pct = quota.maxRounds === Infinity ? 0 : Math.min(100, Math.round((count / quota.maxRounds) * 100));
    return { maxRounds: quota.maxRounds, roundCount: count, remaining: remaining, exceeded: exceeded, pct: pct };
  };

  global.VS_BRAIN = VS;
})(window);
