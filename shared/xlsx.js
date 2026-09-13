// Doc file .xlsx khong can thu vien.
// xlsx la file zip chua cac file XML. Giai nen bang DecompressionStream
// ('deflate-raw') co san trong Chrome, parse XML bang regex vi service worker
// khong co DOMParser.

// ---------- Zip ----------

function u16(v, o) {
  return v.getUint16(o, true);
}
function u32(v, o) {
  return v.getUint32(o, true);
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Tra ve Map ten file -> ham doc noi dung dang text.
function readZipIndex(buf) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  // End of central directory nam trong 65557 byte cuoi.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('File khong phai .xlsx hop le (khong doc duoc zip).');

  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map();

  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) break;
    const method = u16(view, p + 10);
    const compSize = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    entries.set(name, async () => {
      const lNameLen = u16(view, localOffset + 26);
      const lExtraLen = u16(view, localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.subarray(start, start + compSize);
      let raw;
      if (method === 0) raw = data;
      else if (method === 8) raw = await inflateRaw(data);
      else throw new Error('Kieu nen zip khong ho tro: ' + method);
      return decoder.decode(raw);
    });

    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------- XML ----------

function unescapeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function attr(tag, name) {
  const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return m ? unescapeXml(m[1]) : null;
}

// Gom moi <t> trong mot khoi, bo qua phien am <rPh>.
function textOf(xml) {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(clean))) out += m[1];
  return unescapeXml(out);
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si>([\s\S]*?)<\/si>|<si\/>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1] ? textOf(m[1]) : '');
  return out;
}

function parseRels(xml) {
  const map = {};
  if (!xml) return map;
  const re = /<Relationship\b[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const id = attr(m[0], 'Id');
    if (id) map[id] = attr(m[0], 'Target');
  }
  return map;
}

// "AB12" -> { col: 27, row: 12 }  (col bat dau tu 0)
function splitRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref || '');
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) };
}

// Tra ve { rows: Map<rowNumber, string[]>, links: Map<"row:col", url> }
function parseSheet(xml, strings, rels) {
  const rows = new Map();
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cellRe.exec(xml))) {
    const head = '<c' + m[1] + '>';
    const pos = splitRef(attr(head, 'r'));
    if (!pos) continue;
    const type = attr(head, 't');
    const inner = m[2] || '';

    let value = '';
    if (type === 'inlineStr') {
      value = textOf(inner);
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      if (v) {
        value = type === 's' ? strings[Number(v[1])] || '' : unescapeXml(v[1]);
      }
    }

    if (!rows.has(pos.row)) rows.set(pos.row, []);
    rows.get(pos.row)[pos.col] = value;
  }

  const links = new Map();
  const linkRe = /<hyperlink\b[^>]*>/g;
  while ((m = linkRe.exec(xml))) {
    const pos = splitRef(attr(m[0], 'ref'));
    const id = attr(m[0], 'r:id');
    if (pos && id && rels[id]) links.set(pos.row + ':' + pos.col, rels[id]);
  }

  return { rows, links };
}

// ---------- Catalog ----------

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .toLowerCase()
    .trim();
}

// Tim dong header trong 10 dong dau: phai co cot ten san pham va cot link.
function findHeader(rows) {
  const nums = [...rows.keys()].sort((a, b) => a - b).slice(0, 10);
  for (const r of nums) {
    const cells = (rows.get(r) || []).map(norm);
    const name = cells.findIndex((c) => c.includes('ten san pham'));
    const link = cells.findIndex((c) => c.includes('link'));
    if (name !== -1 && link !== -1) {
      return {
        row: r,
        stt: cells.findIndex((c) => c === 'stt'),
        name,
        link,
        note: cells.findIndex((c) => c === 'note' || c.includes('mo ta')),
      };
    }
  }
  return null;
}

// Doc toan bo workbook thanh { products, categories }.
// Moi sheet co header hop le la mot danh muc, ten danh muc = ten sheet.
export async function parseCatalogXlsx(buf) {
  const zip = readZipIndex(buf);
  const read = async (name) => (zip.has(name) ? zip.get(name)() : null);

  const workbook = await read('xl/workbook.xml');
  if (!workbook) throw new Error('File .xlsx thieu xl/workbook.xml.');

  const wbRels = parseRels(await read('xl/_rels/workbook.xml.rels'));
  const strings = parseSharedStrings(await read('xl/sharedStrings.xml'));

  const products = [];
  const categories = [];
  const usedIds = new Set();

  const sheetTags = workbook.match(/<sheet\b[^>]*>/g) || [];
  let sheetIndex = 0;

  for (const tag of sheetTags) {
    sheetIndex++;
    // Sheet an (Hide) trong Excel khong thanh danh muc.
    if (attr(tag, 'state') === 'hidden' || attr(tag, 'state') === 'veryHidden') continue;
    const category = (attr(tag, 'name') || 'Sheet ' + sheetIndex).trim();
    const target = wbRels[attr(tag, 'r:id')];
    if (!target) continue;

    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = await read(path);
    if (!xml) continue;

    const relsPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
    const { rows, links } = parseSheet(xml, strings, parseRels(await read(relsPath)));
    const h = findHeader(rows);
    if (!h) continue;

    let count = 0;
    const rowNums = [...rows.keys()].filter((r) => r > h.row).sort((a, b) => a - b);
    for (const r of rowNums) {
      const cells = rows.get(r) || [];
      const name = String(cells[h.name] || '').replace(/\s+/g, ' ').trim();
      let url = String(cells[h.link] || '').trim();
      if (!/^https?:\/\//i.test(url)) url = links.get(r + ':' + h.link) || '';
      if (!name || !/^https?:\/\//i.test(url)) continue;

      const stt = h.stt !== -1 ? String(cells[h.stt] || '').trim() : '';
      let id = sheetIndex + '-' + (stt || r);
      if (usedIds.has(id)) id = sheetIndex + '-r' + r;
      usedIds.add(id);

      products.push({
        id,
        name,
        category,
        description: h.note !== -1 ? String(cells[h.note] || '').trim() : '',
        url,
      });
      count++;
    }

    if (count) categories.push({ name: category, count });
  }

  if (!products.length) {
    throw new Error(
      'Khong doc duoc san pham nao. Moi sheet can dong tieu de co cot "Tên sản phẩm" va "Link".'
    );
  }
  return { products, categories };
}

export async function sha256(buf) {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Chrome khong cho fetch duong dan Windows truc tiep, phai doi sang file:// URL.
export function toFileUrl(path) {
  let p = String(path || '').trim();
  if (!p) throw new Error('Chua nhap duong dan file .xlsx.');
  if (/^file:\/\//i.test(p)) return p;

  p = p.split(String.fromCharCode(92)).join('/');
  if (!p.startsWith('/')) p = '/' + p; // D:/a/b.xlsx -> /D:/a/b.xlsx
  return 'file://' + p.split('/').map(encodeURIComponent).join('/').replace(/%3A/gi, ':');
}
