/* ============================================================
   Ekspor biodata guru ke Excel (.xlsx) — satu sheet per guru,
   lengkap dengan foto.

   Berbeda dengan Export CSV yang berbentuk tabel datar (satu baris
   per sekolah, data guru terulang), berkas ini menampilkan tiap guru
   sebagai lembar biodata tersendiri — enak dicetak dan diarsipkan.

   Susunan kolom di sini sengaja dijaga sama dengan blok detail pada
   js/admin.js. Bila salah satu diubah, ubah juga yang lain.
   ============================================================ */

const MERAH      = 'FFC4202A';
const MERAH_TUA  = 'FF8F1219';
const MERAH_MUDA = 'FFFDF1F1';
const ABU        = 'FF6D6467';
const GARIS      = 'FFE8DEDF';

/* Pustaka ExcelJS ditaruh di dalam proyek, bukan diambil dari CDN, supaya
   tetap jalan di jaringan yang memblokir CDN dan tidak melanggar CSP. */
let pemuat = null;
function muatExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!pemuat) {
    pemuat = new Promise((selesai, gagal) => {
      const skrip = document.createElement('script');
      skrip.src = new URL('./vendor/exceljs.min.js', import.meta.url).href;
      skrip.onload  = () => window.ExcelJS
        ? selesai(window.ExcelJS)
        : gagal(new Error('Pustaka Excel termuat tetapi tidak dikenali.'));
      skrip.onerror = () => gagal(new Error('Berkas js/vendor/exceljs.min.js gagal dimuat.'));
      document.head.appendChild(skrip);
    });
    pemuat.catch(() => { pemuat = null; });
  }
  return pemuat;
}

/* ---------- pembantu ---------- */

const teks = v => (v === null || v === undefined || String(v).trim() === '') ? '—' : String(v);

function tanggalPanjang(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('id-ID', { dateStyle: 'long' });
}

function waktuKirim(v) {
  if (!v) return '—';
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Excel melarang beberapa karakter pada nama sheet dan membatasi 31 huruf. */
function namaSheet(nama, sudahDipakai) {
  const bersih = String(nama || 'Guru').replace(/[\\\/*?:\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  let hasil = (bersih || 'Guru').slice(0, 28);
  let dasar = hasil, urutan = 2;
  while (sudahDipakai.has(hasil.toLowerCase())) {
    hasil = (dasar + ' ' + urutan).slice(0, 31);
    urutan++;
  }
  sudahDipakai.add(hasil.toLowerCase());
  return hasil;
}

/* Susunan biodata: [judul bagian, [[label, pengambil nilai], …]] */
const BAGIAN = [
  ['DATA PRIBADI', [
    ['Nama Lengkap',        g => g.nama],
    ['Jenis Kelamin',       g => g.jenis_kelamin],
    ['Tempat, Tanggal Lahir', g => `${teks(g.tempat_lahir)}, ${tanggalPanjang(g.tanggal_lahir)}`],
    ['Alamat Rumah / Surat', g => g.alamat],
    ['RT / RW',             g => `${teks(g.rt)} / ${teks(g.rw)}`],
    ['Dusun',               g => g.dusun],
    ['Desa / Kelurahan',    g => g.desa],
    ['Kecamatan',           g => g.kecamatan],
    ['Kabupaten / Kota',    g => g.kabupaten],
    ['Provinsi',            g => g.provinsi],
    ['Telepon Rumah',       g => g.telepon_rumah],
    ['Telepon Sekolah',     g => g.telepon_sekolah],
    ['HP / WhatsApp',       g => g.telepon_hp],
    ['Kontak Lainnya',      g => g.telepon_lainnya]
  ]],
  ['PENDIDIKAN', [
    ['Pendidikan Terakhir',        g => g.pendidikan],
    ['Jurusan',                    g => g.jurusan],
    ['Universitas / Sekolah',      g => g.universitas],
    ['Tahun Kelulusan',            g => g.tahun_lulus],
    ['Alamat Universitas / Sekolah', g => g.alamat_universitas]
  ]],
  ['GEREJA', [
    ['Nama Gereja',   g => g.gereja],
    ['Alamat Gereja', g => g.alamat_gereja]
  ]],
  ['KELUARGA & PEKERJAAN', [
    ['Status Pernikahan',        g => g.status_nikah],
    ['Nama Suami / Istri',       g => g.pasangan],
    ['TTL Suami / Istri',        g => g.ttl_pasangan],
    ['Nama Anak',                g => g.anak],
    ['Gaji / Honor dari Mengajar PAK per Bulan', g => g.gaji_pak],
    ['Pekerjaan Sambilan',       g => g.pekerjaan_sambilan],
    ['Golongan Darah',           g => g.gol_darah],
    ['Jabatan di Desa / Kampung', g => g.jabatan_desa]
  ]],
  ['REKENING BANK', [
    ['Nomor Rekening',           g => g.no_rekening],
    ['Nama Bank',                g => g.nama_bank],
    ['Cabang Bank',              g => g.cabang_bank],
    ['Email Rekening',           g => g.email_rekening]
  ]]
];

const KOLOM_SEKOLAH = ['No', 'Nama Sekolah', 'Alamat Sekolah', 'Kelas', 'Jumlah Siswa',
                       'Ruang / Tempat Mengajar', 'Hari Mengajar', 'Jam Mengajar'];

/* ---------- penyusun lembar ---------- */

function garisTipis() {
  const sisi = { style: 'thin', color: { argb: GARIS } };
  return { top: sisi, left: sisi, bottom: sisi, right: sisi };
}

function judulBagian(ws, teksJudul) {
  const baris = ws.addRow([teksJudul]);
  ws.mergeCells(baris.number, 1, baris.number, 8);
  baris.height = 20;
  const sel = baris.getCell(1);
  sel.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MERAH } };
  sel.alignment = { vertical: 'middle', indent: 1 };
  return baris;
}

function barisIsian(ws, label, nilai) {
  const baris = ws.addRow([label, nilai]);
  ws.mergeCells(baris.number, 2, baris.number, 6);   // kolom G–H disisakan untuk foto
  baris.getCell(1).font = { bold: true, size: 10, color: { argb: ABU } };
  baris.getCell(1).alignment = { vertical: 'top', indent: 1 };
  baris.getCell(2).font = { size: 11 };
  baris.getCell(2).alignment = { vertical: 'top', wrapText: true };
  const panjang = String(nilai || '').length;
  if (panjang > 90) baris.height = 32;
  return baris;
}

function buatLembarGuru(wb, guru, fotoBase64, namaTab) {
  const ws = wb.addWorksheet(namaTab, {
    pageSetup: {
      paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.5, header: 0.3, footer: 0.3 }
    }
  });

  ws.columns = [
    { width: 24 }, { width: 22 }, { width: 18 }, { width: 12 },
    { width: 14 }, { width: 22 }, { width: 16 }, { width: 14 }
  ];

  // kepala
  const b1 = ws.addRow(['YAYASAN SULUH PRANA INDONESIA']);
  ws.mergeCells(b1.number, 1, b1.number, 8);
  b1.getCell(1).font = { bold: true, size: 14, color: { argb: MERAH_TUA } };
  b1.height = 22;

  const b2 = ws.addRow(['BIODATA GURU']);
  ws.mergeCells(b2.number, 1, b2.number, 8);
  b2.getCell(1).font = { bold: true, size: 11, color: { argb: ABU } };

  ws.addRow([]);

  // isi biodata
  for (const [judul, kolom] of BAGIAN) {
    judulBagian(ws, judul);
    for (const [label, ambil] of kolom) barisIsian(ws, label, teks(ambil(guru)));
    ws.addRow([]);
  }

  // sekolah yang dilayani
  judulBagian(ws, 'SEKOLAH YANG DILAYANI SAAT INI');
  const kepala = ws.addRow(KOLOM_SEKOLAH);
  kepala.eachCell(sel => {
    sel.font = { bold: true, size: 10, color: { argb: MERAH_TUA } };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MERAH_MUDA } };
    sel.alignment = { vertical: 'middle', wrapText: true };
    sel.border = garisTipis();
  });

  if (guru.sekolah.length) {
    guru.sekolah.forEach((s, i) => {
      const baris = ws.addRow([
        i + 1, teks(s.nama_sekolah), teks(s.alamat_sekolah), teks(s.kelas),
        s.jumlah_siswa ?? '—', teks(s.ruangan), teks(s.hari_mengajar), teks(s.jam_mengajar)
      ]);
      baris.eachCell(sel => {
        sel.font = { size: 10 };
        sel.alignment = { vertical: 'top', wrapText: true };
        sel.border = garisTipis();
      });
    });
    const total = ws.addRow(['', 'TOTAL', '', `${guru.sekolah.length} kelas`,
      guru.sekolah.reduce((t, s) => t + (Number(s.jumlah_siswa) || 0), 0), '', '', '']);
    total.font = { bold: true, size: 10 };
  } else {
    ws.addRow(['', 'Belum ada data sekolah.']);
  }

  ws.addRow([]);
  const kaki = ws.addRow([`Nomor bukti: ${String(guru.id).slice(0, 8).toUpperCase()}`
    + `   ·   Dikirim: ${waktuKirim(guru.created_at)}`]);
  ws.mergeCells(kaki.number, 1, kaki.number, 8);
  kaki.getCell(1).font = { size: 9, italic: true, color: { argb: ABU } };

  // foto di kanan atas
  if (fotoBase64) {
    try {
      const id = wb.addImage({ base64: fotoBase64.data, extension: fotoBase64.jenis });
      ws.addImage(id, { tl: { col: 6, row: 3 }, ext: { width: 132, height: 165 } });
    } catch (err) {
      console.warn('Foto gagal disisipkan untuk', guru.nama, err);
    }
  }

  return ws;
}

function buatLembarRingkasan(wb, daftar) {
  const ws = wb.addWorksheet('Ringkasan', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.columns = [
    { width: 5 }, { width: 30 }, { width: 20 }, { width: 26 },
    { width: 12 }, { width: 12 }, { width: 22 }, { width: 20 }
  ];

  const judul = ws.addRow(['Ringkasan Pendataan Guru — Yayasan Suluh Prana Indonesia']);
  ws.mergeCells(judul.number, 1, judul.number, 8);
  judul.getCell(1).font = { bold: true, size: 13, color: { argb: MERAH_TUA } };
  judul.height = 22;

  const kepala = ws.addRow(['No', 'Nama Guru', 'HP / WhatsApp', 'Gereja',
                            'Sekolah', 'Kelas', 'Total Siswa', 'Tanggal Kirim']);
  kepala.eachCell(sel => {
    sel.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MERAH } };
    sel.alignment = { vertical: 'middle', wrapText: true };
    sel.border = garisTipis();
  });

  daftar.forEach(({ guru }, i) => {
    const sekolahUnik = new Set(
      guru.sekolah.map(s => String(s.nama_sekolah || '').trim().toLowerCase()).filter(Boolean)
    ).size;
    const baris = ws.addRow([
      i + 1, teks(guru.nama), teks(guru.telepon_hp), teks(guru.gereja),
      sekolahUnik, guru.sekolah.length,
      guru.sekolah.reduce((t, s) => t + (Number(s.jumlah_siswa) || 0), 0),
      waktuKirim(guru.created_at)
    ]);
    baris.eachCell(sel => { sel.font = { size: 10 }; sel.border = garisTipis(); });
  });

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 8 } };
  return ws;
}

/* ---------- pintu masuk ---------- */

/** Memisahkan data URL menjadi { data, jenis } yang dimengerti ExcelJS. */
function pisahkanFoto(sumber) {
  if (!sumber) return null;
  const cocok = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(String(sumber));
  if (!cocok) return null;
  const jenis = cocok[1].toLowerCase() === 'jpg' ? 'jpeg' : cocok[1].toLowerCase();
  if (jenis === 'webp') return null;              // Excel tidak mengenal WEBP
  return { data: cocok[2], jenis };
}

/** Gambar apa pun yang bisa dibaca browser → JPEG data URL (Excel tidak mengenal WEBP). */
async function keJpeg(blob) {
  const gambar = await createImageBitmap(blob);
  const kanvas = document.createElement('canvas');
  kanvas.width = gambar.width; kanvas.height = gambar.height;
  const k = kanvas.getContext('2d');
  k.fillStyle = '#fff'; k.fillRect(0, 0, kanvas.width, kanvas.height);
  k.drawImage(gambar, 0, 0);
  gambar.close?.();
  return kanvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Foto mode Firestore datang sebagai data URL; mode Storage sebagai URL unduhan
 * HTTPS Firebase Storage (berisi token akses dari getDownloadURL). Keduanya dijadikan
 * { data, jenis } untuk ExcelJS. URL Storage diambil dengan fetch biasa — bucket harus
 * mengizinkan CORS untuk domain situs ini, kalau tidak foto dilewati dan dihitung gagal.
 */
async function siapkanFoto(sumber) {
  if (!sumber) return null;
  const s = String(sumber);
  const langsung = pisahkanFoto(s);
  if (langsung) return langsung;
  if (/^data:image\/webp;base64,/i.test(s)) return pisahkanFoto(await keJpeg(await (await fetch(s)).blob()));
  if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(s) || /^https:\/\/[\w.-]+\.firebasestorage\.app\//.test(s)) {
    const r = await fetch(s, { credentials: 'omit' });
    if (!r.ok) throw new Error('Foto Storage tidak bisa diunduh (' + r.status + ')');
    const blob = await r.blob();
    if (!/^image\//.test(blob.type)) throw new Error('Berkas foto bukan gambar');
    return pisahkanFoto(await keJpeg(blob));
  }
  return null;
}

/**
 * @param daftarGuru  array guru (sudah tersaring & terurut sesuai layar)
 * @param ambilFoto   async (guru) => data URL atau URL, boleh null
 * @param lapor       (teks) => void, untuk menampilkan kemajuan
 */
export async function unduhBiodataExcel({ daftarGuru, ambilFoto, lapor = () => {} }) {
  if (!daftarGuru.length) throw new Error('Tidak ada data guru untuk diekspor.');

  lapor('Menyiapkan komponen Excel…');
  const ExcelJS = await muatExcelJS();

  lapor(`Mengumpulkan foto 0 dari ${daftarGuru.length}…`);
  const siap = [];
  let fotoGagal = 0;
  for (let i = 0; i < daftarGuru.length; i++) {
    const guru = daftarGuru[i];
    let foto = null;
    try {
      foto = await siapkanFoto(await ambilFoto(guru));
    } catch (err) {
      fotoGagal++;
      console.warn('Foto gagal diambil untuk', guru.nama, err);
    }
    siap.push({ guru, foto });
    lapor(`Mengumpulkan foto ${i + 1} dari ${daftarGuru.length}…`);
  }

  lapor('Menyusun lembar biodata…');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistem Pendataan Guru — Yayasan Suluh Prana Indonesia';
  wb.created = new Date();

  buatLembarRingkasan(wb, siap);

  const dipakai = new Set(['ringkasan']);
  siap.forEach(({ guru, foto }) => {
    buatLembarGuru(wb, guru, foto, namaSheet(guru.nama, dipakai));
  });

  lapor('Menulis berkas…');
  const isi = await wb.xlsx.writeBuffer();
  const blob = new Blob([isi], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(blob);
  tautan.download = `biodata-guru-yspi-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  setTimeout(() => URL.revokeObjectURL(tautan.href), 2000);

  return { jumlah: siap.length, berfoto: siap.filter(x => x.foto).length, fotoGagal };
}
