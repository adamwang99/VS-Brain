(() => {
  const AI_HOSTS = [
    ['chatgpt', ['chatgpt.com', 'chat.openai.com']],
    ['gemini', ['gemini.google.com']],
    ['deepseek', ['chat.deepseek.com']],
    ['claude', ['claude.ai']],
    ['perplexity', ['perplexity.ai']],
    ['grok', ['grok.com', 'x.com/i/grok']]
  ];

  const CERTIFIED_PROVIDERS = new Set(['chatgpt', 'gemini']);

  const PROVIDER_LABELS = {
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    deepseek: 'DeepSeek',
    claude: 'Claude',
    perplexity: 'Perplexity',
    grok: 'Grok',
    unknown: 'Unknown'
  };

  // Canonical provider order for the selection grid (registry-based, independent of open tabs).
  const PROVIDER_ORDER = ['chatgpt', 'gemini', 'claude', 'deepseek', 'perplexity', 'grok'];

  // URL to open a fresh chat for each provider when the user selects one with no live tab.
  const PROVIDER_OPEN_URL = {
    chatgpt: 'https://chatgpt.com/',
    gemini: 'https://gemini.google.com/app',
    claude: 'https://claude.ai/new',
    deepseek: 'https://chat.deepseek.com/',
    perplexity: 'https://www.perplexity.ai/',
    grok: 'https://grok.com/'
  };

  // Default providers pre-selected in the grid.
  const DEFAULT_SELECTED = ['chatgpt', 'gemini'];

  // Max participants in one VS run (VS3 = up to 3-way roundtable).
  const MAX_PARTICIPANTS = 3;
  const MIN_PARTICIPANTS = 2;

  function providerFromUrl(url = '') {
    for (const [name, hosts] of AI_HOSTS) if (hosts.some((h) => url.includes(h))) return name;
    return 'unknown';
  }

  function isCertifiedProvider(provider = 'unknown') {
    return CERTIFIED_PROVIDERS.has(provider);
  }

  function providerLabel(provider = 'unknown') {
    return PROVIDER_LABELS[provider] || provider || 'Unknown';
  }

  function formatTabLabel(tab) {
    const title = String(tab?.title || 'Untitled').replace(/\s+/g, ' ').trim();
    const shortTitle = title.length > 42 ? `${title.slice(0, 42).trim()}...` : title;
    return `${providerLabel(tab?.provider)} · ${shortTitle}`;
  }

  Object.assign(globalThis, {
    AI_HOSTS,
    CERTIFIED_PROVIDERS,
    PROVIDER_LABELS,
    PROVIDER_ORDER,
    PROVIDER_OPEN_URL,
    DEFAULT_SELECTED,
    MAX_PARTICIPANTS,
    MIN_PARTICIPANTS,
    providerFromUrl,
    isCertifiedProvider,
    providerLabel,
    formatTabLabel
  });
})();
