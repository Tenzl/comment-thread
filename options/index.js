import { getSettings, saveSettings } from '../shared/settings.js';
import { DEFAULT_SYSTEM_PROMPT } from '../background/ai-service.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

const TEXT_FIELDS = ['catalogPath', 'apiKey', 'model', 'apiBase', 'systemPrompt'];
const NUM_FIELDS = ['maxOpComments', 'temperature'];
const BOOL_FIELDS = ['enabled', 'debug'];

function status(el, text, kind) {
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

async function loadForm() {
  const s = await getSettings();
  for (const f of TEXT_FIELDS) $(f).value = s[f] ?? '';
  for (const f of NUM_FIELDS) $(f).value = s[f];
  for (const f of BOOL_FIELDS) $(f).checked = !!s[f];
  showCatalogStatus(s);
}

async function showCatalogStatus(s) {
  const { catalogCount, catalogLoadedAt, catalogSource } = s;
  if (!catalogCount) {
    status($('catalogStatus'), 'Chưa nạp catalog nào.');
    return;
  }
  const { categories } = await chrome.storage.local.get('categories');
  const when = new Date(catalogLoadedAt).toLocaleString('vi-VN');
  const cats = (categories || []).map((c) => c.name + ' (' + c.count + ')').join(', ');
  status(
    $('catalogStatus'),
    'Đang có ' + catalogCount + ' sản phẩm từ ' + (catalogSource || 'data/seeding.xlsx') +
      '. Nạp lúc ' + when + '.' + (cats ? ' Danh mục: ' + cats + '.' : '')
  );
}

$('save').addEventListener('click', async () => {
  const patch = {};
  for (const f of TEXT_FIELDS) patch[f] = $(f).value.trim();
  for (const f of NUM_FIELDS) patch[f] = Number($(f).value);
  for (const f of BOOL_FIELDS) patch[f] = $(f).checked;

  await saveSettings(patch);
  status($('saveStatus'), 'Đã lưu.', 'ok');
  setTimeout(() => status($('saveStatus'), ''), 3000);
});

// Luu duong dan roi doc ngay, khong phai bam Luu truoc.
// Duong dan rong = quay ve file dong goi data/seeding.xlsx.
$('reloadCatalog').addEventListener('click', async () => {
  const path = $('catalogPath').value.trim();
  status($('catalogStatus'), 'Đang đọc...');
  $('fileHelp').hidden = true;

  const res = await send({ type: 'SET_CATALOG_PATH', path });
  if (res.ok) {
    status($('catalogStatus'), 'Đã nạp ' + res.count + ' sản phẩm.', 'ok');
    setTimeout(loadForm, 1500);
  } else {
    status($('catalogStatus'), 'Lỗi: ' + res.error, 'err');
    // Loi de gap nhat va Chrome khong bao gi ro rang, nen hien huong dan thang.
    if (/Allow access to file URLs|Failed to fetch/i.test(res.error)) {
      $('fileHelp').hidden = false;
    }
  }
});

$('testConn').addEventListener('click', async () => {
  await saveSettings({
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(),
    apiBase: $('apiBase').value.trim(),
  });
  status($('connStatus'), 'Đang thử...');
  const res = await send({ type: 'TEST_CONNECTION' });
  status($('connStatus'), res.ok ? 'Kết nối OK.' : 'Lỗi: ' + res.error, res.ok ? 'ok' : 'err');
});

$('loadDefaultPrompt').addEventListener('click', () => {
  $('systemPrompt').value = DEFAULT_SYSTEM_PROMPT;
});

$('clearPrompt').addEventListener('click', async () => {
  $('systemPrompt').value = '';
  await saveSettings({ systemPrompt: '' });
  status($('saveStatus'), 'Đã quay lại prompt mặc định.', 'ok');
});

loadForm();

// ---- Nhat ky AI ----
// Hien nguyen user message da gui va JSON tho model tra ve. Khi comment khong
// dung y, doc o day de biet sai o buoc nao: gui thieu du lieu hay model viet do.

function fmtTime(ts) {
  return new Date(ts).toLocaleString('vi-VN');
}

function pre(text, cls) {
  const el = document.createElement('pre');
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function section(parent, title, text, cls) {
  if (!text) return;
  const h = document.createElement('h4');
  h.textContent = title;
  parent.append(h, pre(text, cls));
}

function renderLog(entries) {
  const box = $('aiLog');
  box.textContent = '';

  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'none';
    p.textContent = 'Chưa có lần gọi AI nào.';
    box.append(p);
    return;
  }

  for (const e of entries) {
    const det = document.createElement('details');

    const sum = document.createElement('summary');
    const tag = document.createElement('span');
    if (e.error) {
      tag.className = 'tag error';
      tag.textContent = 'LỖI';
    } else if (e.outcome === 'skipped' || !e.productId) {
      tag.className = 'tag skipped';
      tag.textContent = 'BỎ QUA';
    } else {
      tag.className = 'tag filled';
      tag.textContent = e.productId;
    }

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = '@' + (e.author || '?') + ' — ' + (e.postText || '').slice(0, 70);

    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = fmtTime(e.at);

    sum.append(tag, who, when);
    det.append(sum);

    const body = document.createElement('div');
    body.className = 'body';

    const meta = [];
    if (e.productName) meta.push('Sản phẩm: ' + e.productName);
    const cats = e.categories || (e.category ? [e.category] : []);
    if (cats.length) meta.push('Danh mục: ' + cats.join(', ') + (e.productCount ? ' (' + e.productCount + ' sản phẩm gửi lên)' : ''));
    meta.push('Comment của chủ post gửi lên: ' + (e.opCommentCount || 0));
    if (e.maxLinks) meta.push('Số link tối đa: ' + e.maxLinks);
    if (e.rejected && e.rejected.length) meta.push('Mã bị loại (ngoài danh mục): ' + e.rejected.join(', '));
    if (e.usage) {
      meta.push(
        'Token: ' + (e.usage.prompt_tokens || 0) + ' vào / ' + (e.usage.completion_tokens || 0) + ' ra'
      );
    }
    if (e.permalink) meta.push(e.permalink);
    section(body, 'Thông tin', meta.join('\n'));

    if (e.error) section(body, 'Lỗi', e.error, 'err');
    if (e.reason) section(body, 'Lý do AI đưa ra', e.reason);
    section(body, 'Comment cuối cùng (đã ghép link)', e.finalComment, 'final');
    section(body, 'Nội dung đã gửi lên AI', e.userMessage);
    section(body, 'JSON thô model trả về', e.raw);

    det.append(body);
    box.append(det);
  }
}

async function loadLog() {
  const res = await send({ type: 'LIST_AI_LOG' });
  renderLog((res && res.log) || []);
}

$('refreshLog').addEventListener('click', loadLog);

$('clearLog').addEventListener('click', async () => {
  if (!confirm('Xoá toàn bộ nhật ký AI?')) return;
  await send({ type: 'CLEAR_AI_LOG' });
  loadLog();
});


loadLog();
