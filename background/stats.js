// Thong ke: bao nhieu bai da bam Tao (mo) va bao nhieu bai da bam Post (dang).
// Moi bai chi dem mot lan cho moi loai, bam lai khong tang so.
//
// stats  = { posts: { [postId]: { openedAt, postedAt } }, total: { opened, posted } }
// posted = { [postId]: { permalink, author, postText, productId, productName, comment, postedAt } }
// Bai da dang luu vinh vien. Ban ghi chi-mo cu hon 30 ngay thi tia bot.

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

async function getStats() {
  const { stats } = await chrome.storage.local.get('stats');
  return {
    posts: (stats && stats.posts) || {},
    total: { opened: 0, posted: 0, ...((stats && stats.total) || {}) },
  };
}

function prune(posts) {
  const cutoff = Date.now() - KEEP_MS;
  for (const [id, p] of Object.entries(posts)) {
    const last = Math.max(p.openedAt || 0, p.postedAt || 0);
    if (last < cutoff) delete posts[id];
  }
}

export async function markOpened(postId) {
  if (!postId) return;
  const stats = await getStats();
  const rec = stats.posts[postId] || {};
  if (!rec.openedAt) {
    rec.openedAt = Date.now();
    stats.total.opened++;
  }
  stats.posts[postId] = rec;
  prune(stats.posts);
  await chrome.storage.local.set({ stats });
}

export async function markPosted(info) {
  const postId = info && info.postId;
  if (!postId) return;

  const stats = await getStats();
  const rec = stats.posts[postId] || {};
  const now = Date.now();
  if (!rec.openedAt) {
    rec.openedAt = now;
    stats.total.opened++;
  }
  if (!rec.postedAt) {
    rec.postedAt = now;
    stats.total.posted++;
  }
  stats.posts[postId] = rec;

  const { posted } = await chrome.storage.local.get('posted');
  const list = posted || {};
  list[postId] = {
    postId,
    permalink: info.permalink || '',
    author: info.author || '',
    postText: String(info.postText || '').slice(0, 200),
    productId: info.productId || null,
    productName: info.productName || '',
    productIds: info.productIds || (info.productId ? String(info.productId).split(', ') : []),
    category: info.category || '',
    comment: info.comment || '',
    postedAt: (list[postId] && list[postId].postedAt) || now,
  };

  await chrome.storage.local.set({ stats, posted: list });
}

export async function summary() {
  const stats = await getStats();
  return { total: stats.total };
}

export async function listPosted() {
  const { posted } = await chrome.storage.local.get('posted');
  return Object.values(posted || {}).sort((a, b) => b.postedAt - a.postedAt);
}

export async function removePosted(postId) {
  const { posted } = await chrome.storage.local.get('posted');
  const list = posted || {};
  delete list[postId];
  await chrome.storage.local.set({ posted: list });
}
