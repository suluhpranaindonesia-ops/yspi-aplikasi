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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bukaGudang } from './gudang.mjs';

const AKAR = path.dirname(fileURLToPath(import.meta.url));
const PENGHUBUNG = 'C:\\Users\\suluh\\Documents\\Codex\\2026-09-14\\co\\outputs\\yspi-supabase';
const PROYEK = 'xpvaayxfsfvwyizkyrzw', CLOUD = `https://${PROYEK}.supabase.co`;
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

let kunci = '';
async function ambil(rute, biner = false) {
  if (!kunci) {
    const { unprotectSecret } = await import(pathToFileURL(path.join(PENGHUBUNG, 'secure-config.mjs')).href);
    const cfg = JSON.parse(fs.readFileSync(path.join(PENGHUBUNG, 'state', 'connection.json'), 'utf8'));
    if (cfg.project !== PROYEK) throw new Error('Konfigurasi penghubung bukan proyek Pelaporan Guru YSPI.');
    kunci = unprotectSecret(cfg.protectedKey);
  }
  // Hanya GET. Tidak ada method lain di berkas ini.
  const r = await fetch(CLOUD + rute, { method: 'GET', headers: { apikey: kunci }, signal: AbortSignal.timeout(60_000), redirect: 'error' });
  if (!r.ok) throw new Error('Supabase ' + r.status + ' pada ' + rute.split('?')[0]);
  return biner ? Buffer.from(await r.arrayBuffer()) : r.json();
}

const gudang = bukaGudang(TUJUAN, catat);
const SUMBER = { review: 'Perlu diperiksa', approved: 'Disetujui' };
const KENDALA = { open: 'Terbuka', progress: 'Diproses', resolved: 'Selesai' };

async function sinkron() {
  if (status.jalan) return;
  status.jalan = true;
  status.terakhir = new Date().toISOString();
  try {
    const laporan = await ambil('/rest/v1/yspi_reports?select=*&order=created_at.asc&limit=10000');
    const media = await ambil('/rest/v1/yspi_media?select=*&order=created_at.asc&limit=10000');
    let baru = 0, diubah = 0, mediaBaru = 0;
    for (const { created_by, status: st, issue_status, ...isi } of laporan) {
      const h = gudang.samakan({ ...isi, status_periksa: SUMBER[st] || st, status_kendala: KENDALA[issue_status] || issue_status });
      if (h === 'baru') baru++; else if (h === 'ubah') diubah++;
    }
    for (const m of media) {
      if (gudang.adaMedia(m.id) || !gudang.laporan(m.report_id)) continue;
      const isi = await ambil('/storage/v1/object/authenticated/yspi-media/' + m.path.split('/').map(encodeURIComponent).join('/'), true);
      gudang.tambahMedia({ id: m.id, report_id: m.report_id, type: m.type, isi, created_at: m.created_at, name: m.name });
      mediaBaru++;
    }
    gudang.tulisRekap();
    Object.assign(status, { berhasil: new Date().toISOString(), laporan: laporan.length, media: media.length, baru, diubah, mediaBaru, galat: '' });
    if (baru || diubah || mediaBaru) catat(`Sinkron: ${laporan.length} laporan (${baru} baru, ${diubah} diubah), ${mediaBaru} media baru.`);
  } catch (e) {
    status.galat = String(e.message || e).replaceAll(kunci || '\u0000', '[disensor]');
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
