// Content script trong MV3 khong dung duoc ES module, nen moi file trong content/
// gan vao mot namespace toan cuc duy nhat. File nay phai chay dau tien.
(function () {
  if (window.__TAF) return;

  // Ban sao cua DEFAULT_SETTINGS trong shared/settings.js.
  // Sua mot ben thi sua ca hai.
  const DEFAULTS = {
    apiKey: '',
    model: 'deepseek-flash',
    apiBase: 'https://api.deepseek.com',
    enabled: true,
    catalogPath: '',
    lastCategories: [],
    catalogSkipped: [],
    maxLinks: 1, // so link (so san pham) toi da trong mot comment
    debug: false,
    maxOpComments: 10,
    temperature: 0.9,
    systemPrompt: '',
  };

  const TAF = {
    DEFAULTS,
    settings: { ...DEFAULTS },
    categories: [], // [{ name, count }] theo thu tu sheet trong seeding.xlsx

    log(...args) {
      if (TAF.settings.debug) console.log('[TAF]', ...args);
    },
    warn(...args) {
      console.warn('[TAF]', ...args);
    },

    async loadState() {
      const { settings, categories } = await chrome.storage.local.get(['settings', 'categories']);
      TAF.settings = { ...DEFAULTS, ...(settings || {}) };
      TAF.categories = categories || [];
      return TAF;
    },
  };

  // Settings hoac catalog doi thi cap nhat ngay, khong cho tai lai trang.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) TAF.settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
    if (changes.categories) TAF.categories = changes.categories.newValue || [];
    if ((changes.settings || changes.categories) && TAF.onStateChange) TAF.onStateChange(changes);
  });

  window.__TAF = TAF;
})();
