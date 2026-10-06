// Pembaca Supabase "Pelaporan Guru YSPI" bersama untuk sinkron.mjs dan migrasi-supabase.mjs.
// HANYA GET. Tidak ada method lain di berkas ini.
//
// Kunci tidak pernah disimpan di repo. Kunci dibuka dari konfigurasi penghubung #laporan
// (yspi-supabase) yang terenkripsi DPAPI di PC ini. Lokasinya bisa diatur lewat
// LAPORAN_GURU_PENGHUBUNG; tanpa itu dipakai lokasi bawaan di PC kantor.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Proyeknya mengikuti konfigurasi penghubung (state/connection.json), jadi setelah penghubung
// pindah proyek Supabase, sinkron ikut pindah tanpa kode diubah.
let cloud = '';
export const PENGHUBUNG = process.env.LAPORAN_GURU_PENGHUBUNG
  || 'C:\\Users\\suluh\\Documents\\Codex\\2026-09-14\\co\\outputs\\yspi-supabase';
// Supabase membatasi satu respons ke 1.000 baris (bawaan max-rows), jadi halaman tidak boleh lebih besar.
export const UKURAN_HALAMAN = 1000;

let kunci = '';
export async function bukaKunci() {
  if (kunci) return kunci;
  const modul = path.join(PENGHUBUNG, 'secure-config.mjs');
  const fileCfg = path.join(PENGHUBUNG, 'state', 'connection.json');
  if (!fs.existsSync(modul) || !fs.existsSync(fileCfg))
    throw new Error(`Konfigurasi penghubung tidak ditemukan di ${PENGHUBUNG}. Atur LAPORAN_GURU_PENGHUBUNG.`);
  const { unprotectSecret } = await import(pathToFileURL(modul).href);
  const cfg = JSON.parse(fs.readFileSync(fileCfg, 'utf8'));
  if (!/^[a-z0-9]{20}$/.test(cfg.project || '')) throw new Error('Konfigurasi penghubung tidak memuat ref proyek Supabase yang sah.');
  cloud = `https://${cfg.project}.supabase.co`;
  kunci = unprotectSecret(cfg.protectedKey);
  return kunci;
}
export const sensor = (teks) => (kunci ? String(teks).replaceAll(kunci, '[disensor]') : String(teks));

async function get(rute, header = {}) {
  const apikey = await bukaKunci();
  const r = await fetch(cloud + rute, { method: 'GET', headers: { apikey, ...header }, signal: AbortSignal.timeout(60_000), redirect: 'error' });
  if (!r.ok) throw new Error('Supabase ' + r.status + ' pada ' + rute.split('?')[0]);
  return r;
}

export async function ambilBerkas(rute) {
  return Buffer.from(await (await get(rute)).arrayBuffer());
}

// Ambil SEMUA baris sebuah tabel, per halaman 1.000, dengan urutan tetap (created_at, id)
// supaya baris tidak terlewat/terulang antarhalaman. Jumlah total dari Supabase
// (Prefer: count=exact) dicocokkan di akhir; kalau tidak sama, sinkron dinyatakan GAGAL,
// bukan "berhasil" dengan data separuh.
export async function ambilSemua(tabel, kolom = '*', fetchHalaman = get) {
  const semua = [];
  let total = null;
  for (let mulai = 0; ; mulai += UKURAN_HALAMAN) {
    const r = await fetchHalaman(`/rest/v1/${tabel}?select=${kolom}&order=created_at.asc,id.asc&limit=${UKURAN_HALAMAN}&offset=${mulai}`, { Prefer: 'count=exact' });
    const halaman = await r.json();
    const t = Number(String(r.headers.get('content-range') || '').split('/')[1]);
    if (Number.isFinite(t)) total = t;
    semua.push(...halaman);
    if (halaman.length === 0 || (total != null ? semua.length >= total : halaman.length < UKURAN_HALAMAN)) break;
  }
  if (total != null && semua.length !== total)
    throw new Error(`${tabel}: terambil ${semua.length} dari ${total} baris — sinkron tidak lengkap.`);
  if (new Set(semua.map((x) => x.id)).size !== semua.length)
    throw new Error(`${tabel}: ada baris ganda antarhalaman (data berubah saat dibaca) — dicoba lagi putaran berikut.`);
  return semua;
}
