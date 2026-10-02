// Migrasi SEKALI: salin semua laporan + foto dari Supabase "Pelaporan Guru YSPI"
// ke gudang Drive. Hanya GET ke Supabase; Supabase tidak diubah dan tidak dihapus.
// Aman diulang: laporan/foto yang sudah ada di gudang dilewati.
//
//   node migrasi-supabase.mjs            -> ke vault DRAFT\Laporan Guru
//   LAPORAN_GURU_TUJUAN=<folder> node migrasi-supabase.mjs   -> uji ke folder lain

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bukaGudang } from './gudang.mjs';

const PENGHUBUNG_LAMA = 'C:\\Users\\suluh\\Documents\\Codex\\2026-09-14\\co\\outputs\\yspi-supabase';
const PROYEK = 'xpvaayxfsfvwyizkyrzw', CLOUD = `https://${PROYEK}.supabase.co`;
const TUJUAN = process.env.LAPORAN_GURU_TUJUAN || 'C:\\Users\\suluh\\Vault-SPI\\DRAFT\\Laporan Guru';

const { unprotectSecret } = await import(pathToFileURL(path.join(PENGHUBUNG_LAMA, 'secure-config.mjs')).href);
const cfg = JSON.parse(fs.readFileSync(path.join(PENGHUBUNG_LAMA, 'state', 'connection.json'), 'utf8'));
if (cfg.project !== PROYEK) throw new Error('Konfigurasi penghubung bukan proyek Pelaporan Guru YSPI.');
const kunci = unprotectSecret(cfg.protectedKey);

async function ambil(rute, biner = false) {
  const r = await fetch(CLOUD + rute, { method: 'GET', headers: { apikey: kunci }, signal: AbortSignal.timeout(60_000), redirect: 'error' });
  if (!r.ok) throw new Error('Supabase ' + r.status + ' pada ' + rute.split('?')[0]);
  return biner ? Buffer.from(await r.arrayBuffer()) : r.json();
}

const gudang = bukaGudang(TUJUAN);
const laporan = await ambil('/rest/v1/yspi_reports?select=*&order=created_at.asc&limit=10000');
const media = await ambil('/rest/v1/yspi_media?select=*&order=created_at.asc&limit=10000');
let nL = 0, nM = 0;
for (const r of laporan) {
  const { created_by, status, issue_status, ...isi } = r;
  if (gudang.tambahLaporan({ ...isi, catatan_lama: `Supabase: ${status}/${issue_status}` })) nL++;
}
for (const m of media) {
  if (gudang.adaMedia(m.id) || !gudang.laporan(m.report_id)) continue;
  const isi = await ambil('/storage/v1/object/authenticated/yspi-media/' + m.path.split('/').map(encodeURIComponent).join('/'), true);
  gudang.tambahMedia({ id: m.id, report_id: m.report_id, type: m.type, isi, created_at: m.created_at, name: m.name });
  nM++;
}
gudang.tulisRekap();
console.log(`Supabase: ${laporan.length} laporan, ${media.length} media. Baru dipindah ke gudang: ${nL} laporan, ${nM} media -> ${TUJUAN}`);
