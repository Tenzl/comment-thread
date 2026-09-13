const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

let posted = [];

function fmtTime(ts) {
  return new Date(ts).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function catalogMsg(text, kind) {
  const el = $('catalogMsg');
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
  el.hidden = !text;
}

// ---------- Bat / tat ----------

function showEnabled(on) {
  $('enabled').checked = on;
  $('enabledText').textContent = on ? 'Đang bật' : 'Đang tắt';
}

$('enabled').addEventListener('change', async () => {
  const on = $('enabled').checked;
  showEnabled(on);
  await send({ type: 'SAVE_SETTINGS', patch: { enabled: on } });
});

// ---------- Thong ke ----------

async function loadStats() {
  const res = await send({ type: 'GET_STATS' });
  const s = (res && res.stats) || { total: {} };
  $('totalOpened').textContent = s.total.opened || 0;
  $('totalPosted').textContent = s.total.posted || 0;
}

// ---------- Catalog ----------

function showCatalog(settings, categories) {
  const n = settings.catalogCount || 0;
  const source = settings.catalogPath
    ? settings.catalogPath.split(/[\\/]/).pop()
    : 'seeding.xlsx';
  const when = settings.catalogLoadedAt
    ? ' · nạp ' + fmtTime(settings.catalogLoadedAt)
    : '';
  $('catalogInfo').textContent = n ? n + ' sản phẩm · ' + source + when : 'Chưa nạp catalog';
  $('catalogInfo').title = settings.catalogPath || 'data/seeding.xlsx';
  $('catalogCats').textContent = (categories || [])
    .map((c) => c.name + ' (' + c.count + ')')
    .join(' · ');
}

async function refreshCatalog(force) {
  $('reload').disabled = true;
  if (force) catalogMsg('Đang đọc lại file…');
  const res = await send({ type: 'REFRESH_CATALOG', force });
  const s = await send({ type: 'GET_SETTINGS' });
  $('reload').disabled = false;

  if (!res || !res.ok) {
    catalogMsg('Lỗi: ' + ((res && res.error) || 'không rõ'), 'err');
  } else if (force) {
    catalogMsg('Đã nạp ' + res.count + ' sản phẩm.', 'ok');
  } else if (res.changed) {
    catalogMsg('File Excel đã thay đổi, đã cập nhật.', 'ok');
  } else {
    catalogMsg('');
  }
  showCatalog((s && s.settings) || {}, res && res.categories);
}

$('reload').addEventListener('click', () => refreshCatalog(true));

// ---------- Bai da dang ----------

function renderPosted() {
  const list = $('postedList');
  list.textContent = '';
  $('postedCount').textContent = posted.length;
  $('postedEmpty').hidden = posted.length > 0;
  $('copyLinks').disabled = posted.length === 0;

  for (const p of posted) {
    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = p.permalink;
    a.title = p.postText || p.permalink;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: p.permalink });
    });

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = '@' + (p.author || '?') + ' — ' + (p.postText || '').slice(0, 60);

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = [p.productName, fmtTime(p.postedAt)].filter(Boolean).join(' · ');

    a.append(who, meta);

    const del = document.createElement('button');
    del.className = 'icon';
    del.textContent = '✕';
    del.title = 'Xoá khỏi danh sách';
    del.setAttribute('aria-label', 'Xoá khỏi danh sách');
    del.addEventListener('click', async () => {
      await send({ type: 'REMOVE_POSTED', postId: p.postId });
      loadPosted();
    });

    li.append(a, del);
    list.append(li);
  }
}

async function loadPosted() {
  const res = await send({ type: 'LIST_POSTED' });
  posted = (res && res.posted) || [];
  renderPosted();
}

$('copyLinks').addEventListener('click', async () => {
  const text = posted.map((p) => p.permalink).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('copyLinks').textContent = 'Đã chép ' + posted.length + ' link';
  } catch (e) {
    $('copyLinks').textContent = 'Chép lỗi';
  }
  setTimeout(() => ($('copyLinks').textContent = 'Chép tất cả link'), 1600);
});

$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.stats) loadStats();
  if (changes.posted) loadPosted();
});

(async function init() {
  const res = await send({ type: 'GET_SETTINGS' });
  const settings = (res && res.settings) || {};
  showEnabled(settings.enabled !== false);
  showCatalog(settings, []);
  loadStats();
  loadPosted();
  // Mo popup la dip kiem tra file Excel co bi sua khong.
  refreshCatalog(false);
})();
