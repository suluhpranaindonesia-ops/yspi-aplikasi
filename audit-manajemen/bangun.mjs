// Membangun Audit Management Checker versi .md dan .xlsx dari butir.mjs.
// Pakai: node bangun.mjs  → keluaran\Audit-Management-Checker-YSPI.md / .xlsx

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { RANAH, SKALA, semuaButir } from './butir.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// Bukan hasil\ agar .md polos tidak disentuh pengawas konversi; berkas jadi lalu dipindah ke vault DRAFT.
const HASIL = path.join(DIR, 'keluaran');
const NAMA = 'Audit-Management-Checker-YSPI';
const butir = semuaButir();

// ---------- Markdown ----------
function bangunMd() {
  const L = [];
  L.push('# Audit Management Checker — YSPI', '');
  L.push('| Field | Isi |', '|---|---|');
  L.push('| Cakupan | Tata Kelola · Keuangan · Sistem & Data |');
  L.push(`| Jumlah butir | ${butir.length} |`);
  L.push('| Periode audit | ____________ |', '| Pemeriksa | ____________ |', '| Tanggal | ____________ |');
  L.push('| Status dokumen | DRAFT buatan AI — belum disahkan pengurus |', '');
  L.push('## Cara menilai', '');
  L.push('Isi kolom **Status** dengan salah satu: **Memenuhi** (2) · **Sebagian** (1) · **Belum** (0) · **N/A** (tidak dihitung).');
  L.push('Skor bagian = jumlah nilai ÷ (2 × butir yang dinilai). Tulis bukti yang benar-benar dilihat, bukan dugaan.', '');
  L.push('Kolom **Dasar**: `vault` = butir diturunkan dari catatan YSPI (rujukan disebut); `umum` = praktik umum tata kelola yayasan, **bukan dari sumber YSPI** — sesuaikan atau tandai N/A.', '');
  L.push('Versi Excel menghitung skor otomatis; versi web lokal juga menjalankan cek sistem otomatis (layanan, sinkron, lint, state.md).', '');
  for (const r of RANAH) {
    L.push(`## ${r.kode}. ${r.nama}`, '');
    for (const b of r.bagian) {
      L.push(`### ${b.kode} ${b.nama}`, '');
      L.push('| ID | Kriteria | Bukti yang diharapkan | Dasar / rujukan | Status | Catatan & tindak lanjut |', '|---|---|---|---|---|---|');
      b.butir.forEach(([k, bk, d, rj], i) => {
        const dasar = d === 'umum' ? '`umum`' : `\`vault\` ${rj}`;
        L.push(`| ${b.kode}.${i + 1} | ${k} | ${bk} | ${dasar.replace(/\|/g, '/')} | ☐ | |`);
      });
      L.push('', `Skor ${b.kode}: ____ / ____`, '');
    }
  }
  L.push('## Rekap', '', '| Ranah | Skor | Maks | % | Catatan |', '|---|---|---|---|---|');
  for (const r of RANAH) L.push(`| ${r.kode}. ${r.nama} | | | | |`);
  L.push('| **Total** | | | | |', '');
  L.push('Panduan baca: ≥ 80% baik · 60–79% perlu perbaikan · < 60% prioritas.', '');
  L.push('## Tindak lanjut', '', '| No | ID butir | Tindakan | PIC | Tenggat | Status |', '|---|---|---|---|---|---|');
  for (let i = 1; i <= 5; i++) L.push(`| ${i} | | | | | |`);
  L.push('');
  return L.join('\n');
}

// ---------- XLSX (dengan dropdown & rumus) ----------
const TABEL_CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABEL_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(berkas) {
  const lokal = [], pusat = []; let offset = 0;
  for (const [nama, isi] of berkas) {
    const data = Buffer.from(isi, 'utf8'), padat = zlib.deflateRawSync(data), crc = crc32(data), n = Buffer.from(nama, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(padat.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(padat.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    lokal.push(h, n, padat); pusat.push(c, n); offset += 30 + n.length + padat.length;
  }
  const cd = Buffer.concat(pusat), akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0); akhir.writeUInt16LE(berkas.length, 8); akhir.writeUInt16LE(berkas.length, 10);
  akhir.writeUInt32LE(cd.length, 12); akhir.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cd, akhir]);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kol = (i) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

// Gaya: 0 biasa, 1 kepala, 2 bungkus, 3 judul besar, 4 isian (kuning), 5 persen, 6 sub-judul tebal
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E5F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D5"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="7">
<xf/>
<xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="2" applyFont="1"/>
<xf fillId="3" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="9" borderId="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="3" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;

// sel: string | number | {f:'rumus', s} | {v, s}
function sel(ref, v, sDefault) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.f) return `<c r="${ref}" s="${v.s ?? sDefault}"><f>${esc(v.f)}</f></c>`;
  const s = typeof v === 'object' ? v.s : sDefault, isi = typeof v === 'object' ? v.v : v;
  if (isi === '' || isi === undefined) return `<c r="${ref}" s="${s}"/>`;
  if (typeof isi === 'number') return `<c r="${ref}" s="${s}"><v>${isi}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(isi)}</t></is></c>`;
}
function lembar({ lebar, baris, beku, validasi = [], filter }) {
  const rows = baris.map(({ isi, s = 2, tinggi }, r) =>
    `<row r="${r + 1}"${tinggi ? ` ht="${tinggi}" customHeight="1"` : ''}>${isi.map((v, c) => sel(kol(c) + (r + 1), v, s)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0">${beku ? `<pane ySplit="${beku}" topLeftCell="A${beku + 1}" activePane="bottomLeft" state="frozen"/>` : ''}</sheetView></sheetViews>
<cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows}</sheetData>
${filter ? `<autoFilter ref="${filter}"/>` : ''}
${validasi.length ? `<dataValidations count="${validasi.length}">${validasi.map((v) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${v.ref}"><formula1>${esc(v.daftar)}</formula1></dataValidation>`).join('')}</dataValidations>` : ''}
</worksheet>`;
}
function buatXlsx(lembarList) {
  const berkas = [];
  berkas.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${lembarList.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
  berkas.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  const filterNames = lembarList.map((l, i) => l.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(l.judul)}'!${l.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '').join('');
  berkas.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${lembarList.map((l, i) => `<sheet name="${esc(l.judul)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filterNames ? `<definedNames>${filterNames}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`]);
  berkas.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${lembarList.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${lembarList.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  berkas.push(['xl/styles.xml', STYLES]);
  lembarList.forEach((l, i) => berkas.push([`xl/worksheets/sheet${i + 1}.xml`, lembar(l)]));
  return zip(berkas);
}

function bangunXlsx() {
  // Lembar Checklist: A ID, B Ranah, C Bagian, D Kriteria, E Bukti diharapkan, F Dasar, G Rujukan, H Status, I Nilai, J Bukti dilihat, K Tindak lanjut, L PIC, M Tenggat
  const kepala = ['ID', 'Ranah', 'Bagian', 'Kriteria', 'Bukti yang diharapkan', 'Dasar', 'Rujukan', 'Status', 'Nilai', 'Bukti yang dilihat', 'Tindak lanjut', 'PIC', 'Tenggat'];
  const n = butir.length, akhir = n + 1;
  const baris = [{ isi: kepala, s: 1, tinggi: 30 }];
  butir.forEach((b, i) => {
    const r = i + 2;
    baris.push({ isi: [b.id, b.ranah, b.bagian, b.kriteria, b.bukti, b.dasar, b.rujukan,
      { v: '', s: 4 },
      { f: `IF(H${r}="Memenuhi",2,IF(H${r}="Sebagian",1,IF(H${r}="Belum",0,"")))` },
      { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }] });
  });
  const checklist = {
    judul: 'Checklist', beku: 1, filter: `A1:M${akhir}`,
    lebar: [7, 13, 26, 52, 34, 8, 34, 12, 7, 34, 34, 14, 12],
    baris,
    validasi: [{ ref: `H2:H${akhir}`, daftar: `"${SKALA.map((s) => s.kode).join(',')}"` }],
  };

  // Lembar Rekap: per bagian + per ranah
  const C = `Checklist!$C$2:$C$${akhir}`, B = `Checklist!$B$2:$B$${akhir}`, I = `Checklist!$I$2:$I$${akhir}`, H = `Checklist!$H$2:$H$${akhir}`;
  const rek = [
    { isi: ['Audit Management Checker — YSPI'], s: 3 },
    { isi: ['Periode', { v: '', s: 4 }], s: 6 },
    { isi: ['Pemeriksa', { v: '', s: 4 }], s: 6 },
    { isi: ['Tanggal', { v: '', s: 4 }], s: 6 },
    { isi: [] },
    { isi: ['Bagian', 'Butir', 'Dinilai', 'Skor', 'Maks', '%', 'Belum', 'Kategori'], s: 1, tinggi: 22 },
  ];
  const kategori = (r) => ({ f: `IF(C${r}=0,"—",IF(F${r}>=0.8,"Baik",IF(F${r}>=0.6,"Perlu perbaikan","Prioritas")))` });
  const barisPerRanah = {};
  for (const ra of RANAH) {
    for (const bg of ra.bagian) {
      const r = rek.length + 1, label = `${bg.kode} ${bg.nama}`;
      rek.push({ isi: [label, { f: `COUNTIF(${C},A${r})` }, { f: `SUMPRODUCT((${C}=A${r})*(${H}<>"")*(${H}<>"N/A"))` },
        { f: `SUMIF(${C},A${r},${I})` }, { f: `C${r}*2` }, { f: `IF(E${r}=0,"",D${r}/E${r})`, s: 5 },
        { f: `COUNTIFS(${C},A${r},${H},"Belum")` }, kategori(r)] });
    }
  }
  rek.push({ isi: [] });
  rek.push({ isi: ['Ranah', 'Butir', 'Dinilai', 'Skor', 'Maks', '%', 'Belum', 'Kategori'], s: 1, tinggi: 22 });
  for (const ra of RANAH) {
    const r = rek.length + 1;
    barisPerRanah[ra.kode] = r;
    rek.push({ isi: [ra.nama, { f: `COUNTIF(${B},A${r})` }, { f: `SUMPRODUCT((${B}=A${r})*(${H}<>"")*(${H}<>"N/A"))` },
      { f: `SUMIF(${B},A${r},${I})` }, { f: `C${r}*2` }, { f: `IF(E${r}=0,"",D${r}/E${r})`, s: 5 },
      { f: `COUNTIFS(${B},A${r},${H},"Belum")` }, kategori(r)] });
  }
  const r1 = barisPerRanah.A, r3 = barisPerRanah.C, rt = rek.length + 1;
  rek.push({ isi: ['TOTAL', { f: `SUM(B${r1}:B${r3})` }, { f: `SUM(C${r1}:C${r3})` }, { f: `SUM(D${r1}:D${r3})` }, { f: `SUM(E${r1}:E${r3})` },
    { f: `IF(E${rt}=0,"",D${rt}/E${rt})`, s: 5 }, { f: `SUM(G${r1}:G${r3})` }, kategori(rt)], s: 6 });
  rek.push({ isi: [] });
  rek.push({ isi: ['Nilai: Memenuhi = 2 · Sebagian = 1 · Belum = 0 · N/A tidak dihitung. Kategori: ≥ 80% Baik · 60–79% Perlu perbaikan · < 60% Prioritas.'], s: 0 });
  rek.push({ isi: ['Kolom Dasar "umum" = praktik umum tata kelola yayasan, bukan dari sumber YSPI — sesuaikan atau tandai N/A.'], s: 0 });

  const rekap = { judul: 'Rekap', lebar: [44, 8, 9, 8, 8, 9, 8, 18], baris: rek };

  const tl = [{ isi: ['No', 'ID butir', 'Masalah', 'Tindakan', 'PIC', 'Tenggat', 'Status'], s: 1, tinggi: 22 }];
  for (let i = 1; i <= 25; i++) tl.push({ isi: [i, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }] });
  const tindak = { judul: 'Tindak Lanjut', beku: 1, lebar: [5, 10, 40, 40, 14, 12, 14], baris: tl,
    validasi: [{ ref: 'G2:G26', daftar: '"Terbuka,Berjalan,Selesai,Ditunda"' }] };

  const pd = [
    'Cara pakai',
    '1. Buka lembar Checklist. Isi kolom Status (kuning) dengan dropdown: Memenuhi / Sebagian / Belum / N/A.',
    '2. Tulis "Bukti yang dilihat" sesuai yang benar-benar diperiksa — jangan menulis dugaan.',
    '3. Butir Belum/Sebagian: isi Tindak lanjut, PIC, Tenggat; salin yang penting ke lembar Tindak Lanjut.',
    '4. Lembar Rekap menghitung skor per bagian, per ranah, dan total secara otomatis.',
    '',
    'Kolom Dasar',
    'vault = butir diturunkan dari catatan YSPI (wiki, notulen, persiapan rapat, memori kerja); lihat kolom Rujukan.',
    'umum = praktik umum tata kelola yayasan, BUKAN dari sumber YSPI. Sesuaikan, atau tandai N/A bila tidak relevan.',
    '',
    'Status dokumen: DRAFT buatan AI — belum disahkan pengurus.',
    'Versi web lokal (audit-manajemen di SPI-Kerja) memakai butir yang sama dan menjalankan cek sistem otomatis.',
  ].map((t, i) => ({ isi: [t], s: i === 0 || t === 'Kolom Dasar' ? 3 : 0 }));
  const panduan = { judul: 'Panduan', lebar: [110], baris: pd };

  return buatXlsx([panduan, checklist, rekap, tindak]);
}

fs.mkdirSync(HASIL, { recursive: true });
fs.writeFileSync(path.join(HASIL, `${NAMA}.md`), bangunMd(), 'utf8');
fs.writeFileSync(path.join(HASIL, `${NAMA}.xlsx`), bangunXlsx());
console.log(`Butir: ${butir.length} (vault ${butir.filter((b) => b.dasar === 'vault').length}, umum ${butir.filter((b) => b.dasar === 'umum').length})`);
console.log('Ditulis:', path.join(HASIL, `${NAMA}.md`), path.join(HASIL, `${NAMA}.xlsx`));
