// Audit Management Checker YSPI — web lokal (hanya 127.0.0.1).
// Jalankan: node server.mjs  → http://127.0.0.1:3466 (dijalankan penjaga lewat jalan.cmd)
// AUDIT_PORT mengganti port; AUDIT_UJI=1 = instans uji tanpa pemantau (dipakai otomatis.mjs).
// Hasil audit disimpan di data\audit-<id>.json (tidak ada yang dihapus).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RANAH, SKALA, semuaButir } from './butir.mjs';
import { cekSistem } from './cek.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.AUDIT_PORT || 3466);
const UJI = process.env.AUDIT_UJI === '1';
const DATA = path.join(DIR, 'data');
const HOST_SAH = new RegExp(`^(127\\.0\\.0\\.1|localhost):${PORT}$`);
fs.mkdirSync(DATA, { recursive: true });

let otomatis = null;
if (!UJI) otomatis = await import('./otomatis.mjs');

const idSah = (id) => /^[0-9A-Za-z-]{1,60}$/.test(id);
const kirim = (res, kode, isi, tipe = 'application/json; charset=utf-8') => {
  res.writeHead(kode, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof isi === 'string' || Buffer.isBuffer(isi) ? isi : JSON.stringify(isi));
};
const wajibJson = (req) => (req.headers['content-type'] || '').startsWith('application/json');

const server = http.createServer(async (req, res) => {
  // Tolak permintaan dari situs lain (DNS rebinding / CSRF)
  if (!HOST_SAH.test(req.headers.host || '')) return kirim(res, 403, { galat: 'Host ditolak' });
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') return kirim(res, 200, fs.readFileSync(path.join(DIR, 'index.html')), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/butir') return kirim(res, 200, { skala: SKALA, ranah: RANAH.map((r) => ({ kode: r.kode, nama: r.nama })), butir: semuaButir() });
    if (req.method === 'GET' && url.pathname === '/api/cek') return kirim(res, 200, await cekSistem());
    if (req.method === 'GET' && url.pathname === '/api/otomatis') return kirim(res, 200, otomatis ? otomatis.riwayat() : { aktif: false, riwayat: [] });
    if (req.method === 'POST' && url.pathname === '/api/otomatis/jalan') {
      if (!wajibJson(req)) return kirim(res, 415, { galat: 'Harus JSON' });
      if (!otomatis) return kirim(res, 409, { galat: 'Pemantau tidak aktif di instans ini' });
      otomatis.jalankan('manual');
      return kirim(res, 202, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/sesi') {
      const daftar = fs.readdirSync(DATA).filter((f) => /^audit-.*\.json$/.test(f)).map((f) => {
        const s = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
        return { id: s.id, judul: s.judul, diubah: s.diubah, terisi: Object.values(s.jawaban || {}).filter((j) => j.status).length };
      }).sort((a, b) => (b.diubah || '').localeCompare(a.diubah || ''));
      return kirim(res, 200, daftar);
    }
    const m = url.pathname.match(/^\/api\/sesi\/([^/]+)$/);
    if (m && idSah(m[1])) {
      const berkas = path.join(DATA, `audit-${m[1]}.json`);
      if (req.method === 'GET') return fs.existsSync(berkas) ? kirim(res, 200, fs.readFileSync(berkas, 'utf8')) : kirim(res, 404, { galat: 'Tidak ada' });
      if (req.method === 'PUT') {
        if (!wajibJson(req)) return kirim(res, 415, { galat: 'Harus JSON' });
        let isi = '';
        for await (const c of req) { isi += c; if (isi.length > 2e6) return kirim(res, 413, { galat: 'Terlalu besar' }); }
        const s = JSON.parse(isi);
        const simpan = { id: m[1], judul: String(s.judul || '').slice(0, 200), pemeriksa: String(s.pemeriksa || '').slice(0, 200), periode: String(s.periode || '').slice(0, 100), jawaban: s.jawaban || {}, diubah: new Date().toISOString() };
        fs.writeFileSync(berkas + '.tmp', JSON.stringify(simpan, null, 1));
        fs.renameSync(berkas + '.tmp', berkas);
        return kirim(res, 200, { ok: true, diubah: simpan.diubah });
      }
    }
    kirim(res, 404, { galat: 'Tidak ditemukan' });
  } catch (e) { kirim(res, 500, { galat: e.message }); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Audit Management Checker: http://127.0.0.1:${PORT}${UJI ? ' (uji)' : ''}`);
  if (otomatis) otomatis.mulai();
});
