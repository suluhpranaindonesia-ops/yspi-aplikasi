// Menyiapkan BAHAN untuk model lokal.
//
// Bagian ini sengaja BUKAN pekerjaan model: mengambil pesan dari SQLite dan
// memeras tracker jadi daftar item hidup itu pekerjaan mekanis yang harus
// persis. Yang diserahkan ke model lokal adalah penilaian dan penulisannya.
//
// Hasil: satu berkas markdown di vault yang bisa dibaca model lokal.
//
// Pakai: node siapkan.mjs <pagi|sore>

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const VAULT = 'G:/.shortcut-targets-by-id/1184ssFnjTNDIKb7QBovAr3dLHmZPcreJ/Suluh Prana Indonesia';
const DB = 'C:/Users/suluh/wa-konsol/data/wa.db';
const GRUP = '<id-grup-yspi>@g.us';
// Sumber tracker: xlsx aslinya, dibaca LANGSUNG.
//
// Sebelumnya yang dibaca cerminan markdown di .wa-bridge/baca/, tapi cerminan
// itu dihasilkan pipeline agen lain sekitar pukul 09.22 - jadi sepanjang hari
// isinya bisa tertinggal dari xlsx-nya. Membaca xlsx langsung selalu segar.
//
// HANYA DIBACA. Berkasnya dibuka untuk disalin isinya, tidak pernah ditulis,
// tidak pernah dikunci, tidak pernah dipindahkan. Hasil konversinya mendarat di
// folder sementara di C:, bukan di vault.
const TRACKER_XLSX = path.join(VAULT, 'Follow Up Log', 'YSPI-Follow-Up-Tracker.xlsx');
const KONVERSI = 'C:/Users/suluh/wa-konsol/pengingat/tracker-baca';
const TRACKER_CERMIN = path.join(VAULT, '.wa-bridge', 'baca', 'YSPI-Follow-Up-Tracker.md');
const TOPIK_MD = path.join(VAULT, 'Operation', 'ops', 'topik.md');
const PAPAN_MD = path.join(VAULT, 'Operation', 'ops', 'papan-topik.md');
const WIKI_INDEX = path.join(VAULT, 'wiki', 'index.md');
const KELUAR = path.join(VAULT, 'WA-Lokal', 'pengingat');

const sesi = (process.argv[2] || 'pagi').toLowerCase();
const sekarang = new Date();

// Batas jumlah. Ini bukan soal muat atau tidak di jendela konteks: model 8B yang
// diberi 27 item dan 40 pesan menghabiskan SELURUH jatah keluarannya untuk
// "berpikir" (2.500+ token) lalu berhenti tanpa memanggil tool apa pun. Bahan
// yang lebih pendek membuat penalarannya selesai dan berkasnya benar-benar ditulis.
const angka = (nama, bawaan) => {
  const c = process.argv.find((a) => a.startsWith('--' + nama + '='));
  const n = c ? Number(c.split('=')[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : bawaan;
};
const SEMUA_ITEM = process.argv.includes('--semua');
const HANYA_AKTIF = process.argv.includes('--aktif-saja');
const MAKS_ITEM = SEMUA_ITEM ? Number.MAX_SAFE_INTEGER : angka('item', 14);
const MAKS_PESAN = angka('pesan', 25);
const MAKS_PER_KELOMPOK = SEMUA_ITEM ? Number.MAX_SAFE_INTEGER : angka('kelompok', 6);

// --- Mode hari & sesi -------------------------------------------------------
//
// Mengikuti spesifikasi agen YSPI yang sudah berjalan:
//   Senin-Jumat pagi  - status follow-up; format bergantian tiap hari
//                       (tanggal genap = per orang, ganjil = per topik)
//   Sabtu pagi        - Perayaan & Syukur, TANPA daftar outstanding
//   Minggu pagi       - Hari Istirahat, satu topik vault + doa
//   Sore (tiap hari)  - tidak mengirim apa pun
const bagianWIB = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
}).formatToParts(sekarang);
const ambilBagian = (t) => bagianWIB.find((p) => p.type === t)?.value;
const HARI_WIB = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[ambilBagian('weekday')] || 1;
const HARI_KE = Math.floor(Date.UTC(
  Number(ambilBagian('year')), Number(ambilBagian('month')) - 1, Number(ambilBagian('day'))) / 86400000);

function tentukanMode() {
  if (sesi === 'sore') return 'sore';
  if (HARI_WIB === 6) return 'syukur';
  if (HARI_WIB === 7) return 'istirahat';
  // Senin-Jumat selalu per orang; selang-seling dengan per topik dihapus 18 Sep 2026.
  return 'perorang';
}
const MODE = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] || tentukanMode();

function tanggalWIB(d) {
  // Mesin ini memang di WIB, tapi jangan bergantung pada itu - kunci ke Jakarta.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(d);
}
function jamWIB(d) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}
// Dipotong di batas kata, bukan di tengah kata.
//
// Versi lama memotong tepat di huruf ke-n, jadi bahan berisi pecahan seperti
// "kapita selekta futu…" - dan model menyalinnya apa adanya ke pesan yang
// dikirim ke orang. Lebih baik kehilangan satu kata utuh daripada mengirim
// potongan kata.
function potong(teks, n) {
  const t = String(teks || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const potongan = t.slice(0, n);
  const spasi = potongan.lastIndexOf(' ');
  // Tanda kurung/kutip yang menggantung ikut dibuang - "studi kasus YSPI, (…"
  // terbaca seperti kalimat yang rusak, bukan kalimat yang dipendekkan.
  return (spasi > n * 0.6 ? potongan.slice(0, spasi) : potongan)
    .replace(/[\s,;:.\-([{"'/&+]+$/, '') + '…';
}

// --- 1. Item hidup dari cermin tracker -------------------------------------
//
// Cermin .md punya sel bertingkat baris (kolom "Ringkasan Perkembangan" berisi
// riwayat multi-baris). Jadi satu baris tabel bisa terbentang di banyak baris
// teks. Satu record dimulai di "| F<angka> |" dan berakhir sebelum record
// berikutnya.
// Mengubah xlsx jadi markdown di folder sementara, lalu mengembalikan jalurnya.
// Kalau gagal karena apa pun, jatuh kembali ke cerminan lama - lebih baik data
// agak lama daripada pengingat yang batal sama sekali.
function sumberTracker() {
  if (fs.existsSync(TRACKER_XLSX)) {
    try {
      fs.mkdirSync(KONVERSI, { recursive: true });
      execFileSync(process.execPath,
        ['C:/Users/suluh/konversi-dokumen.mjs', TRACKER_XLSX, KONVERSI],
        { stdio: 'ignore', timeout: 120000 });
      const hasil = path.join(KONVERSI, 'YSPI-Follow-Up-Tracker.md');
      if (fs.existsSync(hasil)) return { jalur: hasil, asal: 'xlsx langsung' };
    } catch { /* jatuh ke cerminan */ }
  }
  if (fs.existsSync(TRACKER_CERMIN)) return { jalur: TRACKER_CERMIN, asal: 'cerminan .wa-bridge' };
  return { jalur: null, asal: null };
}

function bacaItem() {
  const sumber = sumberTracker();
  if (!sumber.jalur) return { item: [], catatan: 'tracker tidak ditemukan', asal: null };
  const baris = fs.readFileSync(sumber.jalur, 'utf8').split(/\r?\n/);
  const mentah = [];
  let kini = null;
  for (const b of baris) {
    if (/^\|\s*F\d+\s*\|/.test(b)) { if (kini) mentah.push(kini); kini = b; }
    else if (kini !== null) {
      if (/^\s*$/.test(b) || /^#/.test(b)) { mentah.push(kini); kini = null; }
      else kini += ' ' + b;
    }
  }
  if (kini) mentah.push(kini);

  // Kolom dikenali dari ISINYA, bukan dari posisinya.
  //
  // Konverter xlsx melewatkan sel kosong pada sebagian baris, jadi nomor kolom
  // bergeser antar baris: di F09 Topik ada di kolom 12, di F66 di kolom 10.
  // Membaca berdasarkan posisi membuat enam item kehilangan topiknya dan jatuh
  // ke "Tanpa Topik" - padahal datanya ada. Yang stabil hanya A-F di depan.
  const STATUS = new Set(['Outstanding', 'Kandidat Close', 'Closed']);
  const kunciTopik = new Set(bacaTopik().nama.keys());

  const item = [];
  for (const r of mentah) {
    const k = r.split('|').map((s) => s.trim());
    const [, id, judul, pic, , target] = k;   // A-F selalu terisi
    if (!id || !/^F\d+$/.test(id)) continue;

    const status = k.find((s) => STATUS.has(s));
    const topik = k.find((s) => kunciTopik.has(s)) || '';
    // Kolom K selalu berbentuk "(28 Agu) ..." - itu tanda pengenalnya.
    const ringkasan = [...k].reverse().find((s) => /^\(\d{1,2}\s+\w+\)/.test(s)) || '';
    // Kolom I hanya terisi pada item yang ditutup.
    const ditutupOleh = k.find((s) => /auto-close|ditutup|closed by/i.test(s)) || '';

    // Panduan tim: rekap harian memuat Outstanding, Kandidat Close, dan Closed
    // yang BARU saja ditutup - yang terakhir sebagai konfirmasi, bukan daftar
    // kerja. Closed lama tidak ikut; kalau semua ikut, pesannya jadi arsip.
    // Closed disimpan sampai 7 hari: mode harian memakai ambang 2 hari (sekadar
    // konfirmasi), mode Syukur hari Sabtu memakai 7 hari (capaian sepekan).
    let hariTutup = null;
    if (status === 'Closed') {
      const tgl = String(ditutupOleh || '').match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!tgl) continue;
      const hari = (Date.now() - Date.parse(tgl[0])) / 86400000;
      if (!(hari >= 0 && hari <= 7)) continue;
      hariTutup = hari;
    } else if (status !== 'Outstanding' && status !== 'Kandidat Close') {
      continue;
    }
    // Baris teratas kolom K = perkembangan terbaru.
    const terbaru = String(ringkasan || '').split(/\s*\(\d{1,2}\s/)[0].trim() || String(ringkasan || '');
    item.push({
      id, judul: potong(judul, 150), pic: pic || '-', target: target || '',
      status, topik: topik || '', terbaru: potong(ringkasan, 200), hariTutup,
    });
  }
  return { item, catatan: null, asal: sumber.asal };
}

// --- Master topik ----------------------------------------------------------
//
// Kunci topik bersifat kanonik dan case-sensitive; namanya diambil dari
// ops/topik.md, emojinya dari papan-topik.md supaya pesan per-topik memakai
// lambang yang sama dengan papan. Kunci yang tidak ada di daftar tidak pernah
// dikarang - itu aturan keras di topik.md.
function bacaTopik() {
  const nama = new Map();
  const urutan = [];
  try {
    for (const b of fs.readFileSync(TOPIK_MD, 'utf8').split('\n')) {
      const m = b.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/);
      if (!m) continue;
      const kunci = m[1].trim();
      if (nama.has(kunci)) continue;
      nama.set(kunci, m[2].trim());
      urutan.push(kunci);
    }
  } catch {}
  const emoji = new Map();
  try {
    for (const b of fs.readFileSync(PAPAN_MD, 'utf8').split('\n')) {
      const m = b.match(/^##\s+(\S+)\s+([A-Za-z0-9][\w-]*)\s+—/u);
      if (m) emoji.set(m[2], m[1]);
    }
  } catch {}
  return { nama, urutan, emoji };
}

// --- 2. Pesan grup sejak jendela terakhir ----------------------------------
function bacaPesan(jamKebelakang) {
  const db = new DatabaseSync(DB, { readOnly: true });
  const batas = Date.now() - jamKebelakang * 3600 * 1000;
  const rows = db.prepare(
    `SELECT ts, pengirim, teks, jenis, dariSaya FROM pesan
      WHERE jid = ? AND ts >= ? ORDER BY ts ASC`
  ).all(GRUP, batas);
  db.close();
  return rows;
}

// --- 3. Pilih yang paling perlu diingatkan ---------------------------------
//
// Kalau item lebih banyak dari batas, yang dipakai bukan yang pertama ketemu
// melainkan yang paling mendesak: Kandidat Close (menunggu keputusan orang),
// lalu yang punya tenggat, lalu yang baru bergerak. Item tanpa tenggat dan
// tanpa perkembangan adalah yang paling aman ditunda ke besok.
function bobot(it) {
  let n = 0;
  // Closed baru ikut masuk sebagai konfirmasi, tapi paling bawah prioritasnya -
  // ia tidak menuntut pekerjaan siapa pun.
  if (it.status === 'Closed') return 5;
  if (it.status === 'Kandidat Close') n += 100;
  if (it.target) {
    n += 50;
    const t = Date.parse(it.target);
    if (Number.isFinite(t)) {
      const hari = (t - Date.now()) / 86400000;
      n += hari < 0 ? 40 : hari < 14 ? 30 : 10;   // lewat tenggat paling atas
    }
  }
  if (it.terbaru) n += 20;
  return n;
}

const { item: semuaMentah, catatan, asal } = bacaItem();
// Ambang Closed berbeda per mode - lihat catatan di bacaItem().
const semuaItem = semuaMentah.filter((i) =>
  (!HANYA_AKTIF || i.status !== 'Closed')
  && (i.hariTutup === null || i.hariTutup <= (MODE === 'syukur' ? 7 : 2)));
const item = [...semuaItem].sort((a, b) => bobot(b) - bobot(a)).slice(0, MAKS_ITEM);
const dipangkas = semuaItem.length - item.length;

const jamKebelakang = sesi === 'pagi' ? 24 : 12;

// Buang pesan yang dihasilkan agen, bukan diketik orang.
//
// Agen lama mengirim rekap hariannya ke grup yang sama. Isinya panjang (7-10 rb
// huruf), memuat kode [F..] lengkap dengan ekornya, dan sama sekali bukan
// obrolan. Kalau ikut masuk bahan, dua hal rusak: jatah pesan habis oleh satu
// kiriman, dan potongannya tertukar dengan data tracker yang asli.
const POLA_AGEN = [
  /Status Follow-Up YSPI/i,
  /Status Sore Follow-Up/i,
  /Pengingat YSPI \(H-\d\)/i,
  /Pengingat Rapat Bulanan YSPI/i,
  /pesan otomatis/i,
];
const semuaPesan = bacaPesan(jamKebelakang)
  .filter((p) => !POLA_AGEN.some((r) => r.test(String(p.teks || ''))));
const pesan = semuaPesan.slice(-MAKS_PESAN);

// PIC gabungan tetap satu kelompok, tidak dipecah.
//
// Ini mengikuti pesan harian agen aslinya di grup: item milik "Rudy, Ribia"
// muncul satu kali di bawah judul "Rudy, Ribia", bukan diulang di bawah Rudy
// dan lagi di bawah Ribia. Waktu dipecah, F90 (PIC "Andrian, Daniel, Rudy")
// muncul tiga kali dalam satu pesan - persis keluhan yang muncul di hasil 9 Sep.
// --- Tag follow-up dari grup ------------------------------------------------
//
// Aturan tim (ops/panduan-followup-whatsapp.md): reply pesannya lalu ketik tag.
//   #log    catat item baru
//   #close  usul item sudah beres  -> Kandidat Close, bukan langsung Closed
//   #reopen buka lagi item yang terlanjur ditutup
//
// Yang menulis tracker tetap agen lama. Di sini tag cuma DIDETEKSI lalu
// dicocokkan dengan status tracker saat ini, supaya pengingat bisa menyebut
// mana usulan yang sudah tercatat dan mana yang belum - itu justru bagian yang
// paling gampang tercecer.
const POLA_TAG = /(^|\s)#(log|close|reopen)\b[\s:]*([Ff]\d+)?/;

function bacaTag(daftarPesan, semua) {
  const status = new Map(semua.map((i) => [i.id.toUpperCase(), i.status]));
  const hasil = [];
  for (const p of daftarPesan) {
    const teks = String(p.teks || '');
    // Rekap agen panjang dan memuat kata "#log" di kaki pesannya - itu petunjuk
    // pemakaian, bukan tag yang diketik orang.
    if (teks.length > 400) continue;
    const m = teks.match(POLA_TAG);
    if (!m) continue;
    const jenis = m[2].toLowerCase();
    const id = m[3] ? m[3].toUpperCase() : null;
    const st = id ? status.get(id) : undefined;

    let cocok;
    if (!id) cocok = 'menunjuk pesan yang di-reply, perlu dicek manusia';
    else if (jenis === 'close') {
      cocok = st === undefined ? 'sudah tercatat (item tidak lagi hidup)'
        : st === 'Kandidat Close' ? 'sudah tercatat sebagai Kandidat Close'
        : 'BELUM tercatat - masih Outstanding di tracker';
    } else if (jenis === 'reopen') {
      cocok = st === 'Outstanding' ? 'sudah tercatat sebagai Outstanding'
        : 'BELUM tercatat';
    } else {
      cocok = 'item baru, perlu dicek apakah sudah masuk tracker';
    }
    hasil.push({ ts: p.ts, jenis, id, pengirim: p.pengirim || 'tidak dikenal', teks, cocok });
  }
  return hasil;
}

const tag = bacaTag(semuaPesan, semuaItem);
const idBertag = new Set(tag.filter((t) => t.id).map((t) => t.id));

const perPic = new Map();
for (const it of item) {
  const kunci = it.pic.split(/[,/]/).map((s) => s.trim()).filter(Boolean).join(', ') || '-';
  if (!perPic.has(kunci)) perPic.set(kunci, []);
  perPic.get(kunci).push(it);
}

// Pengelompokan per topik, dipakai kalau mode = pertopik.
const topik = bacaTopik();
const perTopik = new Map();
for (const it of item) {
  const kunci = it.topik && topik.nama.has(it.topik) ? it.topik : '(Tanpa Topik)';
  if (!perTopik.has(kunci)) perTopik.set(kunci, []);
  perTopik.get(kunci).push(it);
}

const L = [];
L.push(`# Bahan pengingat YSPI - ${tanggalWIB(sekarang)} (sesi ${sesi}, mode ${MODE})`);
L.push('');
L.push(`Disiapkan otomatis ${tanggalWIB(sekarang)} ${jamWIB(sekarang)} WIB.`);
L.push('Berkas ini ditulis ulang tiap run. Jangan disunting.');
L.push('');

// Satu baris item, bentuknya persis seperti di pesan jadinya. Model lokal
// tinggal memendekkan kalimatnya - bukan menyusun ulang tata letaknya.
function barisItem(it, sertakanPic) {
  const keluar = [];
  const tgl = it.target ? `, deadline ${it.target}` : '';
  const pic = sertakanPic && it.pic && it.pic !== '-' ? ` (PIC: ${it.pic})` : '';
  const status = it.status === 'Kandidat Close' ? '✅ Kandidat close → konfirmasi' : it.status;
  keluar.push(`  • [${it.id}] ${it.judul}${pic} — ${status}${tgl}`);
  if (it.terbaru) keluar.push(`      ↳ ${it.terbaru}`);
  if (idBertag.has(it.id.toUpperCase())) {
    const t = tag.find((x) => x.id === it.id.toUpperCase());
    keluar.push(`      🏷️ ada #${t.jenis} di grup dari ${t.pengirim} - ${t.cocok}`);
  }
  return keluar;
}

// Urutan dalam tiap kelompok mengikuti panduan tim: Outstanding di atas,
// Kandidat Close di tengah, Closed di bawah. Lewat 6 item jadi "+N lagi",
// sama seperti agen aslinya - pesan WhatsApp yang terlalu panjang tidak dibaca.
const pangkat = (s) => (s === 'Outstanding' ? 0 : s === 'Kandidat Close' ? 1 : 2);
function tulisKelompok(judul, daftar, sertakanPic) {
  L.push(judul);
  const urut = [...daftar].sort((a, b) => pangkat(a.status) - pangkat(b.status));
  for (const it of urut.slice(0, MAKS_PER_KELOMPOK)) L.push(...barisItem(it, sertakanPic));
  const sisa = urut.slice(MAKS_PER_KELOMPOK);
  if (sisa.length) L.push(`  • +${sisa.length} lagi (${sisa.map((x) => x.id).join(', ')})`);
  L.push('');
}

if (MODE === 'syukur') {
  // Sabtu: TIDAK ada daftar outstanding. Yang dikumpulkan hanya yang layak
  // dirayakan pekan ini - item yang benar-benar ditutup, dan tonggak nyata
  // dari catatan perkembangan 7 hari terakhir. Kalau pekan ini sepi, katakan
  // apa adanya; jangan memaksa item yang masih menggantung jadi "capaian".
  const tutup = semuaItem.filter((i) => i.hariTutup !== null);
  // Entri K berbentuk "(5 Sep) ..." - tanggalnya diurai supaya "pekan ini"
  // benar-benar sepekan. Tanpa ini, entri sebulan lalu ikut terbawa sebagai
  // "capaian pekan ini", dan pesan syukurnya jadi tidak jujur.
  const BULAN = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5, Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11 };
  const umurEntri = (teks) => {
    const m = String(teks || '').match(/^\((\d{1,2})\s+([A-Za-z]{3})\)/);
    if (!m || !(m[2] in BULAN)) return Infinity;
    const kini = new Date();
    let th = kini.getFullYear();
    let t = new Date(th, BULAN[m[2]], Number(m[1]));
    if (t - kini > 86400000 * 30) t = new Date(th - 1, BULAN[m[2]], Number(m[1]));
    return (kini - t) / 86400000;
  };
  const tonggak = semuaItem
    .filter((i) => i.hariTutup === null && umurEntri(i.terbaru) <= 7)
    .slice(0, 6);

  L.push(`## A. Capaian pekan ini (${tutup.length} ditutup, ${tonggak.length} perkembangan)`);
  L.push('');
  L.push('Sabtu = pesan syukur. TIDAK ada daftar outstanding di pesan hari ini.');
  L.push('');
  if (!tutup.length && !tonggak.length) {
    L.push('_Pekan ini tidak ada item yang ditutup maupun tonggak baru._');
    L.push('');
  }
  if (tutup.length) {
    L.push('### Selesai pekan ini');
    for (const i of tutup) L.push(`  • [${i.id}] ${i.judul}`);
    L.push('');
  }
  if (tonggak.length) {
    // Ditandai tegas BELUM SELESAI. Tanpa penanda ini model menulisnya seolah
    // capaian - 9 Sep keluar "Pelatihan HT PAUK memasuki tahap akhir persiapan"
    // padahal itu cuma catatan rapat, dan itu memuji sesuatu yang belum ada.
    L.push('### Bergerak pekan ini — BELUM SELESAI, jangan ditulis sebagai capaian');
    for (const i of tonggak) L.push(`  • [${i.id}] ${i.judul}\n      ↳ ${i.terbaru}`);
    L.push('');
  }
} else if (MODE === 'istirahat') {
  // Minggu: satu topik dari wiki, dirotasi mingguan supaya tidak mengulang
  // bahan yang sama tiap pekan.
  let halaman = [];
  try {
    for (const b of fs.readFileSync(WIKI_INDEX, 'utf8').split('\n')) {
      const m = b.match(/\[([^\]]{4,80})\]\((teologi\/[^)]+\.md)\)/);
      if (m) halaman.push({ judul: m[1], jalur: m[2] });
    }
  } catch {}
  const pekan = Math.floor(HARI_KE / 7);
  const pilih = halaman.length ? halaman[pekan % halaman.length] : null;

  L.push('## A. Bahan Hari Istirahat');
  L.push('');
  L.push('Minggu = hari istirahat. TIDAK ada daftar outstanding di pesan hari ini.');
  L.push('');
  if (pilih) {
    L.push(`Topik pekan ini (rotasi otomatis): **${pilih.judul}** — \`wiki/${pilih.jalur}\``);
    L.push('');
    try {
      // Frontmatter YAML dibuang - itu metadata berkas, bukan isi yang mau
      // direnungkan. Tanpa ini cuplikannya berisi "tags:", "sources:", dst.
      let isi = fs.readFileSync(path.join(VAULT, 'wiki', pilih.jalur), 'utf8');
      const tutupFm = isi.startsWith('---') ? isi.indexOf('\n---', 3) : -1;
      if (tutupFm > -1) isi = isi.slice(tutupFm + 4);
      const kutip = isi.split('\n').filter((b) => b.trim() && !/^[#>|\-*]/.test(b)).slice(0, 8);
      L.push('Cuplikan halamannya:');
      for (const b of kutip) L.push(`> ${potong(b, 220)}`);
    } catch { L.push('_Halaman tidak terbaca._'); }
  } else {
    L.push('_Tidak ada halaman teologi yang terdaftar di wiki/index.md._');
  }
  L.push('');
} else {
  L.push(`## A. Item hidup (${item.length}`
    + (dipangkas > 0 ? ` dari ${semuaItem.length}, dipilih yang paling mendesak` : '') + ')');
  L.push('');
  if (catatan) L.push(`> ${catatan}`);
}

if (MODE === 'syukur' || MODE === 'istirahat') {
  // dua mode ini tidak memakai pengelompokan item
} else if (MODE === 'pertopik') {
  const urutKunci = [...perTopik.keys()].sort((a, b) => {
    const ia = topik.urutan.indexOf(a), ib = topik.urutan.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  for (const kunci of urutKunci) {
    const judul = kunci === '(Tanpa Topik)'
      ? '❔ Tanpa Topik'
      : `${topik.emoji.get(kunci) || '🔹'} ${kunci} — ${topik.nama.get(kunci)}`;
    tulisKelompok(judul, perTopik.get(kunci), true);
  }
} else {
  for (const [pic, daftar] of [...perPic.entries()].sort((a, b) => b[1].length - a[1].length)) {
    tulisKelompok(`👤 ${pic === '-' ? 'Belum ada PIC' : pic}`, daftar, false);
  }
}
L.push(`## C. Tag follow-up di grup (${tag.length})`);
L.push('');
if (!tag.length) {
  L.push('_Tidak ada #log / #close / #reopen dalam jendela ini._');
} else {
  L.push('Aturan tim: `#log` catat item baru · `#close` usul tutup (jadi Kandidat Close,');
  L.push('penutupan akhir tetap manusia) · `#reopen` buka lagi.');
  L.push('');
  for (const t of tag) {
    L.push(`- **#${t.jenis}${t.id ? ' ' + t.id : ''}** oleh ${t.pengirim}, ${jamWIB(new Date(t.ts))}`);
    L.push(`  keadaan: ${t.cocok}`);
    L.push(`  pesan: ${potong(t.teks, 160)}`);
  }
}
L.push('');
L.push(`## B. Pesan grup "YSPI team" ${jamKebelakang} jam terakhir (${pesan.length}`
  + (semuaPesan.length > pesan.length ? ` terbaru dari ${semuaPesan.length}` : '') + ')');
L.push('');
if (!pesan.length) L.push('_Tidak ada pesan baru._');
for (const p of pesan) {
  const d = new Date(p.ts);
  const siapa = p.dariSaya ? 'Agen YSPI' : (p.pengirim || 'tidak dikenal');
  L.push(`- ${jamWIB(d)} ${siapa}: ${potong(p.teks, 180)}`);
}
L.push('');

fs.mkdirSync(KELUAR, { recursive: true });
const namaBahan = `bahan-${tanggalWIB(sekarang)}-${sesi}.md`;
fs.writeFileSync(path.join(KELUAR, namaBahan), L.join('\n'), 'utf8');

// Buang bahan lebih tua dari 7 hari supaya folder tidak menumpuk.
const kadaluarsa = Date.now() - 7 * 24 * 3600 * 1000;
for (const f of fs.readdirSync(KELUAR)) {
  if (!/^bahan-.*\.md$/.test(f)) continue;
  try { if (fs.statSync(path.join(KELUAR, f)).mtimeMs < kadaluarsa) fs.unlinkSync(path.join(KELUAR, f)); } catch {}
}

console.log(JSON.stringify({
  bahan: `WA-Lokal/pengingat/${namaBahan}`,
  mode: MODE, hari: HARI_WIB,
  item: item.length, pic: perPic.size, topik: perTopik.size,
  pesan: pesan.length, tag: tag.length,
  bytes: L.join('\n').length,
}));
