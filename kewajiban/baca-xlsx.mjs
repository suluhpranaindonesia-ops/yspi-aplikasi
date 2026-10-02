// Pembaca .xlsx tanpa Python dan tanpa pustaka tambahan: unzip lewat zlib
// bawaan Node, lalu XML lembar dibaca dengan regex. Hanya MEMBACA — tidak ada
// fungsi tulis di berkas ini, jadi workbook tidak mungkin berubah karenanya.
import fs from 'node:fs';
import zlib from 'node:zlib';

function unzip(buf) {
  // Cari End Of Central Directory dari belakang.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw Error('Bukan berkas zip/xlsx yang sah.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw Error('Direktori zip rusak.');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files.set(name, () => (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8'));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? unesc(m[1]) : undefined; };
const texts = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map(m => unesc(m[1] || '')).join('');

// Sel: { v: nilai tersimpan (angka/teks/boolean/null), f: rumus tanpa "=" atau undefined }
export function bacaWorkbook(file) {
  const z = unzip(fs.readFileSync(file));
  const get = n => z.has(n) ? z.get(n)() : '';
  const shared = [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
  const rels = new Map([...get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(m => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const sheets = new Map();
  for (const m of get('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name'), rid = attr(m[0], 'r:id');
    let target = rels.get(rid) || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    sheets.set(name, target);
  }
  const cache = new Map();
  function sheet(name) {
    if (!sheets.has(name)) throw Error(`Lembar "${name}" tidak ada di workbook.`);
    if (cache.has(name)) return cache.get(name);
    const cells = new Map(); let maxRow = 0;
    const xml = get(sheets.get(name));
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = '<c' + m[1] + '>', body = m[2] || '';
      const ref = attr(head, 'r'), t = attr(head, 't');
      const fm = body.match(/<f\b[^>]*>([\s\S]*?)<\/f>/), vm = body.match(/<v>([\s\S]*?)<\/v>/);
      let v = null;
      if (t === 's' && vm) v = shared[+vm[1]];
      else if (t === 'inlineStr') v = texts(body);
      else if (t === 'str' && vm) v = unesc(vm[1]);
      else if (t === 'b' && vm) v = vm[1] === '1';
      else if (t === 'e') v = null;
      else if (vm) v = Number(vm[1]);
      cells.set(ref, { v, f: fm ? unesc(fm[1]) : undefined });
      maxRow = Math.max(maxRow, +ref.match(/\d+/)[0]);
    }
    const s = { name, cells, maxRow, cell: ref => cells.get(ref) || { v: null } };
    cache.set(name, s);
    return s;
  }
  return { names: [...sheets.keys()], sheet };
}

// Nomor seri Excel (sistem 1900) -> 'YYYY-MM-DD'. Teks tanggal ISO dibiarkan.
export function keTanggal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}
