// Pintu laporan guru - HTTP lokal (port 3468). Hanya dari PC ini.
//
//   GET   /status                  keadaan pintu
//   GET   /laporan?jenis=&sekolah=&guru=&wilayah=&status=&sejak=&sampai=&cari=&batas=&mentah=1
//   GET   /laporan/<id>[?mentah=1]
//   GET   /ringkasan
//   PATCH /laporan/<id>            {"perubahan":{...},"oleh":"...","alasan":"..."}
//   GET   /alat                    definisi alat (format tools Ollama/OpenAI) untuk model lokal
//   POST  /alat/<nama>             jalankan alat dengan argumen JSON (jalur yang sama dengan MCP)
//
// Logika ada di inti.mjs, dipakai bersama dengan server MCP (mcp.mjs).
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { daftar, satu, ringkasan, ubah, ALAT, jalankanAlat, semua } from './inti.mjs';
import { sensor } from '../supabase-baca.mjs';

const PORT = Number(process.env.PINTU_LAPORAN_PORT || 3468);
const mulai = new Date().toISOString();
let terakhirGalat = null, panggilan = 0, ubahan = 0;

function kirim(res, kode, data) {
  res.writeHead(kode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}
const bacaJson = (req) => new Promise((ok, gagal) => {
  let b = '';
  req.on('data', (x) => { b += x; if (b.length > 1e6) { gagal(Error('body terlalu besar')); req.destroy(); } });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { gagal(Error('body bukan JSON')); } });
});

export const server = http.createServer(async (req, res) => {
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost'].includes(host)) return kirim(res, 403, { error: 'Host tidak diizinkan' });
  const u = new URL(req.url, 'http://127.0.0.1');
  const bagian = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    panggilan++;
    if (req.method !== 'GET' && !/application\/json/.test(req.headers['content-type'] || '')) return kirim(res, 415, { error: 'Pakai Content-Type: application/json' });
    if (req.method === 'GET' && u.pathname === '/status') {
      let supabase = 'ok';
      try { await semua(); } catch (e) { supabase = sensor(e.message); }
      return kirim(res, 200, { ok: supabase === 'ok', supabase, mulai, port: PORT, panggilan, ubahan, terakhirGalat });
    }
    if (req.method === 'GET' && bagian[0] === 'laporan' && bagian.length === 1) return kirim(res, 200, await daftar(Object.fromEntries(u.searchParams)));
    if (req.method === 'GET' && bagian[0] === 'laporan' && bagian.length === 2) {
      const x = await satu(bagian[1], { mentah: u.searchParams.get('mentah') === '1' });
      return x ? kirim(res, 200, x) : kirim(res, 404, { error: 'Laporan tidak ditemukan' });
    }
    if (req.method === 'GET' && u.pathname === '/ringkasan') return kirim(res, 200, await ringkasan());
    if (req.method === 'PATCH' && bagian[0] === 'laporan' && bagian.length === 2) {
      const b = await bacaJson(req);
      const h = await ubah(bagian[1], b.perubahan, { oleh: b.oleh, alasan: b.alasan });
      ubahan++;
      return kirim(res, 200, h);
    }
    if (req.method === 'GET' && u.pathname === '/alat')
      return kirim(res, 200, ALAT.map((a) => ({ type: 'function', function: { name: a.name, description: a.description, parameters: a.inputSchema } })));
    if (req.method === 'POST' && bagian[0] === 'alat' && bagian.length === 2) {
      const h = await jalankanAlat(bagian[1], await bacaJson(req));
      if (bagian[1] === 'ubah_laporan') ubahan++;
      return kirim(res, 200, h);
    }
    kirim(res, 404, { error: 'Jalur tidak dikenal' });
  } catch (e) {
    terakhirGalat = { waktu: new Date().toISOString(), pesan: sensor(e.message) };
    kirim(res, 400, { error: sensor(e.message) });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  server.listen(PORT, '127.0.0.1', () => console.log(`Pintu laporan guru di http://127.0.0.1:${PORT}`));
