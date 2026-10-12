// Pemeriksaan otomatis yang dipakai web (tombol cek) dan pemantau (otomatis.mjs).
// Tiap hasil: { status: Memenuhi|Sebagian|Belum, bukti }

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { semuaButir } from './butir.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PENJAGA = path.join(DIR, '..', 'penjaga.json');
export const VAULT = 'C:\\Users\\suluh\\Vault-SPI';

const cekPort = (port) => new Promise((ok) => {
  const s = net.connect({ host: '127.0.0.1', port });
  const selesai = (hidup) => { s.destroy(); ok(hidup); };
  s.setTimeout(1500, () => selesai(false));
  s.once('connect', () => selesai(true));
  s.once('error', () => selesai(false));
});
const umurJam = (t) => (Date.now() - new Date(t).getTime()) / 36e5;

// Rujukan "wiki/....md" di butir audit harus menunjuk halaman yang masih ada.
export function cekRujukan() {
  const rujukan = [...new Set(semuaButir().flatMap((b) => b.rujukan.match(/wiki\/[\w\-/.]+\.md/g) || []))];
  const hilang = rujukan.filter((r) => !fs.existsSync(path.join(VAULT, ...r.split('/'))));
  return {
    status: hilang.length === 0 ? 'Memenuhi' : hilang.length < rujukan.length ? 'Sebagian' : 'Belum',
    bukti: hilang.length ? `${hilang.length} dari ${rujukan.length} rujukan wiki tidak ditemukan:\n${hilang.join('\n')}` : `Semua ${rujukan.length} rujukan wiki ditemukan.`,
    hilang,
  };
}

export async function cekSistem() {
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

  try { const { hilang, ...r } = cekRujukan(); hasil.rujukan = r; }
  catch (e) { hasil.rujukan = { status: 'Belum', bukti: `Rujukan tidak bisa dicek: ${e.message}` }; }
  return { waktu: new Date().toISOString(), hasil };
}
