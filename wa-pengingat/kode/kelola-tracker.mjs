// Fase 1 (serap #log/#close/#reopen + auto-close) + Fase 2 (papan-topik.md)
// untuk tracker YSPI, dijalankan lokal - pelengkap lokal-lengkap.mjs yang
// sejauh ini cuma MEMBACA tracker untuk menyusun laporan harian.
//
// Sumber aturan: pesan grup YSPI team yang mem-forward dokumen "yspi-followup-
// reminder" (agen Mac/cloud, sekarang nonaktif - keputusan pengguna 23 Sep
// 2026). Filosofinya sama dengan lokal-lengkap.mjs: sebisa mungkin program
// biasa (tanggal, regex, pencocokan teks), model lokal cuma dipanggil untuk
// satu hal yang benar-benar perlu bahasa (pencocokan Topik yang tak kena pola
// apa pun), lewat panggilan terkelompok berskema ketat - pola yang sama
// dengan kabarKemarin()/saringKabar() di lokal-lengkap.mjs.
//
// Menulis ke tracker Drive SUNGGUHAN (bukan salinan kerja) sejak 23 Sep 2026:
// pengguna mengonfirmasi agen Mac yang dulu jadi alasan salinan kerja sudah
// dimatikan. Tetap ada jaring pengaman: cek hash segar sebelum tulis, dan
// cadangan sebelum openpyxl.save() (lihat tulisPerubahan()).
//
// Pakai:
//   node kelola-tracker.mjs --uji      rencana perubahan, TIDAK menulis apa pun
//   node kelola-tracker.mjs            menulis ke tracker Drive + papan-topik.md
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { VAULT, TRACKER, GRUP_YSPI, readTracker, hashTracker, dateWIB, dateLong, clean, localJSON } from './lokal-lengkap.mjs';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
const DB = 'C:/Users/suluh/wa-konsol/data/wa.db';
const PYTHON = 'C:/Users/suluh/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const KERJA = 'C:/Users/suluh/wa-konsol/tracker-kerja';
const DIPROSES = path.join(DIR, 'tag-diproses.json');
const TOPIK_MD = path.join(VAULT, 'Operation/ops/topik.md');
const PAPAN_MD = path.join(VAULT, 'Operation/ops/papan-topik.md');

// ---------------------------------------------------------------- util dasar

const tanggalPendek = ts => new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',day:'numeric',month:'short'}).format(new Date(ts)).replace('.','');
const jam = () => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());

export function muatDiproses() {
  try { return new Set(JSON.parse(fs.readFileSync(DIPROSES,'utf8'))); } catch { return new Set(); }
}
export function simpanDiproses(set) {
  // Simpan cuma 5000 id terakhir supaya berkas tidak tumbuh tanpa batas.
  fs.writeFileSync(DIPROSES, JSON.stringify([...set].slice(-5000)));
}

// -------------------------------------------------------- baca pesan bertag

// Jendela harian sederhana (kemarin 00:00 s.d. hari ini 00:00 WIB), berbeda
// dari jendelaKemarin() di lokal-lengkap.mjs yang punya kekhususan hari Senin
// - kekhususan itu ada supaya laporan per-orang (yang cuma jalan Senin-Jumat)
// tetap menangkap obrolan Sabtu-Minggu. Berkas ini jalan TIAP hari termasuk
// Sabtu-Minggu (Fase 1 tetap diam-diam diproses akhir pekan), jadi jendela
// harian biasa sudah cukup dan tidak ada obrolan yang terlewat.
export function jendelaHarian(now) {
  const hariIni = Date.parse(dateWIB(now)+'T00:00:00+07:00');
  return {dari: hariIni - 86400000, sampai: hariIni};
}

export function bacaPesanBertag(now) {
  const {dari, sampai} = jendelaHarian(now);
  const db = new DatabaseSync(DB, {readOnly:true});
  try {
    return db.prepare('SELECT id,ts,pengirim,teks,transkrip,dariSaya,kutipan FROM pesan WHERE jid=? AND ts>=? AND ts<? ORDER BY ts').all(GRUP_YSPI, dari, sampai)
      .filter(r => !r.dariSaya)
      .map(r => ({id:r.id, ts:r.ts, pengirim:clean(r.pengirim)||'?', teks:clean(r.teks||r.transkrip), kutipan: r.kutipan ? (()=>{try{return JSON.parse(r.kutipan);}catch{return null;}})() : null}))
      // Pesan berawalan penanda pesan agen sendiri (status pagi/syukur/istirahat)
      // dibuang - sama seperti pesanKemarin()/groupMessages() di
      // lokal-lengkap.mjs. Perlu juga di sini: pesan itu sendiri MEMUAT kata
      // #log/#close/#reopen di footer "Cara pakai", jadi kalau seseorang
      // forward ulang teksnya ke grup (bukan reply, disalin utuh - kejadian
      // nyata 23 Sep, Daniel), tanpa filter ini dianggap tag sungguhan.
      .filter(r => r.teks && !/^(🌅|🌙|🙏 Syukur|🌿 Hari)/u.test(r.teks));
  } finally { db.close(); }
}

// -------------------------------------------------------- resolusi tag #log/#close/#reopen

// Tim menulis tag dengan variasi, bukan cuma bentuk baku "#close" - laporan
// pengguna 23 Sep: "#closed", "#log closed" dianggap sama dengan "#close".
// Ada juga kejadian nyata 16 Sep: "Log#F72"/"#log-F72" dipakai Budiman untuk
// maksud #close (sempat terlewat 5 hari) - kata "log" dan id-nya nempel tanpa
// kata lain di antaranya (beda dari "#log tambahan F66" yang punya kata
// "tambahan" di antara "log" dan id-nya, itu tetap #log/kabar biasa - lihat
// klasifikasiLog()). Ambang pembedanya: log & id nempel (<=3 karakter bukan-
// huruf/angka di antaranya, mis. "#"/"-"/spasi tunggal) -> close; ada kata
// utuh di antaranya -> tetap log.
const CLOSE_RE = /#\s*close\w*/i;                      // #close, #closed, #Close
const CLOSE_VIA_LOG_RE = /#\s*log\w*\W{0,3}close\w*/i;  // #log closed, #log-close
const CLOSE_VIA_LOG_ID_RE = /\blog\W{0,3}F\d+\b/i;      // Log#F72, #log-F72
const REOPEN_RE = /#\s*reopen\w*/i;                     // #reopen, #reopened
const LOG_RE = /#\s*log\w*/i;
const TAG_RE = /#\s*log\w*\W{0,3}close\w*|#\s*close\w*|#\s*reopen\w*|#\s*log\w*/gi;
const ID_RE = /\bF\d+\b/i;
const STATUS_ID_RE = /\[(F\d+)\]/;
const HARI_ID = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];

export function tagPesan(teks) {
  if (CLOSE_RE.test(teks) || CLOSE_VIA_LOG_RE.test(teks) || CLOSE_VIA_LOG_ID_RE.test(teks)) return 'close';
  if (REOPEN_RE.test(teks)) return 'reopen';
  if (LOG_RE.test(teks)) return 'log';
  return null;
}

// Deadline diambil apa adanya (teks mentah), TIDAK dinormalkan ke tanggal -
// menormalkan salah bisa lebih berbahaya daripada membiarkan teks mentah;
// manusia yang baca kolom Target masih bisa memahaminya.
export function ambilDeadline(teks) {
  const t = teks.toLowerCase();
  let m = t.match(/deadline\s+([a-z0-9/\- ]{2,24})/i);
  if (m) return clean(m[1]);
  m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (m) return clean(m[0]);
  m = t.match(new RegExp(`\\b(${HARI_ID.join('|')})\\b`, 'i'));
  if (m) return clean(m[0]);
  return '';
}

// Urutan resolusi persis Langkah 3b aturan asli: (1) ID eksplisit di teks,
// (2) reply ke pesan status agen ("[Fxx]" di kutipan), (3) reply ke pesan
// biasa - dicocokkan ke Sumber/Item/K, HARUS pas satu item atau dianggap
// ragu, (4) tak bisa dipastikan -> ragu. Jalur (3) sengaja ketat (>=1 kata,
// match tunggal) karena ini jalur paling gampang salah tunjuk.
//
// Jalur (1) mengembalikan SEMUA id eksplisit, bukan cuma yang pertama - bug
// nyata 24 Sep: pesan Andrian "#close f66 f67 f84" (tiga id sekaligus) cuma
// menutup F66, F67 & F84 diam-diam terlewat tanpa tercatat ragu sama sekali.
// Jalur (2)/(3) tetap satu id - reply memang cuma bisa menunjuk satu pesan.
export function resolusiTarget(pesan, items) {
  const tanpaTag = pesan.teks.replace(TAG_RE, '');
  const semua = [...new Set((tanpaTag.match(new RegExp(ID_RE.source, 'gi')) || []).map(s => s.toUpperCase()))];
  if (semua.length) return {ids: semua, jalur: 'eksplisit'};
  if (pesan.kutipan?.teks) {
    const m = pesan.kutipan.teks.match(STATUS_ID_RE);
    if (m) return {ids: [m[1].toUpperCase()], jalur: 'reply-status'};
  }
  if (pesan.kutipan?.teks && pesan.kutipan.teks !== '[gambar]') {
    const q = clean(pesan.kutipan.teks).toLowerCase();
    if (q.length >= 12) {
      const cocok = items.filter(it => {
        const j = clean(it.judul).toLowerCase(), s = clean(it.sumber).toLowerCase();
        return (j.length>=12 && (j.includes(q) || q.includes(j))) || (s.length>=12 && s.includes(q));
      });
      if (cocok.length === 1) return {ids: [cocok[0].id], jalur: 'reply-cocok'};
    }
  }
  return {ids: [], jalur: 'ragu'};
}

// Klasifikasi satu pesan #log: "tambahan F66 ..." (id eksplisit di teks
// SENDIRI, bukan di kutipan) berarti kabar ke item lama, bukan item baru -
// dicek lebih dulu supaya tidak membuat duplikat. Fungsi murni, diuji
// terpisah dari run() di kelola-tracker.test.mjs.
export function klasifikasiLog(pesan, items) {
  const tanpaTag = pesan.teks.replace(TAG_RE, '');
  const idRujuk = tanpaTag.match(ID_RE);
  const itemRujuk = idRujuk && items.find(i=>i.id===idRujuk[0].toUpperCase());
  if (itemRujuk) return {jenis:'kabar', id: itemRujuk.id, catatan: `${clean(tanpaTag).slice(0,200)} — ${pesan.pengirim}`};
  const entri = bangunLogBaru(pesan);
  if (entri) return {jenis:'baru', ...entri};
  return {jenis:'ragu', alasan:'#log tanpa isi yang bisa dibaca'};
}

// Cek apakah sebuah kabar sudah tercermin di riwayat (K) item - perlu karena
// agen Mac (baru dimatikan 23 Sep 2026) mungkin sudah memproses pesan yang
// sama sebelum mati, jadi faktanya sudah ada di K dengan kalimat yang beda
// tapi maksud sama. Kejadian nyata: pesan Robby 22 Sep "tambahan F66" soal
// BPN/3-kavling ternyata SUDAH ada di K F66 (ditulis agen Mac, atribusi
// pengirim sama). Tanpa cek ini, kelola-tracker akan menulis entri kembar.
export function sudahTercerminDiRiwayat(riwayat, catatan, ambang=0.6) {
  const token = s => new Set(clean(s).toLowerCase().split(/[\s,.–—()\/-]+/).filter(w=>w.length>=4));
  const a = token(catatan);
  if (!a.size) return false;
  const b = token(riwayat);
  return [...a].filter(w=>b.has(w)).length / a.size >= ambang;
}

export function bangunLogBaru(pesan) {
  // Reply + #log -> isi dari pesan ASLI yang dibalas (bukan komentar
  // pembalasnya). Bukan reply -> isi dari teks sendiri, tag dibuang.
  const dariBalasan = pesan.kutipan?.teks && pesan.kutipan.teks !== '[gambar]';
  const teksDasar = dariBalasan ? pesan.kutipan.teks : pesan.teks.replace(TAG_RE, '');
  const judul = clean(teksDasar);
  if (judul.length < 4) return null;
  const pengirimDasar = dariBalasan ? (pesan.kutipan.pengirim || pesan.pengirim) : pesan.pengirim;
  return {
    judul, pic: '', target: ambilDeadline(pesan.teks),
    sumber: `WA #log ${tanggalPendek(pesan.ts)} (${pesan.pengirim})`,
    catatan: `Dicatat: ${judul.slice(0,140)} — ${pengirimDasar}`,
  };
}

// ------------------------------------------------------------- auto-close (murni tanggal, tanpa model)

export function umurHari(tglISO, now) {
  const t = Date.parse(String(tglISO||'').slice(0,10)+'T00:00:00Z');
  if (Number.isNaN(t)) return null;
  const hariIni = Date.parse(dateWIB(now)+'T00:00:00Z');
  return Math.round((hariIni - t) / 86400000);
}

export function hitungAutoClose(items, now) {
  const tutupOtomatis = [], isiTanggalKandidat = [], mendekati = [];
  for (const it of items) {
    if (it.status !== 'Kandidat Close') continue;
    if (!clean(it.kandidat)) { isiTanggalKandidat.push({id: it.id, catatan: `${it.id}: H kosong, diisi hari ini oleh kelola-tracker`}); continue; }
    const umur = umurHari(it.kandidat, now);
    if (umur === null) continue; // tanggal tak terbaca - jangan sentuh, bukan tebakan
    if (umur >= 5) tutupOtomatis.push({id: it.id, umur, catatan: `Auto-closed: 5 hari sbg Kandidat Close tanpa konfirmasi manusia — agen`, ditutup: `Auto-close (${dateWIB(now)}) — 5 hari tanpa konfirmasi manusia`});
    else if (umur >= 3) mendekati.push({id: it.id, umur, sisa: 5-umur});
  }
  return {tutupOtomatis, isiTanggalKandidat, mendekati};
}

// ------------------------------------------------------------------- topik (kolom L)

export function bacaTopikMd() {
  const teks = fs.readFileSync(TOPIK_MD, 'utf8');
  const daftar = [];
  for (const line of teks.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|?\s*$/);
    if (m) daftar.push({kunci: m[1].trim(), nama: clean(m[2]), wiki: clean(m[4]), status: clean(m[5])});
  }
  return {teks, daftar};
}
const punyaHalamanWiki = top => /\.md\)/.test(top.wiki||''); // "belum ada — gap" atau kosong -> tidak punya

const kataKunci = s => clean(s).toLowerCase().split(/[\s,.–—()\/-]+/).filter(w=>w.length>=4);

export function cocokkanTopikDeterministik(judul, pic, daftar) {
  const t = `${judul} ${pic}`.toLowerCase();
  for (const top of daftar) {
    const kata = kataKunci(top.nama);
    if (kata.length && kata.every(w=>t.includes(w))) return top.kunci; // semua kata nama topik harus ada, bukan cuma satu - biar tidak longgar
  }
  return null;
}

export function miripTopik(namaBaru, daftar, ambang=0.5) {
  const a = new Set(kataKunci(namaBaru));
  let terbaik = null, rasioTerbaik = 0;
  for (const top of daftar) {
    const b = new Set(kataKunci(top.nama));
    if (!a.size || !b.size) continue;
    const overlap = [...a].filter(w=>b.has(w)).length;
    const rasio = overlap / Math.min(a.size, b.size);
    if (rasio > rasioTerbaik) { rasioTerbaik = rasio; terbaik = top; }
  }
  return rasioTerbaik >= ambang ? terbaik : null;
}

export function buatKunci(nama, tahun) {
  const dasar = clean(nama).replace(/[^\p{L}\p{N} ]/gu,'').trim().split(/\s+/).slice(0,4).join('-');
  return /\b(19|20)\d{2}\b/.test(dasar) ? dasar : `${dasar}-${tahun}`;
}

// Satu panggilan model terkelompok untuk item yang tak kena pencocokan
// deterministik - pola sama dengan kabarKemarin(): skema JSON ketat, model
// cuma memilih dari kunci yang ADA plus BARU/RAGU, tidak pernah menulis
// narasi bebas. BARU baru benar-benar dibuat kalau lolos cek anti-duplikat
// otomatis (miripTopik) - kalau model bilang BARU tapi mirip topik lama,
// itu dianggap kesalahan model dan dipetakan ke topik lama itu, bukan RAGU,
// karena kemiripannya sudah dites program sendiri secara terpisah.
export async function topikUntukBatch(model, kandidat, daftar, log) {
  if (!kandidat.length) return {};
  const kunciSah = daftar.map(t=>t.kunci);
  const r = await localJSON(model,
    'Kamu mencocokkan item follow-up YSPI ke daftar Topik (besaran kegiatan) yang sudah ada. '
    +'Untuk tiap item, pilih SATU kunci topik yang paling cocok dari daftar "topik" yang diberikan. '
    +'Kalau item itu benar-benar bukan bagian dari topik mana pun yang ada (besaran kegiatan baru sama sekali), jawab "BARU". '
    +'Kalau ragu antara dua topik atau tidak yakin sama sekali, jawab "RAGU" - lebih baik ragu daripada salah pilih. '
    +'Jangan mengarang kunci baru; hanya boleh menjawab salah satu kunci yang diberikan, atau BARU, atau RAGU.',
    {topik: daftar.map(t=>({kunci:t.kunci, nama:t.nama})), item: kandidat.map(k=>({judul:k.judul, pic:k.pic||''}))},
    {type:'object', properties:{pilihan:{type:'array', items:{type:'object',
      properties:{judul:{type:'string'}, kunci:{type:'string', enum:[...kunciSah,'BARU','RAGU']}},
      required:['judul','kunci'], additionalProperties:false}}}, required:['pilihan'], additionalProperties:false},
    log, 2048);
  const hasil = {};
  for (const p of r.value.pilihan||[]) {
    const k = kandidat.find(x=>clean(x.judul)===clean(p.judul));
    if (k) hasil[k.judul] = p.kunci;
  }
  return hasil;
}

function baruDiTopikMd(teksLama, kunci, nama, tanggal) {
  const baris = `| \`${kunci}\` | ${nama} | auto (#log ${tanggal}) | *(belum ada — gap)* | 🆕 auto ${tanggal} — perlu konfirmasi |`;
  const baris_ = teksLama.split('\n');
  let idx = baris_.length - 1;
  while (idx>=0 && !baris_[idx].trim().startsWith('|')) idx--;
  baris_.splice(idx+1, 0, baris);
  return baris_.join('\n');
}

// ------------------------------------------------------------- papan-topik.md (Fase 2, murni agregasi)

export function tulisPapanTopik(items, daftarTopik, now) {
  const hidup = items.filter(i=>i.status!=='Closed');
  const perTopik = new Map();
  for (const it of hidup) {
    const kunci = daftarTopik.some(t=>t.kunci===it.topik) ? it.topik : '';
    if (!perTopik.has(kunci)) perTopik.set(kunci, []);
    perTopik.get(kunci).push(it);
  }
  const outstanding = hidup.filter(i=>i.status==='Outstanding').length;
  const lines = [
    '# Papan Topik YSPI', '',
    '> Dihasilkan oleh Follow-Up Reminder Fase 2 (Steward), model lokal. Snapshot bertanggal; status hidup tetap di tracker (Excel = master).', '',
    `**Snapshot:** ${dateWIB(now)} · **Total open item:** ${hidup.length} (${outstanding} Outstanding · ${hidup.length-outstanding} Kandidat Close) · **Topik dengan item hidup:** ${[...perTopik.keys()].filter(k=>k).length} dari ${daftarTopik.length} topik master`,
    '', '---', '',
  ];
  const terurut = [...perTopik.entries()].filter(([k])=>k).sort((a,b)=>daftarTopik.findIndex(t=>t.kunci===a[0])-daftarTopik.findIndex(t=>t.kunci===b[0]));
  for (const [kunci, list] of terurut) {
    const top = daftarTopik.find(t=>t.kunci===kunci);
    const provisional = /🆕 auto/.test(top.status) ? ` (${top.status})` : '';
    lines.push(`## 🔹 ${kunci} — ${top.nama}${provisional}`, '', '| Item | PIC | Target |', '|---|---|---|');
    for (const it of list) {
      lines.push(`| **[${it.id}]** ${clean(it.judul)} | ${clean(it.pic)||'—'} | ${clean(it.target)||'—'} |`);
      if (it.terbaru) lines.push(`| ↳ ${clean(it.terbaru)} | | |`);
    }
    lines.push('', '---', '');
  }
  const tanpaTopik = perTopik.get('')||[];
  if (tanpaTopik.length) {
    lines.push('## ❔ Tanpa Topik', '', '| Item | PIC | Target |', '|---|---|---|');
    for (const it of tanpaTopik) lines.push(`| **[${it.id}]** ${clean(it.judul)} | ${clean(it.pic)||'—'} | ${clean(it.target)||'—'} |`);
    lines.push('', '---', '');
  }
  const gap = daftarTopik.filter(t=>perTopik.has(t.kunci) && !punyaHalamanWiki(t));
  lines.push('## Gap Wiki', '',
    gap.length ? gap.map(t=>`- \`${t.kunci}\` — ${t.nama}${/🆕 auto/.test(t.status)?' (topik provisional, belum dikonfirmasi)':''}`).join('\n')
      : '*(semua topik dengan item hidup sudah punya halaman wiki)*', '');
  lines.push(`*Snapshot ${dateWIB(now)}. Untuk status terkini, baca tracker langsung (Excel = master).*`);
  return lines.join('\n');
}

// ------------------------------------------------------------------------- tulis (dengan jaring pengaman)

export function tulisPerubahan(perubahan, sha256Awal) {
  if (hashTracker() !== sha256Awal) throw Error('Tracker berubah sejak dibaca; batal menulis. Akan dicoba lagi run berikutnya.');
  fs.mkdirSync(KERJA, {recursive:true});
  const cap = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const cadangan = path.join(KERJA, `cadangan-drive-${cap}.xlsx`);
  fs.copyFileSync(TRACKER, cadangan);
  const berkasUbah = path.join(KERJA, `perubahan-drive-${cap}.json`);
  fs.writeFileSync(berkasUbah, JSON.stringify(perubahan, null, 2));
  const hasil = JSON.parse(execFileSync(PYTHON, [path.join(DIR,'tulis-tracker.py'), TRACKER, berkasUbah], {encoding:'utf8', timeout:120000, windowsHide:true}));
  return {...hasil, cadangan};
}

// --------------------------------------------------------------------------------- run

export async function run() {
  const uji = process.argv.includes('--uji');
  const now = new Date();
  const logLines = [];
  const log = pesan => { const baris = `${dateWIB(new Date())} ${jam()}  [kelola-tracker]${uji?' [uji]':''} ${pesan}`; console.log(baris); logLines.push(baris); try{fs.appendFileSync('C:/Users/suluh/.dsh/pengingat.log', baris+'\n');}catch{} };

  const lock = path.join(DIR, 'kelola-tracker.lock');
  if (fs.existsSync(lock)) {
    const old = JSON.parse(fs.readFileSync(lock,'utf8'));
    let live=false; try{process.kill(old.pid,0);live=true;}catch{}
    if (live) throw Error(`kelola-tracker sedang berjalan, PID ${old.pid}`);
    fs.unlinkSync(lock);
  }
  fs.writeFileSync(lock, JSON.stringify({pid:process.pid, mulai:Date.now()}), {flag:'wx'});
  const unlock = () => { try{ if(JSON.parse(fs.readFileSync(lock,'utf8')).pid===process.pid) fs.unlinkSync(lock);}catch{} };
  process.on('exit', unlock);

  try {
    const snapshot = readTracker();
    const items = snapshot.items;
    log(`Tracker dibaca: ${items.length} item.`);

    const diproses = muatDiproses();
    const semuaPesan = bacaPesanBertag(now);
    const pesanBertag = semuaPesan.filter(p => tagPesan(p.teks) && !diproses.has(p.id));
    log(`${semuaPesan.length} pesan grup 24 jam terakhir, ${pesanBertag.length} bertag baru (belum diproses).`);

    const rencana = {tutup:[], buka:[], baru:[], kabar:[], ragu:[]};
    const idBaruDipakai = new Set();
    for (const p of pesanBertag) {
      const jenis = tagPesan(p.teks);
      if (jenis === 'log') {
        const k = klasifikasiLog(p, items);
        if (k.jenis === 'kabar') {
          const item = items.find(i=>i.id===k.id);
          if (item && sudahTercerminDiRiwayat(item.riwayat, k.catatan)) {
            log(`  #log -> kabar ${k.id} DILEWATI: sudah tercermin di K (kemungkinan ditulis agen Mac sebelum mati).`);
          } else {
            rencana.kabar.push({id:k.id, catatan:k.catatan, _pesanId:p.id});
          }
        }
        else if (k.jenis === 'baru') { const {jenis:_j, ...entri} = k; rencana.baru.push({...entri, _pesanId:p.id}); }
        else rencana.ragu.push({pesanId:p.id, alasan:k.alasan, pengirim:p.pengirim, teks:p.teks.slice(0,150)});
        continue;
      }
      const target = resolusiTarget(p, items);
      if (!target.ids.length) { rencana.ragu.push({pesanId:p.id, alasan:`#${jenis} tak bisa dipastikan menunjuk item mana`, pengirim:p.pengirim, teks:p.teks.slice(0,150)}); continue; }
      // Satu pesan boleh menunjuk beberapa id sekaligus ("#close f66 f67
      // f84") - proses SEMUANYA, jangan cuma yang pertama.
      for (const id of target.ids) {
        const item = items.find(i=>i.id===id);
        if (!item) { rencana.ragu.push({pesanId:p.id, alasan:`#${jenis} menunjuk ${id} yang tidak ada di tracker`, pengirim:p.pengirim}); continue; }
        const catatan = `${jenis==='close'?'Kandidat close (#close)':'Dibuka lagi (#reopen)'} — ${p.pengirim}`;
        if (jenis === 'close') {
          if (item.status === 'Outstanding') rencana.tutup.push({id, catatan, _pesanId:p.id, _jalur:target.jalur});
          else rencana.ragu.push({pesanId:p.id, alasan:`#close ${id} tapi status sudah ${item.status}`, pengirim:p.pengirim});
        } else if (jenis === 'reopen') {
          if (item.status !== 'Outstanding') rencana.buka.push({id, catatan, _pesanId:p.id, _jalur:target.jalur});
          else rencana.ragu.push({pesanId:p.id, alasan:`#reopen ${id} tapi status sudah Outstanding`, pengirim:p.pengirim});
        }
      }
    }

    const {tutupOtomatis, isiTanggalKandidat, mendekati} = hitungAutoClose(items, now);
    log(`Auto-close: ${tutupOtomatis.length} ditutup otomatis, ${isiTanggalKandidat.length} H baru diisi, ${mendekati.length} mendekati batas.`);

    // Topik: hanya untuk item #log baru pada run ini (bukan backfill item lama
    // yang sudah bertahun-tahun Topik-nya kosong - itu perubahan lebih besar,
    // sengaja tidak dikerjakan di sini tanpa diminta terpisah).
    let daftarTopik = [];
    const topikBaruDiTopikMd = [];
    try {
      ({daftar: daftarTopik} = bacaTopikMd());
      const perluTopik = rencana.baru.filter(b=>!b.topik);
      if (perluTopik.length) {
        const deterministik = new Map();
        const sisaModel = [];
        for (const b of perluTopik) {
          const k = cocokkanTopikDeterministik(b.judul, b.pic, daftarTopik);
          if (k) deterministik.set(b.judul, k); else sisaModel.push(b);
        }
        let dariModel = {};
        if (sisaModel.length) {
          try { dariModel = await topikUntukBatch('qwen3:8b', sisaModel, daftarTopik, log); }
          catch(error) { log(`Pencocokan topik lewat model DILEWATI (${error.message}); item itu Topik dikosongkan.`); }
        }
        for (const b of rencana.baru) {
          if (deterministik.has(b.judul)) { b.topik = deterministik.get(b.judul); continue; }
          const jawab = dariModel[b.judul];
          if (!jawab || jawab === 'RAGU') continue;
          if (jawab === 'BARU') {
            const mirip = miripTopik(b.judul, daftarTopik, 0.5);
            if (mirip) { b.topik = mirip.kunci; log(`Topik "BARU" dari model untuk "${b.judul.slice(0,40)}" ditolak anti-duplikat, dipetakan ke ${mirip.kunci}.`); continue; }
            const kunci = buatKunci(b.judul, dateWIB(now).slice(0,4));
            b.topik = kunci;
            topikBaruDiTopikMd.push({kunci, nama: b.judul.length<=60?b.judul:b.judul.slice(0,57)+'...'});
          } else if (daftarTopik.some(t=>t.kunci===jawab)) {
            b.topik = jawab;
          }
        }
      }
    } catch(error) { log(`Pencocokan topik DILEWATI (${error.message}).`); }

    log(`Rencana: ${rencana.tutup.length} #close, ${rencana.buka.length} #reopen, ${rencana.baru.length} #log baru, ${rencana.kabar.length} #log jadi kabar item lama, ${rencana.ragu.length} ragu (dilewati).`);
    for (const r of rencana.ragu) log(`  RAGU: ${r.alasan} (${r.pengirim}: "${r.teks||''}")`);
    for (const b of rencana.baru) log(`  #log baru: "${b.judul.slice(0,80)}" topik=${b.topik||'(kosong)'}`);
    for (const k of rencana.kabar) log(`  #log -> kabar ${k.id}: "${k.catatan.slice(0,100)}"`);
    for (const t of rencana.tutup) log(`  #close ${t.id} (jalur ${t._jalur})`);
    for (const b of rencana.buka) log(`  #reopen ${b.id} (jalur ${b._jalur})`);
    for (const a of tutupOtomatis) log(`  auto-close ${a.id} (umur ${a.umur} hari)`);
    for (const m of mendekati) log(`  mendekati auto-close: ${m.id} (umur ${m.umur} hari, sisa ${m.sisa})`);

    if (uji) { log('Mode uji: tidak menulis apa pun.'); return {rencana, tutupOtomatis, isiTanggalKandidat, mendekati, topikBaruDiTopikMd}; }

    const perubahan = {
      tutup: rencana.tutup.map(({_pesanId,_jalur,...r})=>r),
      buka: rencana.buka.map(({_pesanId,_jalur,...r})=>r),
      baru: rencana.baru.map(({_pesanId,...r})=>r),
      kabar: rencana.kabar.map(({_pesanId,...r})=>r),
      tutupOtomatis: tutupOtomatis.map(({umur,...r})=>r),
      isiTanggalKandidat,
    };
    const adaPerubahan = Object.values(perubahan).some(a=>a.length);
    if (!adaPerubahan) {
      log('Tidak ada perubahan tracker hari ini.');
    } else {
      const hasil = tulisPerubahan(perubahan, snapshot.sha256);
      log(`Tracker ditulis. sha sebelum=${hasil.sha256_sebelum.slice(0,12)} sesudah=${hasil.sha256_sesudah.slice(0,12)} (${hasil.berubah?'berubah':'TIDAK berubah'}). Cadangan: ${path.basename(hasil.cadangan)}.`);
      for (const p of hasil.perubahan) log(`  ${p}`);
    }

    if (topikBaruDiTopikMd.length) {
      let {teks} = bacaTopikMd();
      for (const t of topikBaruDiTopikMd) teks = baruDiTopikMd(teks, t.kunci, t.nama, dateWIB(now));
      fs.writeFileSync(TOPIK_MD, teks);
      log(`topik.md: ${topikBaruDiTopikMd.length} topik baru ditambahkan (🆕 auto, perlu konfirmasi Andrian): ${topikBaruDiTopikMd.map(t=>t.kunci).join(', ')}.`);
    }

    // Baca ulang tracker (sudah berubah) untuk papan-topik supaya konsisten
    // dengan apa yang baru saja ditulis, bukan snapshot sebelum tulis.
    const setelah = readTracker();
    const {daftar: daftarTopikBaru} = bacaTopikMd();
    fs.writeFileSync(PAPAN_MD, tulisPapanTopik(setelah.items, daftarTopikBaru, now));
    log(`papan-topik.md ditulis ulang.`);

    for (const p of pesanBertag) diproses.add(p.id);
    simpanDiproses(diproses);

    return {rencana, tutupOtomatis, isiTanggalKandidat, mendekati, topikBaruDiTopikMd};
  } catch(error) { log(`GAGAL: ${error.message}`); throw error; }
  finally { unlock(); }
}

// Perbandingan jalur asli (bukan string import.meta.url mentah) - di Windows
// import.meta.url punya format "file:///C:/..." (tiga garis miring) yang
// gampang meleset kalau disamakan manual; fileURLToPath+path.resolve aman
// dari itu. Pola yang sama seperti DIR di atas dan di lokal-lengkap.mjs.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch(error => { console.error('GAGAL:', error.stack||error.message); process.exitCode = 1; });
}
