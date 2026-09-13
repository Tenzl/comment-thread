import { parseCatalogXlsx, sha256, toFileUrl } from '../shared/xlsx.js';
import { getSettings, saveSettings } from '../shared/settings.js';

export const BUNDLED_PATH = 'data/seeding.xlsx';

// Chi kiem tra lai file toi da mot lan trong khoang nay khi goi tu dong.
const THROTTLE_MS = 30 * 1000;
let lastCheck = 0;
let inflight = null;

function sourceUrl(settings) {
  return settings.catalogPath
    ? toFileUrl(settings.catalogPath)
    : chrome.runtime.getURL(BUNDLED_PATH);
}

async function fetchBytes(settings) {
  const url = sourceUrl(settings);
  let res;
  try {
    // no-store: file vua sua trong Excel phai doc ban moi, khong lay cache.
    res = await fetch(url, { cache: 'no-store' });
  } catch (e) {
    if (settings.catalogPath) {
      throw new Error(
        'Khong doc duoc file. Vao chrome://extensions, mo Details cua extension ' +
          'va bat "Allow access to file URLs". Duong dan: ' +
          url
      );
    }
    throw new Error('Khong doc duoc ' + BUNDLED_PATH + ': ' + e.message);
  }
  if (!res.ok) throw new Error('Khong doc duoc file (HTTP ' + res.status + '): ' + url);
  return res.arrayBuffer();
}

// Doc file, so hash voi lan truoc. Khac thi parse va ghi vao storage.
// force: parse lai du hash trung.
async function doRefresh(force) {
  const settings = await getSettings();
  const buf = await fetchBytes(settings);
  const hash = await sha256(buf);
  lastCheck = Date.now();

  const { products } = await chrome.storage.local.get('products');
  const source = settings.catalogPath || BUNDLED_PATH;
  if (!force && hash === settings.catalogHash && source === settings.catalogSource && products?.length) {
    return { changed: false, count: products.length };
  }

  const parsed = await parseCatalogXlsx(buf);
  await chrome.storage.local.set({ products: parsed.products, categories: parsed.categories });
  await saveSettings({
    catalogHash: hash,
    catalogSource: source,
    catalogLoadedAt: Date.now(),
    catalogCount: parsed.products.length,
  });
  console.log('[TAF] nap catalog', source, parsed.products.length, 'san pham');
  return { changed: true, count: parsed.products.length };
}

export function refreshIfChanged({ force = false, throttle = false } = {}) {
  if (throttle && !force && Date.now() - lastCheck < THROTTLE_MS) {
    return Promise.resolve({ changed: false, skipped: true });
  }
  if (inflight && !force) return inflight;
  const p = doRefresh(force).finally(() => {
    if (inflight === p) inflight = null;
  });
  inflight = p;
  return p;
}

// Luu duong dan moi (rong = file dong goi) roi nap ngay.
export async function setPath(path) {
  await saveSettings({ catalogPath: String(path || '').trim() });
  return refreshIfChanged({ force: true });
}

export async function getProducts() {
  const { products } = await chrome.storage.local.get('products');
  return products || [];
}

export async function getCategories() {
  const { categories } = await chrome.storage.local.get('categories');
  return categories || [];
}

export async function findProduct(id) {
  const products = await getProducts();
  return products.find((p) => p.id === id) || null;
}
