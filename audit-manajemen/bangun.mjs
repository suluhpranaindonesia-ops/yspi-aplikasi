// Membuat laporan hasil audit (md + xlsx) dari pemeriksaan terakhir (data\hasil-terakhir.json).
// Pakai: node bangun.mjs → keluaran\Laporan-Audit-Teknis-YSPI.md / .xlsx
// node bangun.mjs --ke-vault → juga memperbarui vault DRAFT\Audit Management Checker\ (dipakai pemantau).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { RANAH, semuaButir } from './butir.mjs';
import { KERJA, VAULT } from './cek.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const KELUARAN = path.join(DIR, 'keluaran'); // bukan hasil\ agar .md polos tidak disentuh pengawas konversi
const NAMA = 'Laporan-Audit-Teknis-YSPI';
const sumber = path.join(KERJA, 'audit-manajemen', 'data', 'hasil-terakhir.json');
const data = fs.existsSync(sumber) ? JSON.parse(fs.readFileSync(sumber, 'utf8')) : { hasil: {} };
const butir = semuaButir().map((b) => ({ ...b, ...(data.hasil[b.id] || { status: '—', ringkas: 'Belum diperiksa.', detail: '' }) }));
const waktu = data.waktu ? new Date(data.waktu).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'belum pernah';
const hitung = (arr, s) => arr.filter((b) => b.status === s).length;

// ---------- Markdown ----------
function bangunMd() {
  const L = ['# Laporan Audit Teknis — YSPI', ''];
  L.push('| Field | Isi |', '|---|---|', `| Diperiksa | ${waktu} (otomatis oleh Audit Management Checker) |`,
    `| Hasil | ${hitung(butir, 'Masalah')} Masalah · ${hitung(butir, 'Peringatan')} Peringatan · ${hitung(butir, 'OK')} OK |`,
    '| Status dokumen | DRAFT buatan AI |', '');
  const perlu = butir.filter((b) => b.status === 'Masalah' || b.status === 'Peringatan').sort((a, b) => (a.status === 'Masalah' ? -1 : 1) - (b.status === 'Masalah' ? -1 : 1));
  L.push('## Perlu diperbaiki', '');
  if (!perlu.length) L.push('Tidak ada.', '');
  for (const b of perlu) {
    L.push(`### ${b.id} ${b.judul} — **${b.status}**`, '', b.ringkas, '', `**Yang perlu diperbaiki:** ${b.saran}`, '');
    if (b.detail) L.push('```', b.detail, '```', '');
  }
  L.push('## Semua pemeriksaan', '');
  for (const r of RANAH) {
    L.push(`### ${r.kode}. ${r.nama}`, '', '| ID | Pemeriksaan | Status | Ringkas |', '|---|---|---|---|');
    for (const b of butir.filter((x) => x.ranah === r.nama)) L.push(`| ${b.id} | ${b.judul} | ${b.status} | ${b.ringkas.replace(/\|/g, '/')} |`);
    L.push('');
  }
  return L.join('\n');
}

// ---------- XLSX ----------
const TABEL_CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABEL_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(berkas) {
  const lokal = [], pusat = []; let offset = 0;
  for (const [nama, isi] of berkas) {
    const d = Buffer.from(isi, 'utf8'), padat = zlib.deflateRawSync(d), crc = crc32(d), n = Buffer.from(nama, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(padat.length, 18); h.writeUInt32LE(d.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(padat.length, 20); c.writeUInt32LE(d.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    lokal.push(h, n, padat); pusat.push(c, n); offset += 30 + n.length + padat.length;
  }
  const cd = Buffer.concat(pusat), akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0); akhir.writeUInt16LE(berkas.length, 8); akhir.writeUInt16LE(berkas.length, 10);
  akhir.writeUInt32LE(cd.length, 12); akhir.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cd, akhir]);
}
const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kol = (i) => String.fromCharCode(65 + i);
// Gaya: 0 biasa, 1 kepala, 2 bungkus, 3 judul, 4 OK, 5 Peringatan, 6 Masalah
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E5F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3F4EA"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDF1D8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE7E5"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="7"><xf/>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="2" applyFont="1"/>
<xf fillId="3" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fillId="4" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fillId="5" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs></styleSheet>`;
const GAYA_STATUS = { OK: 4, Peringatan: 5, Masalah: 6 };
function lembar(lebar, baris) {
  const rows = baris.map((isi, r) => `<row r="${r + 1}">${isi.map((v, c) => {
    if (v === '' || v == null) return '';
    const [teks, s] = Array.isArray(v) ? v : [v, r === 0 ? 1 : 2];
    return `<c r="${kol(c)}${r + 1}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(teks)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`;
}
function bangunXlsx() {
  const hasil = [['ID', 'Ranah', 'Pemeriksaan', 'Status', 'Ringkas', 'Yang perlu diperbaiki', 'Rincian'],
    ...butir.map((b) => [b.id, b.ranah, b.judul, [b.status, GAYA_STATUS[b.status] ?? 2], b.ringkas, b.status === 'OK' ? '' : b.saran, (b.detail || '').slice(0, 30000)])];
  const ringkas = [[['Laporan Audit Teknis — YSPI', 3]], [`Diperiksa: ${waktu}`], [],
    ['Ranah', 'Masalah', 'Peringatan', 'OK'],
    ...RANAH.map((r) => { const a = butir.filter((b) => b.ranah === r.nama); return [r.nama, String(hitung(a, 'Masalah')), String(hitung(a, 'Peringatan')), String(hitung(a, 'OK'))]; }),
    ['Total', String(hitung(butir, 'Masalah')), String(hitung(butir, 'Peringatan')), String(hitung(butir, 'OK'))]];
  ringkas[3] = ringkas[3].map((t) => [t, 1]);
  const lembarList = [['Ringkasan', [30, 10, 12, 8], ringkas], ['Hasil', [6, 22, 40, 12, 50, 50, 70], hasil]];
  const berkas = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${lembarList.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${lembarList.map(([n], i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${lembarList.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${lembarList.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...lembarList.map(([, lebar, baris], i) => [`xl/worksheets/sheet${i + 1}.xml`, lembar(lebar, baris)]),
  ];
  return zip(berkas);
}

fs.mkdirSync(KELUARAN, { recursive: true });
fs.writeFileSync(path.join(KELUARAN, `${NAMA}.md`), bangunMd(), 'utf8');
fs.writeFileSync(path.join(KELUARAN, `${NAMA}.xlsx`), bangunXlsx());
console.log(`Laporan dari pemeriksaan ${waktu}: ${hitung(butir, 'Masalah')} Masalah, ${hitung(butir, 'Peringatan')} Peringatan, ${hitung(butir, 'OK')} OK`);
console.log('Ditulis:', path.join(KELUARAN, `${NAMA}.md`), path.join(KELUARAN, `${NAMA}.xlsx`));

// --ke-vault (dipakai pemantau setelah tiap audit): salin ke folder laporan khusus di vault DRAFT,
// ditimpa tiap putaran seperti rekap Laporan Guru. Jangan menaruh berkas lain di folder itu.
if (process.argv.includes('--ke-vault')) {
  const TUJUAN = path.join(VAULT, 'DRAFT', 'Audit Management Checker');
  fs.mkdirSync(TUJUAN, { recursive: true });
  for (const ext of ['md', 'xlsx']) {
    const ke = path.join(TUJUAN, `${NAMA}.${ext}`);
    fs.copyFileSync(path.join(KELUARAN, `${NAMA}.${ext}`), ke + '.tmp');
    fs.renameSync(ke + '.tmp', ke);
  }
  console.log('Diperbarui di vault:', TUJUAN);
}
