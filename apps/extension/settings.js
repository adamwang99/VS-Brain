/* settings.js — VS Brain settings layer (chrome.storage.sync)
   Part of VS Brain v0.8.68 modular split.
   API: getSetting(key) / setSetting(key, value) / resetSettings()
*/
(function(global) {
  var S = global.VS_BRAIN || {};

  var DEFAULTS = {
    max_steps: 100,
    auto_send: true,
    auto_handoff: true,
    handoff_threshold_pct: 70,
    convergence_critical_budget: null,  // null = auto-calc from max_steps
    round_budget: null,                 // null = auto-calc from max_steps
    language: 'vi',
    intent: 'auto',
    output_mode: 'blueprint',
    stop_phrase: 'CHỐT_ĐỒNG_THUẬN_HOÀN_TOÀN',
    max_active_providers: 2,           // used in Step 4+
    max_rounds_per_session: 50         // used in Step 5+
  };

  /* read setting; returns promise for async, or sync-value from cache */
  function getSetting(key, cb) {
    if (cb) {
      chrome.storage.sync.get(key, function(r) {
        var val = (r && r[key] !== undefined) ? r[key] : DEFAULTS[key];
        cb(val);
      });
      return;
    }
    return new Promise(function(resolve) {
      chrome.storage.sync.get(key, function(r) {
        var val = (r && r[key] !== undefined) ? r[key] : DEFAULTS[key];
        resolve(val);
      });
    });
  }

  /* write setting; returns promise */
  function setSetting(key, value) {
    return new Promise(function(resolve) {
      var o = {};
      o[key] = value;
      chrome.storage.sync.set(o, resolve);
    });
  }

  /* reset all to defaults */
  function resetSettings() {
    return new Promise(function(resolve) {
      var keys = Object.keys(DEFAULTS);
      chrome.storage.sync.remove(keys, resolve);
    });
  }

  /* bulk load all settings into a flat object */
  function getAllSettings() {
    return new Promise(function(resolve) {
      chrome.storage.sync.get(null, function(stored) {
        var result = {};
        Object.keys(DEFAULTS).forEach(function(k) {
          result[k] = (stored && stored[k] !== undefined) ? stored[k] : DEFAULTS[k];
        });
        resolve(result);
      });
    });
  }

  /* compute effective budgets from settings */
  function computeBudgets(settings) {
    var maxSteps = settings.max_steps || DEFAULTS.max_steps;
    return {
      critical_budget: settings.convergence_critical_budget !== null
        ? settings.convergence_critical_budget
        : Math.min(Math.max(3, maxSteps - 1), Math.max(6, Math.round(0.6 * maxSteps))),
      round_budget: settings.round_budget !== null
        ? settings.round_budget
        : Math.min(Math.max(3, maxSteps - 1), Math.max(8, Math.round(0.85 * maxSteps)))
    };
  }

  /* get effective stop phrase respecting language */
  function getEffectiveStopPhrase(lang) {
    // lang param optional; if omitted read from default setting
    lang = lang || DEFAULTS.language;
    var base = DEFAULTS.stop_phrase;  // DEFAULTS only; user override via settings
    return (lang === 'en') ? 'VS_BRAIN_FULL_AGREEMENT' : base;
  }

  S.settings = {
    DEFAULTS: DEFAULTS,
    getSetting: getSetting,
    setSetting: setSetting,
    resetSettings: resetSettings,
    getAllSettings: getAllSettings,
    computeBudgets: computeBudgets,
    getEffectiveStopPhrase: getEffectiveStopPhrase
  };
  global.VS_BRAIN = S;
})(window);
