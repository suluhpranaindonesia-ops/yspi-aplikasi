// Audit Management Checker YSPI — web lokal (hanya 127.0.0.1).
// Jalankan: node server.mjs  → http://127.0.0.1:3466 (dijalankan penjaga lewat jalan.cmd)
// AUDIT_PORT mengganti port; AUDIT_UJI=1 = instans uji: tanpa pemantau, tidak menulis data.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RANAH, STATUS, semuaButir } from './butir.mjs';
import { jalankanSemua } from './cek.mjs';
import { PERBAIKI } from './perbaiki.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.AUDIT_PORT || 3466);
const UJI = process.env.AUDIT_UJI === '1';
const HASIL = path.join(DIR, 'data', 'hasil-terakhir.json');
const HOST_SAH = new RegExp(`^(127\\.0\\.0\\.1|localhost):${PORT}$`);

let otomatis = null;
if (!UJI) otomatis = await import('./otomatis.mjs');

const kirim = (res, kode, isi, tipe = 'application/json; charset=utf-8') => {
  res.writeHead(kode, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof isi === 'string' || Buffer.isBuffer(isi) ? isi : JSON.stringify(isi));
};

const server = http.createServer(async (req, res) => {
  // Tolak permintaan dari situs lain (DNS rebinding / CSRF)
  if (!HOST_SAH.test(req.headers.host || '')) return kirim(res, 403, { galat: 'Host ditolak' });
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') return kirim(res, 200, fs.readFileSync(path.join(DIR, 'index.html')), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/butir') return kirim(res, 200, { status: STATUS, ranah: RANAH.map((r) => ({ kode: r.kode, nama: r.nama })), butir: semuaButir().map((b) => ({ ...b, perbaikan: PERBAIKI[b.id]?.label || '' })) });
    if (req.method === 'GET' && url.pathname === '/api/hasil') return kirim(res, 200, fs.existsSync(HASIL) ? fs.readFileSync(HASIL, 'utf8') : '{}');
    // Instans uji: menjalankan semua cek tanpa menyimpan (dipakai otomatis.mjs untuk menguji kode baru)
    if (req.method === 'GET' && url.pathname === '/api/cek' && UJI) return kirim(res, 200, await jalankanSemua({ uji: true }));
    if (req.method === 'GET' && url.pathname === '/api/otomatis') return kirim(res, 200, otomatis ? otomatis.riwayat() : { aktif: false, riwayat: [] });
    if (req.method === 'POST' && (url.pathname === '/api/otomatis/jalan' || url.pathname === '/api/perbaiki')) {
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return kirim(res, 415, { galat: 'Harus JSON' });
      if (!otomatis) return kirim(res, 409, { galat: 'Pemantau tidak aktif di instans ini' });
      if (url.pathname === '/api/otomatis/jalan') { otomatis.jalankan('manual'); return kirim(res, 202, { ok: true }); }
      let isi = ''; for await (const c of req) { isi += c; if (isi.length > 1000) return kirim(res, 413, { galat: 'Terlalu besar' }); }
      const { id } = JSON.parse(isi || '{}');
      if (id !== 'semua' && !PERBAIKI[id]) return kirim(res, 400, { galat: `Tidak ada perbaikan otomatis untuk ${id}` });
      return kirim(res, 200, { hasil: await otomatis.perbaiki(id) });
    }
    kirim(res, 404, { galat: 'Tidak ditemukan' });
  } catch (e) { kirim(res, 500, { galat: e.message }); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Audit Management Checker: http://127.0.0.1:${PORT}${UJI ? ' (uji)' : ''}`);
  if (otomatis) otomatis.mulai();
});
