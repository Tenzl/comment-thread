import * as catalog from './catalog.js';
import * as ai from './ai-service.js';
import * as aiLog from './ai-log.js';
import * as stats from './stats.js';
import { getSettings, saveSettings } from '../shared/settings.js';

// Nap catalog khi cai dat va moi lan Chrome khoi dong. File khong doi thi
// chi ton mot lan doc va bam hash.
function refreshOnBoot(reason) {
  catalog
    .refreshIfChanged()
    .then((r) => console.log('[TAF]', reason, r))
    .catch((e) => console.warn('[TAF] nap catalog loi:', e.message));
}
chrome.runtime.onInstalled.addListener(() => refreshOnBoot('cai dat'));
chrome.runtime.onStartup.addListener(() => refreshOnBoot('khoi dong'));

// Mot link: chi dan URL. Nhieu link: moi dong "label: URL" de nguoi doc biet link nao la mon nao.
function formatLinks(chosen) {
  if (chosen.length === 1) return chosen[0].product.url;
  return chosen
    .map(({ product, label }) => (label || shortName(product.name)) + ': ' + product.url)
    .join('\n');
}

// Cau mo, moi mon mot dong "URL cam nhan", cau chot.
// Mon nao AI khong viet line thi dong do chi co URL.
function assembleComment(intro, chosen, outro) {
  const lines = chosen.map(({ product, line }) => (product.url + ' ' + (line || '')).trim());
  return [intro, ...lines, outro].filter(Boolean).join('\n');
}

function shortName(name) {
  return String(name).split(/\s+/).slice(0, 4).join(' ').toLowerCase();
}

// Moi handler tra ve mot object ket qua. Loi duoc bat o mot cho duy nhat ben duoi.
const handlers = {
  async GENERATE_COMMENT(msg) {
    const payload = msg.payload || {};
    const post = payload.post || {};
    const postId = post.postId;

    // File Excel vua sua thi lay ban moi truoc khi gui AI.
    try {
      await catalog.refreshIfChanged({ throttle: true });
    } catch (e) {
      console.warn('[TAF] khong kiem tra lai duoc catalog:', e.message);
    }

    // Giu thu tu theo sheet trong file, de khoi danh sach gui AI luon giong nhau.
    const all = await catalog.getCategories();
    const wanted = Array.isArray(payload.categories) ? payload.categories : [payload.category];
    const categories = all.map((c) => c.name).filter((n) => wanted.includes(n));

    const products = (await catalog.getProducts()).filter((p) => categories.includes(p.category));
    if (!categories.length || !products.length) {
      throw new Error(
        'Danh muc "' + wanted.join(', ') + '" khong co trong catalog. Bam Reload catalog.'
      );
    }

    await stats.markOpened(postId);

    const logBase = {
      postId,
      author: post.author,
      permalink: post.permalink,
      postText: post.text,
      opCommentCount: (payload.opComments || []).length,
      categories,
      productCount: products.length,
    };

    let result;
    try {
      result = await ai.generateComment({ ...payload, categories, products });
    } catch (e) {
      // Ghi lai ca lan that bai. Day thuong la luc can doc log nhat.
      await aiLog.append({
        ...logBase,
        userMessage: e.userMessage || null,
        raw: e.raw || null,
        error: e.message,
      });
      throw e;
    }

    Object.assign(logBase, {
      userMessage: result.userMessage,
      raw: result.raw,
      usage: result.usage,
      reason: result.reason,
      maxLinks: result.maxLinks,
    });

    // AI tu choi: khong san pham nao trong danh muc lien quan.
    if (!result.picks.length) {
      await aiLog.append({ ...logBase, productId: null, outcome: 'skipped' });
      return { ok: true, productId: null, reason: result.reason };
    }

    // Validate truoc khi dien vao o Reply: khong bao gio dien rac.
    // Ma khong thuoc danh muc da chon hoac trung lap thi bo, vuot so link thi cat.
    const seen = new Set();
    const chosen = [];
    const rejected = [];
    for (const pick of result.picks) {
      const product = products.find((p) => p.id === pick.productId);
      if (!product) {
        rejected.push(pick.productId);
        continue;
      }
      if (seen.has(product.id) || chosen.length >= result.maxLinks) continue;
      seen.add(product.id);
      chosen.push({ product, label: pick.label, line: pick.line });
    }
    const productId = (chosen.length ? chosen.map((c) => c.product.id) : rejected).join(', ');

    if (!chosen.length) {
      const m =
        'AI tra ve ma san pham khong thuoc danh muc da chon (' + categories.join(', ') + '): ' +
        rejected.join(', ');
      await aiLog.append({ ...logBase, productId, error: m });
      throw new Error(m);
    }
    // Dang moi: AI tra intro / line tung mon / outro. Dang cu: ca comment mot cuc.
    const structured = !!(result.intro || chosen.some((c) => c.line));
    // Ban chu chua gan link, de ghi log va kiem tra rong.
    const plain = structured
      ? [result.intro, ...chosen.map((c) => c.line), result.outro].filter(Boolean).join('\n')
      : result.comment;
    if (!plain) {
      const m = 'AI tra ve comment rong.';
      await aiLog.append({ ...logBase, productId, error: m });
      throw new Error(m);
    }

    // Extension tu ghep link tu productId. Neu de AI tu chen, no se bia URL.
    const comment = structured
      ? assembleComment(result.intro, chosen, result.outro)
      : result.comment + '\n\n' + formatLinks(chosen);
    const productName = chosen.map((c) => c.product.name).join(' + ');

    await aiLog.append({
      ...logBase,
      productId,
      productName,
      rejected: rejected.length ? rejected : undefined,
      comment: plain,
      finalComment: comment,
      outcome: 'filled',
    });

    return {
      ok: true,
      productId,
      productIds: chosen.map((c) => c.product.id),
      productName,
      category: [...new Set(chosen.map((c) => c.product.category))].join(', '),
      comment,
      finalComment: comment,
      reason: result.reason,
    };
  },

  async MARK_POSTED(msg) {
    await stats.markPosted(msg.info);
    return { ok: true };
  },

  async GET_STATS() {
    return { ok: true, stats: await stats.summary() };
  },

  async LIST_POSTED() {
    return { ok: true, posted: await stats.listPosted() };
  },

  async REMOVE_POSTED(msg) {
    await stats.removePosted(msg.postId);
    return { ok: true };
  },

  async LIST_AI_LOG() {
    return { ok: true, log: await aiLog.list() };
  },

  async CLEAR_AI_LOG() {
    await aiLog.clear();
    return { ok: true };
  },

  // Popup mo len: kiem tra file co doi khong. force: nut Reload catalog.
  async REFRESH_CATALOG(msg) {
    const r = await catalog.refreshIfChanged({ force: !!msg.force });
    const settings = await getSettings();
    return {
      ok: true,
      changed: !!r.changed,
      count: settings.catalogCount || 0,
      categories: await catalog.getCategories(),
    };
  },

  async SET_CATALOG_PATH(msg) {
    const r = await catalog.setPath(msg.path);
    return { ok: true, count: r.count, categories: await catalog.getCategories() };
  },

  async GET_CATEGORIES() {
    return { ok: true, categories: await catalog.getCategories() };
  },

  async GET_SETTINGS() {
    return { ok: true, settings: await getSettings() };
  },

  async SAVE_SETTINGS(msg) {
    return { ok: true, settings: await saveSettings(msg.patch) };
  },

  async TEST_CONNECTION() {
    await ai.testConnection();
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;

  handler(msg, sender)
    .then(sendResponse)
    .catch((e) => {
      console.error('[TAF]', msg.type, e);
      sendResponse({ ok: false, error: e.message });
    });

  return true; // giu kenh mo cho phan hoi bat dong bo
});
