// Penulis .xlsx minimal (tanpa pustaka luar) untuk rekap laporan guru.
// Sel: string, angka, {tanggal:'YYYY-MM-DD'}, {angka:n, format:'uang'}, {teks, tautan}.

import zlib from 'node:zlib';

const TABEL_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABEL_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(berkas) {
  const lokal = [], pusat = [];
  let offset = 0;
  for (const [nama, isi] of berkas) {
    const data = Buffer.from(isi, 'utf8'), padat = zlib.deflateRawSync(data), crc = crc32(data);
    const n = Buffer.from(nama, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(padat.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(padat.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    lokal.push(h, n, padat); pusat.push(c, n);
    offset += 30 + n.length + padat.length;
  }
  const cd = Buffer.concat(pusat), akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0); akhir.writeUInt16LE(berkas.length, 8); akhir.writeUInt16LE(berkas.length, 10);
  akhir.writeUInt32LE(cd.length, 12); akhir.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cd, akhir]);
}

const esc = (s) => String(s)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kolom = (i) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const serial = (ymd) => (Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;

// Gaya: 0 biasa, 1 judul, 2 teks bungkus, 3 tanggal, 4 angka, 5 uang, 6 tautan
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="d mmm yyyy"/><numFmt numFmtId="165" formatCode="&quot;Rp&quot;#,##0"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB8222C"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="7">
<xf/>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="3" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="2" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
</styleSheet>`;

function lembar({ judul, lebar, baris }, tautanKeluar) {
  const xs = [], tautan = [];
  baris.forEach((isi, r) => {
    const sel = isi.map((v, c) => {
      const ref = kolom(c) + (r + 1);
      if (v === null || v === undefined || v === '') return '';
      if (r === 0) return `<c r="${ref}" s="1" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
      if (typeof v === 'number') return `<c r="${ref}" s="4"><v>${v}</v></c>`;
      if (v.tanggal) return /^\d{4}-\d{2}-\d{2}/.test(v.tanggal) ? `<c r="${ref}" s="3"><v>${serial(v.tanggal)}</v></c>` : '';
      if (v.format === 'uang') return v.angka === null || v.angka === undefined ? '' : `<c r="${ref}" s="5"><v>${Number(v.angka)}</v></c>`;
      if (v.tautan) {
        tautan.push({ ref, id: 'rId' + (tautanKeluar.length + 1) });
        tautanKeluar.push(v.tautan);
        return `<c r="${ref}" s="6" t="inlineStr"><is><t>${esc(v.teks)}</t></is></c>`;
      }
      return `<c r="${ref}" s="2" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    xs.push(`<row r="${r + 1}"${r === 0 ? ' ht="30" customHeight="1"' : ''}>${sel}</row>`);
  });
  const akhir = kolom(Math.max(1, baris[0].length) - 1) + Math.max(1, baris.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xs.join('')}</sheetData>
${baris.length > 1 ? `<autoFilter ref="A1:${akhir}"/>` : ''}
${tautan.length ? `<hyperlinks>${tautan.map((t) => `<hyperlink ref="${t.ref}" r:id="${t.id}"/>`).join('')}</hyperlinks>` : ''}
</worksheet>`;
}

// lembarList: [{judul, lebar:[...], baris:[[header...], [sel...], ...]}]
export function buatXlsx(lembarList) {
  const berkas = [];
  const ct = lembarList.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  berkas.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ct}</Types>`]);
  berkas.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  berkas.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${lembarList.map((l, i) => `<sheet name="${esc(l.judul)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${lembarList.map((l, i) => l.baris.length > 1 ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(l.judul)}'!$A$1:$${kolom(l.baris[0].length - 1)}$${l.baris.length}</definedName></definedNames>` : '').join('').replace(/<\/definedNames><definedNames>/g, '')}</workbook>`]);
  berkas.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${lembarList.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${lembarList.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  berkas.push(['xl/styles.xml', STYLES]);
  lembarList.forEach((l, i) => {
    const keluar = [];
    berkas.push([`xl/worksheets/sheet${i + 1}.xml`, lembar(l, keluar)]);
    if (keluar.length) berkas.push([`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${keluar.map((t, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(t)}" TargetMode="External"/>`).join('')}</Relationships>`]);
  });
  return zip(berkas);
}
