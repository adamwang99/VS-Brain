/* payment.js — License validation, upgrade flow, payment links */
(function(global) {
  var VS = global.VS_BRAIN || {};

  var STRIPE_LINKS = {
    monthly: 'https://buy.stripe.com/test_placeholder_monthly',
    annual:  'https://buy.stripe.com/test_placeholder_annual'
  };

  var LICENSE_STORAGE_KEY = 'vsbrain_license';

  // ── Public API ──────────────────────────────────────────

  VS.upgradeToPro = function(frequency) {
    var url = (frequency === 'annual') ? STRIPE_LINKS.annual : STRIPE_LINKS.monthly;
    window.open(url, '_blank');
  };

  VS.validateLicense = async function(key) {
    if (!key || typeof key !== 'string') return { ok: false, error: 'Missing license key' };
    var trimmed = key.trim().toUpperCase();
    // Format: VSBRAIN-XXXX-XXXX-XXXX (16 chars of hex)
    var formatOk = /^VSBRAIN-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(trimmed);
    if (!formatOk) return { ok: false, error: 'Invalid format. Expected: VSBRAIN-XXXX-XXXX-XXXX' };
    // Run an optional remote check; if unreachable, fall back to format-only validation
    try {
      var resp = await fetch('https://vsbrain-prod.web.app/api/validate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed })
      });
      var data = await resp.json();
      if (data && data.valid === true) {
        return { ok: true, tier: 'pro', expiresAt: data.expires_at || null };
      }
      return { ok: false, error: data && data.error ? data.error : 'License rejected by server' };
    } catch(e) {
      // Offline-mode: accept format-valid license keys as Pro
      return { ok: true, tier: 'pro', expiresAt: null, offlineFallback: true };
    }
  };

  VS.getLicenseStatus = async function() {
    try {
      var result = await chrome.storage.sync.get(LICENSE_STORAGE_KEY);
      var license = result[LICENSE_STORAGE_KEY];
      if (!license) return { status: 'none', tier: 'free' };
      var expires = license.expiresAt ? new Date(license.expiresAt) : null;
      if (expires && expires < new Date()) {
        return { status: 'expired', tier: 'free', expiredAt: license.expiresAt };
      }
      return { status: 'active', tier: 'pro', expiresAt: license.expiresAt };
    } catch(e) {
      return { status: 'none', tier: 'free' };
    }
  };

  VS.applyLicense = async function(key) {
    var validation = await VS.validateLicense(key);
    if (!validation.ok) return validation;
    await chrome.storage.sync.set({
      [LICENSE_STORAGE_KEY]: {
        key: key.trim().toUpperCase(),
        activatedAt: new Date().toISOString(),
        expiresAt: validation.expiresAt
      }
    });
    await VS.setTier('pro');
    return { ok: true, tier: 'pro' };
  };

  VS.clearLicense = async function() {
    await chrome.storage.sync.remove(LICENSE_STORAGE_KEY);
    await VS.setTier('free');
  };

  global.VS_BRAIN = VS;
})(window);
