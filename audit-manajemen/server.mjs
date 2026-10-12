// Audit Management Checker YSPI — web lokal (hanya 127.0.0.1).
// Jalankan: node server.mjs  → http://127.0.0.1:3466
// Hasil audit disimpan di data\audit-<id>.json (tidak ada yang dihapus).

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RANAH, SKALA, semuaButir } from './butir.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3466;
const DATA = path.join(DIR, 'data');
const PENJAGA = path.join(DIR, '..', 'penjaga.json');
const VAULT = 'C:\\Users\\suluh\\Vault-SPI';
fs.mkdirSync(DATA, { recursive: true });

const cekPort = (port) => new Promise((ok) => {
  const s = net.connect({ host: '127.0.0.1', port });
  const selesai = (hidup) => { s.destroy(); ok(hidup); };
  s.setTimeout(1500, () => selesai(false));
  s.once('connect', () => selesai(true));
  s.once('error', () => selesai(false));
});
const umurJam = (t) => (Date.now() - new Date(t).getTime()) / 36e5;

// Cek otomatis; tiap hasil: { status: Memenuhi|Sebagian|Belum, bukti }
async function cekSistem() {
  const hasil = {};
  try {
    const { layanan } = JSON.parse(fs.readFileSync(PENJAGA, 'utf8'));
    const st = await Promise.all(layanan.map(async (l) => ({ ...l, hidup: await cekPort(l.port) })));
    const mati = st.filter((l) => !l.hidup);
    hasil.layanan = {
      status: mati.length === 0 ? 'Memenuhi' : mati.length < st.length ? 'Sebagian' : 'Belum',
      bukti: st.map((l) => `${l.hidup ? '✓' : '✗'} ${l.port} ${l.nama}`).join('\n'),
    };
  } catch (e) { hasil.layanan = { status: 'Belum', bukti: `Gagal membaca penjaga.json: ${e.message}` }; }

  try {
    const r = await fetch('http://127.0.0.1:3463/status', { signal: AbortSignal.timeout(3000) });
    const s = await r.json();
    const jam = s.berhasil ? umurJam(s.berhasil) : Infinity;
    hasil.sinkron = {
      status: !s.galat && jam <= 0.5 ? 'Memenuhi' : !s.galat && jam <= 24 ? 'Sebagian' : 'Belum',
      bukti: `Berhasil terakhir: ${s.berhasil || '-'} (${Number.isFinite(jam) ? Math.round(jam * 60) + ' menit lalu' : 'tidak ada'}); laporan ${s.laporan}; galat: ${s.galat || 'tidak ada'}`,
    };
  } catch (e) { hasil.sinkron = { status: 'Belum', bukti: `Port 3463 tidak menjawab: ${e.message}` }; }

  try {
    const lint = fs.readdirSync(path.join(VAULT, 'wiki', '_audit')).filter((f) => /^lint-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().pop();
    const hari = lint ? umurJam(lint.slice(5, 15)) / 24 : Infinity;
    hasil.lint = {
      status: hari <= 10 ? 'Sebagian' : 'Belum',
      bukti: `Lint terakhir: ${lint || 'tidak ada'} (${Math.floor(hari)} hari lalu). Tindak lanjut temuannya tetap perlu dinilai manual — karena itu maksimal "Sebagian" otomatis.`,
    };
  } catch (e) { hasil.lint = { status: 'Belum', bukti: `wiki/_audit tidak terbaca: ${e.message}` }; }

  try {
    const isi = fs.readFileSync(path.join(VAULT, 'state.md'), 'utf8');
    const m = isi.match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m);
    const hari = m ? umurJam(m[1]) / 24 : Infinity;
    hasil.state = {
      status: hari <= 7 ? 'Memenuhi' : hari <= 30 ? 'Sebagian' : 'Belum',
      bukti: `state.md updated: ${m ? m[1] : 'tidak ditemukan'} (${Math.floor(hari)} hari lalu)`,
    };
  } catch (e) { hasil.state = { status: 'Belum', bukti: `state.md tidak terbaca: ${e.message}` }; }
  return { waktu: new Date().toISOString(), hasil };
}

const idSah = (id) => /^[0-9A-Za-z-]{1,60}$/.test(id);
const kirim = (res, kode, isi, tipe = 'application/json; charset=utf-8') => {
  res.writeHead(kode, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof isi === 'string' || Buffer.isBuffer(isi) ? isi : JSON.stringify(isi));
};

const server = http.createServer(async (req, res) => {
  // Tolak permintaan dari situs lain (DNS rebinding / CSRF)
  if (!/^(127\.0\.0\.1|localhost):3466$/.test(req.headers.host || '')) return kirim(res, 403, { galat: 'Host ditolak' });
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') return kirim(res, 200, fs.readFileSync(path.join(DIR, 'index.html')), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/butir') return kirim(res, 200, { skala: SKALA, ranah: RANAH.map((r) => ({ kode: r.kode, nama: r.nama })), butir: semuaButir() });
    if (req.method === 'GET' && url.pathname === '/api/cek') return kirim(res, 200, await cekSistem());
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
        if (!(req.headers['content-type'] || '').startsWith('application/json')) return kirim(res, 415, { galat: 'Harus JSON' });
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

server.listen(PORT, '127.0.0.1', () => console.log(`Audit Management Checker: http://127.0.0.1:${PORT}`));
