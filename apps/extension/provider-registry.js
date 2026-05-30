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
    providerFromUrl,
    isCertifiedProvider,
    providerLabel,
    formatTabLabel
  });
})();
