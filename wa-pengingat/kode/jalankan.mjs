import fs from 'node:fs';
import { run, OLLAMA, dateWIB } from './lokal-lengkap.mjs';
import { run as kelolaTracker } from './kelola-tracker.mjs';

const sesi = process.argv[2] || 'pagi';

// Saat PC baru dinyalakan, Penjadwal Tugas (StartWhenAvailable) bisa memulai
// putaran sebelum penjaga sempat menghidupkan Ollama/router - 24 Okt 2026
// 10.00 gagal "Ollama HTTP 502 ... ECONNREFUSED 11434" lalu 10.12 berhasil.
// Jadi tunggu dulu sampai /api/tags menjawab (lewat router, jadi router DAN
// Ollama sama-sama hidup), paling lama TUNGGU_MENIT. Kalau tetap mati, lanjut
// saja: run() gagal dengan pesan aslinya dan pemicu 10.00/13.00 mencoba lagi.
const TUNGGU_MENIT = 10;
async function tungguModel() {
  const catat = pesan => {
    const jam = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jakarta', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}).format(new Date());
    const baris = `${dateWIB(new Date())} ${jam}  [${sesi}] ${pesan}`;
    console.log(baris);
    try { fs.appendFileSync('C:/Users/suluh/.dsh/pengingat.log', baris+'\n'); } catch {}
  };
  const batas = Date.now() + TUNGGU_MENIT*60000;
  for (let ke = 1; ; ke++) {
    try {
      const r = await fetch(OLLAMA+'/api/tags', {signal: AbortSignal.timeout(5000)});
      if (r.ok) { if (ke > 1) catat(`Model lokal siap setelah menunggu (${ke} kali cek).`); return; }
    } catch {}
    if (Date.now() >= batas) { catat(`Model lokal belum menjawab setelah ${TUNGGU_MENIT} menit; tetap dicoba.`); return; }
    if (ke === 1) catat(`Model lokal (${OLLAMA}) belum siap; menunggu sampai ${TUNGGU_MENIT} menit.`);
    await new Promise(selesai => setTimeout(selesai, 15000));
  }
}

async function utama() {
  if (sesi === 'pagi') {
    await tungguModel();
    // Fase 1 (serap #log/#close/#reopen, auto-close 5 hari, topik,
    // papan-topik.md) dulu, supaya laporan pagi mencerminkan perubahan hari
    // itu - sama seperti urutan aturan asli. Sejak 23 Sep 2026 (agen Mac
    // dimatikan): ini satu-satunya yang menulis tracker + papan-topik.md.
    //
    // Kegagalan di sini TIDAK membatalkan laporan harian - kelola-tracker.mjs
    // sudah mencatat sendiri ke pengingat.log, dan laporan tetap dikirim dari
    // tracker apa adanya (pola sama seperti kabar obrolan yang boleh gagal
    // tanpa membatalkan pengiriman, lihat daily() di lokal-lengkap.mjs).
    try { await kelolaTracker(); }
    catch (error) { console.error('kelola-tracker GAGAL (laporan tetap lanjut):', error.stack || error.message); }
  }
  await run();
}

utama().catch(error => { console.error('GAGAL:', error.stack || error.message); process.exitCode = 1; });
