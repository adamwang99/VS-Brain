/* provider-registry.js — provider metadata, active selection, certified list */
(function(global) {
  var VS = global.VS_BRAIN || {};

  VS.PROVIDERS = [
    { id: 'chatgpt',    name: 'ChatGPT',    icon: 'icons/brain-16.png',     urlPatterns: ['chatgpt.com','chat.openai.com'], color: '#10a37f', certified: true },
    { id: 'gemini',     name: 'Gemini',     icon: 'icons/brain-16.png',     urlPatterns: ['gemini.google.com'],            color: '#8e9eff', certified: true },
    { id: 'claude',     name: 'Claude',     icon: 'icons/claude-16.png',    urlPatterns: ['claude.ai'],                    color: '#d97757', certified: false },
    { id: 'deepseek',   name: 'DeepSeek',   icon: 'icons/deepseek-16.png',  urlPatterns: ['chat.deepseek.com'],             color: '#4d6bfe', certified: false },
    { id: 'grok',       name: 'Grok',       icon: 'icons/grok-16.png',      urlPatterns: ['grok.com','x.com/i/grok'],      color: '#f0f0f0', certified: false },
    { id: 'perplexity', name: 'Perplexity', icon: 'icons/perplexity-16.png',urlPatterns: ['perplexity.ai'],                 color: '#20b8cd', certified: false }
  ];

  // Get currently active provider IDs from sync storage
  VS.getActiveProviderIds = async function() {
    try {
      var result = await chrome.storage.sync.get('vsbrain_activeProviders');
      var ids = result && result.vsbrain_activeProviders;
      if (Array.isArray(ids) && ids.length) return ids;
    } catch(e) {}
    // Default: certified providers only
    return VS.PROVIDERS.filter(function(p) { return p.certified; }).map(function(p) { return p.id; });
  };

  VS.setActiveProviderIds = async function(ids) {
    ids = (Array.isArray(ids) ? ids : []).filter(Boolean);
    await chrome.storage.sync.set({ vsbrain_activeProviders: ids });
  };

  VS.getProviderById = function(id) {
    return VS.PROVIDERS.find(function(p) { return p.id === id; }) || null;
  };

  VS.isActiveProvider = async function(providerId) {
    var active = await VS.getActiveProviderIds();
    return active.indexOf(providerId) >= 0;
  };

  // Match URL to provider id
  VS.providerFromUrl = function(url) {
    url = (url || '').toLowerCase();
    // Mock lab
    if (/127\.0\.0\.1:\d+\/lab\/mock-gemini\.html/i.test(url)) return 'gemini';
    if (/127\.0\.0\.1:\d+\/lab\/mock-chatgpt\.html/i.test(url)) return 'chatgpt';
    for (var i = 0; i < VS.PROVIDERS.length; i++) {
      var p = VS.PROVIDERS[i];
      for (var j = 0; j < p.urlPatterns.length; j++) {
        if (url.indexOf(p.urlPatterns[j]) >= 0) return p.id;
      }
    }
    return 'unknown';
  };

  // Filter tabs by active providers
  VS.filterTabsByActiveProviders = async function(tabs) {
    var active = await VS.getActiveProviderIds();
    return tabs.filter(function(t) {
      return active.indexOf(providerFromUrl(t.url)) >= 0;
    });
  };

  global.VS_BRAIN = VS;
  // Expose as global for backward compat
  global.providerFromUrl = VS.providerFromUrl;
})(window);
