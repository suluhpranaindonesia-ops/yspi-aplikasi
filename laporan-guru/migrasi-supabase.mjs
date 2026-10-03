// Migrasi SEKALI: salin semua laporan + foto dari Supabase "Pelaporan Guru YSPI"
// ke gudang Drive. Hanya GET ke Supabase; Supabase tidak diubah dan tidak dihapus.
// Aman diulang: laporan/foto yang sudah ada di gudang dilewati.
//
//   node migrasi-supabase.mjs            -> ke vault DRAFT\Laporan Guru
//   LAPORAN_GURU_TUJUAN=<folder> node migrasi-supabase.mjs   -> uji ke folder lain

import { bukaGudang } from './gudang.mjs';
import { ambilSemua, ambilBerkas } from './supabase-baca.mjs';

const TUJUAN = process.env.LAPORAN_GURU_TUJUAN || 'C:\\Users\\suluh\\Vault-SPI\\DRAFT\\Laporan Guru';

const gudang = bukaGudang(TUJUAN);
// Per halaman 1.000 sampai habis; berhenti dengan galat kalau jumlahnya tidak sama dengan total Supabase.
const laporan = await ambilSemua('yspi_reports');
const media = await ambilSemua('yspi_media');
let nL = 0, nM = 0;
for (const r of laporan) {
  const { created_by, status, issue_status, ...isi } = r;
  if (gudang.tambahLaporan({ ...isi, catatan_lama: `Supabase: ${status}/${issue_status}` })) nL++;
}
for (const m of media) {
  if (gudang.adaMedia(m.id) || !gudang.laporan(m.report_id)) continue;
  const isi = await ambilBerkas('/storage/v1/object/authenticated/yspi-media/' + m.path.split('/').map(encodeURIComponent).join('/'));
  gudang.tambahMedia({ id: m.id, report_id: m.report_id, type: m.type, isi, created_at: m.created_at, name: m.name });
  nM++;
}
gudang.tulisRekap();
console.log(`Supabase: ${laporan.length} laporan, ${media.length} media. Baru dipindah ke gudang: ${nL} laporan, ${nM} media -> ${TUJUAN}`);
