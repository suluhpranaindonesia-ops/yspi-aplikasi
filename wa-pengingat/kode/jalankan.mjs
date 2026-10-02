import { run } from './lokal-lengkap.mjs';
import { run as kelolaTracker } from './kelola-tracker.mjs';

const sesi = process.argv[2] || 'pagi';

async function utama() {
  if (sesi === 'pagi') {
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
