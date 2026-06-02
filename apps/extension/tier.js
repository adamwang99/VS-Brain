/* tier.js — Free/Pro tier definitions, quota plans, pricing */
(function(global) {
  var VS = global.VS_BRAIN || {};

  // ── Tier plans ──────────────────────────────────────────
  var PLANS = {
    free: {
      tier: 'free',
      maxRounds: 50,
      maxActiveProviders: 2,
      certifiedOnly: true,
      canExportFinal: false,   // only if converged within limit
      internalBatchCap: null,
      price: 0,
      label: 'Free'
    },
    pro: {
      tier: 'pro',
      maxRounds: Infinity,     // UI shows unlimited
      maxActiveProviders: 3,
      certifiedOnly: false,    // all providers selectable
      canExportFinal: true,
      internalBatchCap: 100,   // auto-continue if not converged
      price: { monthly_list: 11, monthly_launch: 5, annual_list: 69, annual_launch: 29 },
      label: 'Pro'
    }
  };

  // ── Tier API ────────────────────────────────────────────
  VS.getTier = async function() {
    try {
      var result = await chrome.storage.sync.get('vsbrain_tier');
      var tier = result && result.vsbrain_tier;
      if (tier === 'pro') return 'pro';
    } catch(e) {}
    return 'free';
  };

  VS.getPlan = async function() {
    var tier = await VS.getTier();
    return PLANS[tier] || PLANS.free;
  };

  VS.getQuota = async function() {
    var plan = await VS.getPlan();
    return {
      maxRounds: plan.maxRounds,
      maxActiveProviders: plan.maxActiveProviders,
      certifiedOnly: plan.certifiedOnly,
      canExportFinal: plan.canExportFinal
    };
  };

  VS.setTier = async function(tier) {
    tier = (tier === 'pro') ? 'pro' : 'free';
    await chrome.storage.sync.set({ vsbrain_tier: tier });
  };

  VS.getPricing = function() {
    return PLANS.pro.price;
  };

  VS.isPro = async function() {
    return (await VS.getTier()) === 'pro';
  };

  // ── Internal batch cap check ────────────────────────────
  VS.isInternalBatchExhausted = async function(roundCount) {
    var plan = await VS.getPlan();
    if (!plan.internalBatchCap) return false;
    return roundCount >= plan.internalBatchCap;
  };

  global.VS_BRAIN = VS;
})(window);
