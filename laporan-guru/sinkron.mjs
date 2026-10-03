// Sinkron SATU ARAH: Supabase "Pelaporan Guru YSPI" -> Drive DRAFT\Laporan Guru.
//
// Laporan tetap masuk ke Supabase lewat penghubung #laporan (yspi-supabase). Program
// ini tiap 15 menit hanya MEMBACA (GET) Supabase lalu menyamakan gudang Drive:
// data\laporan.json + Rekap-Laporan-Guru-YSPI.xlsx + Foto\. Tidak pernah menulis ke
// Supabase dan tidak pernah menghapus berkas di Drive. Tanpa model AI apa pun.
//
// Dijalankan penjaga lewat jalan-sinkron.cmd (port 3463). Status: http://127.0.0.1:3463/status

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bukaGudang } from './gudang.mjs';
import { ambilSemua, ambilBerkas, sensor } from './supabase-baca.mjs';

const AKAR = path.dirname(fileURLToPath(import.meta.url));
const TUJUAN = process.env.LAPORAN_GURU_TUJUAN || 'C:\\Users\\suluh\\Vault-SPI\\DRAFT\\Laporan Guru';
const DATA = process.env.LAPORAN_GURU_DATA || path.join(AKAR, 'data');
const PORT = Number(process.env.LAPORAN_GURU_PORT || 3463);
const JEDA = 15 * 60_000;

fs.mkdirSync(DATA, { recursive: true });
const status = { jalan: false, mulai: new Date().toISOString(), terakhir: null, berhasil: null, laporan: 0, media: 0, baru: 0, diubah: 0, mediaBaru: 0, galat: '', tujuan: TUJUAN };
function catat(pesan) {
  const baris = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + '  ' + pesan;
  console.log(baris);
  try { fs.appendFileSync(path.join(DATA, 'sinkron.log'), baris + '\n'); } catch {}
}


const gudang = bukaGudang(TUJUAN, catat);
const SUMBER = { review: 'Perlu diperiksa', approved: 'Disetujui' };
const KENDALA = { open: 'Terbuka', progress: 'Diproses', resolved: 'Selesai' };

async function sinkron() {
  if (status.jalan) return;
  status.jalan = true;
  status.terakhir = new Date().toISOString();
  try {
    // Per halaman 1.000 sampai habis; gagal kalau jumlahnya tidak sama dengan total Supabase.
    const laporan = await ambilSemua('yspi_reports');
    const media = await ambilSemua('yspi_media');
    let baru = 0, diubah = 0, mediaBaru = 0;
    for (const { created_by, status: st, issue_status, ...isi } of laporan) {
      const h = gudang.samakan({ ...isi, status_periksa: SUMBER[st] || st, status_kendala: KENDALA[issue_status] || issue_status });
      if (h === 'baru') baru++; else if (h === 'ubah') diubah++;
    }
    for (const m of media) {
      if (gudang.adaMedia(m.id) || !gudang.laporan(m.report_id)) continue;
      const isi = await ambilBerkas('/storage/v1/object/authenticated/yspi-media/' + m.path.split('/').map(encodeURIComponent).join('/'));
      gudang.tambahMedia({ id: m.id, report_id: m.report_id, type: m.type, isi, created_at: m.created_at, name: m.name });
      mediaBaru++;
    }
    gudang.tulisRekap();
    Object.assign(status, { berhasil: new Date().toISOString(), laporan: laporan.length, media: media.length, baru, diubah, mediaBaru, galat: '' });
    if (baru || diubah || mediaBaru) catat(`Sinkron: ${laporan.length} laporan (${baru} baru, ${diubah} diubah), ${mediaBaru} media baru.`);
  } catch (e) {
    status.galat = sensor(e.message || e);
    catat('GAGAL: ' + status.galat);
  } finally {
    status.jalan = false;
  }
}

if (process.argv.includes('--sekali')) {
  await sinkron();
  console.log(JSON.stringify(status, null, 1));
  process.exit(status.galat ? 1 : 0);
}

const server = http.createServer((req, res) => {
  const json = (d, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(d, null, 1)); };
  if (req.headers.host !== `127.0.0.1:${PORT}` && req.headers.host !== `localhost:${PORT}`) return json({ galat: 'Host tidak diizinkan' }, 403);
  if (req.method === 'GET' && req.url === '/status') return json({ ...status, jedaMenit: JEDA / 60_000 });
  if (req.method === 'POST' && req.url === '/sinkron') { sinkron(); return json({ ok: true }); }
  json({ galat: 'Tidak ditemukan' }, 404);
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} sudah dipakai; sinkron mungkin sudah berjalan.` : e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => {
  catat(`Sinkron Supabase -> Drive mulai (port ${PORT}) -> ${TUJUAN}`);
  sinkron();
  setInterval(sinkron, JEDA);
});
