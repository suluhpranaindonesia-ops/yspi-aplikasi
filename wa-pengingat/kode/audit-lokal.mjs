// Audit follow-up oleh model lokal: baca grup → tulis ke salinan tracker →
// kirim ringkasan ke grup YSPI team.
//
// Keputusan pengguna 15 Sep 2026:
//   - model lokal yang membaca, menulis, dan mengirim;
//   - tracker ditulis di SALINAN LOKAL, bukan berkas Drive (agen Mac menulis
//     berkas Drive tiap pagi; dua penulis di dua mesin melahirkan salinan konflik);
//   - hasilnya dikirim ke grup YSPI team, bukan ke Daniel.
//
// Kenapa bukan lewat harness: pwsh di DSH tidak bisa jalan di vault G: (Drive
// tanpa ACL NTFS) dan harness gagal menimpa berkas di sana (SetFileSecurityW EIO,
// 14 Sep). Jalur alat di sini sama dengan pengingat harian, yang sudah terbukti
// memanggil kirim_whatsapp sendiri.
//
// Model memanggil tiga alat BERURUTAN. Tiap argumen diperiksa; kalau ditolak,
// alasannya dikembalikan ke model sebagai hasil alat dan model memperbaiki sendiri.
//
// Pakai: node audit-lokal.mjs [--kirim] [--paksa] [--hari=3] [--model=<id>] [--ctx=16384]
//   tanpa --kirim: semua langkah jalan, tapi ringkasan hanya disimpan, tidak diantrekan.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BRIDGE, TRACKER, groupMessages, ollamaChat, clean, dateWIB, dateLong, latest } from './lokal-lengkap.mjs';
import { periksaUsulan, buktiSingkat } from './audit-penjaga.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname.slice(1));
const PYTHON = 'C:/Users/suluh/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const KERJA = 'C:/Users/suluh/wa-konsol/tracker-kerja';
const SALINAN = path.join(KERJA, 'YSPI-Follow-Up-Tracker.xlsx');
export const GRUP = '<id-grup-yspi>@g.us';

const argumen = (nama, bawaan) => process.argv.find((a) => a.startsWith(`--${nama}=`))?.split('=')[1] ?? bawaan;
const kirimSungguhan = process.argv.includes('--kirim');
const hari = Number(argumen('hari', 3));
const now = new Date(), tanggal = dateWIB(now);
const config = JSON.parse(fs.readFileSync(path.join(BRIDGE, 'pengingat.json'), 'utf8'));
const model = argumen('model', config.model || 'qwen3.8:latest');
// Ukuran konteks harus sama dengan runner yang sudah termuat; kalau berbeda,
// Ollama memuat salinan model kedua (18-19 GB) di mesin 26,7 GB.
const konteks = Number(argumen('ctx', 16384));

const catat = (pesan) => {
  const jam = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
  const baris = `${tanggal} ${jam}  [audit] ${pesan}`;
  console.log(baris);
  try { fs.appendFileSync('C:/Users/suluh/.dsh/pengingat.log', baris + '\n'); } catch {}
};

if (/cloud/i.test(model)) throw Error('Model cloud tidak diizinkan.');
if (KERJA.toLowerCase().startsWith('g:')) throw Error('Salinan kerja tidak boleh di Drive.');

// ── 1. salinan segar ───────────────────────────────────────────────────────
// Tiap putaran mulai dari tracker Drive yang terbaru, supaya audit mencerminkan
// keadaan nyata. Salinan lama (termasuk tulisan putaran sebelumnya) dicadangkan.
fs.mkdirSync(KERJA, { recursive: true });
const cap = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
if (fs.existsSync(SALINAN)) fs.copyFileSync(SALINAN, path.join(KERJA, `sebelum-${cap}.xlsx`));
fs.copyFileSync(TRACKER, SALINAN);

const bacaSalinan = () => {
  const r = JSON.parse(execFileSync(PYTHON, [path.join(DIR, 'baca-tracker.py'), SALINAN], { encoding: 'utf8', timeout: 120000, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }));
  const items = r.rows.filter((x) => /^F\d+$/.test(x[0])).map((x) => ({ id: x[0], judul: x[1], pic: x[2], target: x[4], status: x[5], riwayat: x[10], terbaru: latest(x[10]) }));
  return { items, sha256: r.sha256 };
};
const { items, sha256 } = bacaSalinan();
const terbukaDaftar = items.filter((i) => i.status !== 'Closed');
const terbuka = new Set(terbukaDaftar.map((i) => i.id));
catat(`salinan tracker disegarkan dari Drive: ${items.length} item, ${terbuka.size} terbuka, sha ${sha256.slice(0, 12)}`);

// ── 2. bahan ───────────────────────────────────────────────────────────────
const pesan = groupMessages(hari);
if (!pesan.length) { catat(`tidak ada pesan grup ${hari} hari terakhir; audit dibatalkan`); process.exit(0); }
const pesanPerKode = new Map(pesan.map((p, n) => [`P${n + 1}`, { ...p, kode: `P${n + 1}` }]));
const bahan = [
  `Tanggal: ${dateLong(now)}`,
  '',
  '## Item terbuka di tracker (ID | status | PIC | tenggat | judul | catatan terakhir)',
  ...terbukaDaftar.map((i) => `${i.id} | ${i.status} | ${clean(i.pic) || '-'} | ${clean(i.target) || '-'} | ${clean(i.judul).slice(0, 95)} | ${clean(i.terbaru).slice(0, 110) || '-'}`),
  '',
  `## Percakapan grup YSPI team (${hari} hari terakhir, P1 sampai P${pesan.length})`,
  ...[...pesanPerKode.values()].map((p) => `[${p.kode}] ${clean(p.pengirim) || 'anggota'}: ${clean(p.teks).slice(0, 300)}`),
].join('\n');

// ── 3. alat ────────────────────────────────────────────────────────────────
const barisUsulan = { type: 'object', properties: { id: { type: 'string' }, bukti: { type: 'string' }, alasan: { type: 'string' } }, required: ['id', 'bukti', 'alasan'] };
const ALAT = [
  { type: 'function', function: { name: 'ajukan_perubahan',
    description: 'Ajukan hasil audit. Setiap baris wajib menunjuk satu kode pesan grup (P1, P2, ...) sebagai bukti yang benar-benar membahas isi item.',
    parameters: { type: 'object', properties: {
      logBaru: { type: 'array', description: 'Tugas/komitmen baru yang jelas diambil seseorang dan belum ada di tracker.', items: { type: 'object', properties: { judul: { type: 'string' }, pic: { type: 'string' }, target: { type: 'string' }, bukti: { type: 'string' }, alasan: { type: 'string' } }, required: ['judul', 'bukti', 'alasan'] } },
      usulTutup: { type: 'array', description: 'Item terbuka yang menurut percakapan sudah selesai.', items: barisUsulan },
      seharusnyaTutup: { type: 'array', description: 'Item yang buktinya sudah selesai tetapi statusnya masih terbuka.', items: barisUsulan },
    }, required: ['logBaru', 'usulTutup', 'seharusnyaTutup'] } } },
  { type: 'function', function: { name: 'tulis_ke_tracker',
    description: 'Tulis usulan yang sudah diterima ke salinan tracker lokal. Isinya diambil dari usulan yang sudah lolos pemeriksaan.',
    parameters: { type: 'object', properties: { konfirmasi: { type: 'boolean' } }, required: ['konfirmasi'] } } },
  { type: 'function', function: { name: 'kirim_ringkasan',
    description: 'Kirim ringkasan audit ke grup WhatsApp YSPI team. Daftar item dirangkai program dari usulanmu; kamu hanya menulis kalimat pembuka.',
    parameters: { type: 'object', properties: { tujuan: { type: 'string' }, pembuka: { type: 'string' } }, required: ['tujuan', 'pembuka'] } } },
];

const sistem = `Kamu auditor follow-up Yayasan Suluh Prana Indonesia. Bandingkan percakapan grup dengan item terbuka di tracker, lalu kerjakan tiga langkah BERURUTAN dengan memanggil alat:
1. ajukan_perubahan — isi tiga daftar. Setiap baris wajib menyebut bukti berupa satu kode pesan (P1 sampai P${pesan.length}) yang isinya BENAR-BENAR membahas item itu. Kelamaan bukan bukti selesai. Rencana, wacana, dan pertanyaan bukan komitmen. alasan satu kalimat bahasa Indonesia, paling banyak 25 kata. Daftar yang tidak ada isinya tulis []. Jangan mengarang.
2. tulis_ke_tracker — setelah usulan diterima.
3. kirim_ringkasan — tujuan wajib ${GRUP}; pembuka satu atau dua kalimat hangat bahasa Indonesia untuk tim.
Jangan menulis tag #log, #close, atau #reopen di mana pun: agen lain membacanya sebagai perintah. Jawab hanya dengan memanggil alat.`;

// ── 4. putaran model ───────────────────────────────────────────────────────
const riwayatPercakapan = [{ role: 'system', content: sistem }, { role: 'user', content: bahan }];
const jejak = { tanggal, model, sha256Salinan: sha256, langkah: [] };
let usulanSah = null, sudahTulis = false, hasilTulis = null, ringkasan = null;
const batasPutaran = 10;
// Jejak ditulis SETIAP langkah. 15 Sep 18.34: usulan putaran 1 diterima, lalu
// putaran 2 kena batas waktu dan proses berhenti; karena jejak baru ditulis di
// akhir, usulan yang sudah lolos ikut hilang.
const berkasJejak = path.join(BRIDGE, 'pengingat', `audit-lokal-${tanggal}-${cap.slice(11)}.json`);
const simpanJejak = () => { jejak.usulan = usulanSah; jejak.tulis = hasilTulis; jejak.ringkasan = ringkasan; try { fs.writeFileSync(berkasJejak, JSON.stringify(jejak, null, 2)); } catch {} };

for (let putaran = 1; putaran <= batasPutaran && !ringkasan; putaran++) {
  const mulai = Date.now();
  const jawab = await ollamaChat({ model, messages: riwayatPercakapan, tools: ALAT, stream: false, think: false, keep_alive: '10m', options: { num_ctx: konteks, temperature: 0 } });
  const detik = Math.round((Date.now() - mulai) / 1000);
  const panggilan = jawab.message?.tool_calls || [];
  riwayatPercakapan.push({ role: 'assistant', content: jawab.message?.content || '', tool_calls: panggilan });
  if (!panggilan.length) {
    catat(`putaran ${putaran} (${detik} dtk): model menjawab tanpa memanggil alat`);
    jejak.langkah.push({ putaran, detik, teks: clean(jawab.message?.content).slice(0, 300) });
    riwayatPercakapan.push({ role: 'user', content: 'Jangan menjawab dengan teks. Panggil alat langkah berikutnya.' });
    continue;
  }
  for (const p of panggilan) {
    const nama = p.function?.name;
    const arg = p.function?.arguments || {};
    let hasil;
    if (nama === 'ajukan_perubahan') {
      const masalah = periksaUsulan(arg, { pesanPerKode, terbuka, items });
      if (masalah.length) {
        hasil = { diterima: false, perbaiki: masalah };
      } else {
        usulanSah = { logBaru: arg.logBaru, usulTutup: arg.usulTutup, seharusnyaTutup: arg.seharusnyaTutup };
        hasil = { diterima: true, jumlah: { logBaru: arg.logBaru.length, usulTutup: arg.usulTutup.length, seharusnyaTutup: arg.seharusnyaTutup.length }, berikutnya: 'panggil tulis_ke_tracker' };
      }
    } else if (nama === 'tulis_ke_tracker') {
      if (!usulanSah) hasil = { diterima: false, perbaiki: ['Ajukan perubahan dulu lewat ajukan_perubahan sampai diterima.'] };
      else if (sudahTulis) hasil = { diterima: true, catatan: 'sudah ditulis sebelumnya', berikutnya: 'panggil kirim_ringkasan' };
      else {
        const asal = (b) => `${clean(b.alasan)} [bukti ${b.bukti}: ${buktiSingkat(pesanPerKode, b.bukti)}] (audit agen lokal)`;
        const perubahan = {
          tutup: [...usulanSah.usulTutup, ...usulanSah.seharusnyaTutup].map((b) => ({ id: b.id, catatan: asal(b) })),
          baru: usulanSah.logBaru.map((b) => ({ judul: clean(b.judul), pic: clean(b.pic), target: clean(b.target), catatan: asal(b) })),
        };
        if (!perubahan.tutup.length && !perubahan.baru.length) {
          hasilTulis = { berubah: false, perubahan: [] };
        } else {
          const berkasUbah = path.join(KERJA, `perubahan-audit-${cap}.json`);
          fs.writeFileSync(berkasUbah, JSON.stringify(perubahan, null, 2));
          hasilTulis = JSON.parse(execFileSync(PYTHON, [path.join(DIR, 'tulis-tracker.py'), SALINAN, berkasUbah], { encoding: 'utf8', timeout: 120000, windowsHide: true }));
        }
        sudahTulis = true;
        catat(`model menulis ke salinan tracker: ${hasilTulis.perubahan.length ? hasilTulis.perubahan.join('; ') : 'tidak ada perubahan'}`);
        hasil = { diterima: true, perubahan: hasilTulis.perubahan, berikutnya: 'panggil kirim_ringkasan' };
      }
    } else if (nama === 'kirim_ringkasan') {
      const pembuka = clean(arg.pembuka);
      const masalah = [];
      if (!sudahTulis) masalah.push('Tulis ke tracker dulu lewat tulis_ke_tracker.');
      if (clean(arg.tujuan) !== GRUP) masalah.push(`tujuan wajib ${GRUP}, bukan "${clean(arg.tujuan)}".`);
      if (!pembuka) masalah.push('pembuka kosong.');
      else if (pembuka.split(' ').length > 45) masalah.push(`pembuka ${pembuka.split(' ').length} kata, batas 45.`);
      if (/#(?:log|close|reopen)/i.test(pembuka)) masalah.push('pembuka memuat tag #log/#close/#reopen.');
      if (/\bF\d+\b/.test(pembuka)) masalah.push('pembuka jangan menyebut kode item; daftar item dirangkai program.');
      if (masalah.length) hasil = { diterima: false, perbaiki: masalah };
      else { ringkasan = { tujuan: GRUP, pembuka }; hasil = { diterima: true }; }
    } else {
      hasil = { diterima: false, perbaiki: [`alat "${nama}" tidak dikenal`] };
    }
    catat(`putaran ${putaran} (${detik} dtk): ${nama} → ${hasil.diterima ? 'diterima' : 'ditolak: ' + hasil.perbaiki.join(' | ')}`);
    jejak.langkah.push({ putaran, detik, alat: nama, argumen: arg, hasil });
    riwayatPercakapan.push({ role: 'tool', content: JSON.stringify(hasil) });
    simpanJejak();
  }
}

simpanJejak();
if (!ringkasan) { catat(`model tidak menyelesaikan tiga langkah dalam ${batasPutaran} putaran; tidak ada yang dikirim. Jejak: ${path.basename(berkasJejak)}`); process.exit(1); }

// ── 5. rangkai ringkasan ───────────────────────────────────────────────────
// Daftar dirangkai program dari usulan yang sudah lolos, jadi tiap baris
// dijamin punya bukti nyata. Kalimat pembuka dan alasan tulisan model.
const judulItem = (id) => clean(items.find((i) => i.id === id)?.judul).slice(0, 80);
const blok = (label, daftar, baris) => daftar.length ? [label, ...daftar.flatMap(baris), ''] : [];
const teks = [
  `📋 Audit Follow-Up YSPI — ${dateLong(now)}`,
  '',
  ringkasan.pembuka,
  '',
  ...blok('🆕 Layak dicatat sebagai item baru:', usulanSah.logBaru, (b) => [`  • ${clean(b.judul)}${clean(b.pic) ? ` — PIC ${clean(b.pic)}` : ''}${clean(b.target) ? `, tenggat ${clean(b.target)}` : ''}`, `      ↳ ${clean(b.alasan)} (dasar: ${buktiSingkat(pesanPerKode, b.bukti)})`]),
  ...blok('✅ Layak diusulkan tutup:', usulanSah.usulTutup, (b) => [`  • [${b.id}] ${judulItem(b.id)}`, `      ↳ ${clean(b.alasan)} (dasar: ${buktiSingkat(pesanPerKode, b.bukti)})`]),
  ...blok('⚠️ Seharusnya sudah ditutup tapi masih terbuka:', usulanSah.seharusnyaTutup, (b) => [`  • [${b.id}] ${judulItem(b.id)}`, `      ↳ ${clean(b.alasan)} (dasar: ${buktiSingkat(pesanPerKode, b.bukti)})`]),
  'Ini usulan dari agen lokal, belum mengubah tracker resmi. Mohon PIC masing-masing mengonfirmasi.',
].join('\n');

const kosong = !usulanSah.logBaru.length && !usulanSah.usulTutup.length && !usulanSah.seharusnyaTutup.length;
if (/#(?:log|close|reopen)/i.test(teks)) throw Error('Ringkasan memuat tag perintah; tidak dikirim.');
const berkasMd = path.join(BRIDGE, 'pengingat', `audit-grup-${tanggal}.md`);
fs.writeFileSync(berkasMd, teks);
catat(`ringkasan dirangkai: ${teks.length} huruf${kosong ? ' (tidak ada usulan)' : ''} → ${path.basename(berkasMd)}`);

// ── 6. kirim ───────────────────────────────────────────────────────────────
if (kosong) { catat('tidak ada usulan; grup tidak dikirimi pesan kosong'); process.exit(0); }
if (!kirimSungguhan) { catat('mode tinjau: ringkasan TIDAK diantrekan. Jalankan dengan --kirim untuk mengirim ke grup.'); process.exit(0); }
const status = fs.readFileSync(path.join(BRIDGE, 'status.md'), 'utf8');
if (!/keadaan: \*\*tersambung\*\*/.test(status)) throw Error('WhatsApp belum tersambung; ringkasan disimpan, belum diantrekan.');
const kunci = `audit-grup-${tanggal}`;
const sudah = [path.join(BRIDGE, 'antrian'), path.join(BRIDGE, 'outbox')].flatMap((d) => fs.readdirSync(d)).some((f) => f.startsWith(kunci));
if (sudah && !process.argv.includes('--paksa')) { catat('audit hari ini sudah pernah dikirim ke grup; tidak mengirim ganda'); process.exit(0); }
const nama = sudah ? `${kunci}-${Date.now()}` : kunci;
fs.writeFileSync(path.join(BRIDGE, 'antrian', nama + '.json'), JSON.stringify({ to: GRUP, text: teks }, null, 2), { flag: 'wx' });
catat(`DIANTRIKAN ${nama}.json → grup YSPI team atas panggilan kirim_ringkasan oleh model; menunggu bukti outbox`);
