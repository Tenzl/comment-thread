// Gia tri mac dinh cua Settings.
// LUU Y: content/namespace.js giu mot ban sao cua object nay, vi content script
// khong import duoc ES module. Sua o day thi sua ca ben do.
export const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'deepseek-flash',
  apiBase: 'https://api.deepseek.com',
  enabled: true,
  catalogPath: '', // rong = dung data/seeding.xlsx dong goi san
  lastCategories: [],
  catalogSkipped: [], // sheet bi bo qua lan nap gan nhat: [{ sheet, reason }]
  maxLinks: 1, // so link (so san pham) toi da trong mot comment
  debug: false,
  maxOpComments: 10,
  temperature: 0.9,
  systemPrompt: '',
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
