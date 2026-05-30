const labTabs = new Map();
let nextTabId = 1;
let activeTabId = null;
const localStore = {};

function registerLabTab(win, meta = {}) {
  const id = nextTabId++;
  labTabs.set(id, {
    id,
    win,
    title: meta.title || win.document?.title || `Lab Tab ${id}`,
    url: meta.url || win.location?.href || '',
    windowId: 1,
    active: false
  });
  if (!activeTabId) activeTabId = id;
  return id;
}

function syncLabTabs() {
  for (const tab of labTabs.values()) {
    try {
      tab.title = tab.win.document?.title || tab.title;
      tab.url = tab.win.location?.href || tab.url;
      tab.active = tab.id === activeTabId;
    } catch {}
  }
}

function getTab(id) {
  syncLabTabs();
  const tab = labTabs.get(Number(id));
  if (!tab) throw new Error(`tab not found: ${id}`);
  return tab;
}

window.__vsbrainLab = {
  registerWindow(win, meta) { return registerLabTab(win, meta); },
  activate(id) { activeTabId = Number(id); syncLabTabs(); },
  listTabs() { syncLabTabs(); return [...labTabs.values()].map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, windowId: 1 })); },
  getActiveTab() { syncLabTabs(); return [...labTabs.values()].find(t => t.id === activeTabId) || null; },
  debug() { syncLabTabs(); return { activeTabId, tabs: [...labTabs.values()].map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active })) }; }
};

window.chrome = {
  tabs: {
    async query(queryInfo = {}) {
      syncLabTabs();
      let tabs = [...labTabs.values()].map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, windowId: 1 }));
      if (queryInfo.active) tabs = tabs.filter(t => t.active);
      return tabs;
    },
    async get(id) {
      const t = getTab(id);
      return { id: t.id, title: t.title, url: t.url, active: t.active, windowId: 1 };
    },
    async update(id, patch = {}) {
      const t = getTab(id);
      if (patch.active) activeTabId = t.id;
      syncLabTabs();
      return { id: t.id, title: t.title, url: t.url, active: t.id === activeTabId, windowId: 1 };
    },
    async create(createProperties = {}) {
      const frames = document.getElementById('labFrames');
      if (!frames) throw new Error('labFrames container not found');
      const iframe = document.createElement('iframe');
      iframe.src = createProperties.url || 'about:blank';
      iframe.style.width = '100%';
      iframe.style.height = '48vh';
      iframe.style.border = '1px solid #333';
      iframe.style.borderRadius = '10px';
      iframe.style.background = '#fff';
      frames.appendChild(iframe);
      await new Promise(r => iframe.addEventListener('load', r, { once: true }));
      const id = registerLabTab(iframe.contentWindow, { title: createProperties.url || 'Lab Tab', url: createProperties.url || '' });
      if (createProperties.active !== false) activeTabId = id;
      syncLabTabs();
      const t = getTab(id);
      return { id: t.id, title: t.title, url: t.url, active: t.id === activeTabId, windowId: 1 };
    }
  },
  windows: {
    async update() { return { id: 1, focused: true }; }
  },
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: localStore[key] };
        return { ...localStore };
      },
      async set(obj) {
        Object.assign(localStore, obj);
      }
    }
  },
  downloads: {
    async download(opts) {
      const id = Date.now();
      console.log('LAB_DOWNLOAD', id, opts.filename);
      return id;
    }
  },
  scripting: {
    async executeScript({ target, func, args = [] }) {
      const t = getTab(target.tabId);
      const named = func?.name && typeof t.win[func.name] === 'function' ? t.win[func.name] : null;
      if (named) {
        const result = await named.apply(t.win, args);
        return [{ result }];
      }
      const source = `(${func.toString()}).apply(window, ${JSON.stringify(args)})`;
      const result = await t.win.eval(source);
      return [{ result }];
    }
  },
  sidePanel: { setPanelBehavior: async () => ({}) },
  runtime: { onInstalled: { addListener() {} } }
};
