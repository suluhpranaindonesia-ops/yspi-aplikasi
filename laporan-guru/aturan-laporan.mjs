// Kolom wajib laporan guru, dipakai rekap Excel untuk kolom "Kelengkapan".
//
// Daftar yang sama ada di penghubung #laporan (yspi-supabase/aturan.mjs, fungsi
// kekurangan) dan di website (yspi-pelaporan/lib/report-rules.ts). Ubah ketiganya
// bersamaan. Disalin ke sini supaya repo ini bisa jalan tanpa folder penghubung.

export const WAJIB = [['name', 'nama guru'], ['school', 'sekolah'], ['region', 'wilayah'], ['date', 'tanggal'], ['sessions', 'jumlah sesi'], ['students', 'jumlah siswa'], ['activity', 'kegiatan mengajar']];

const kosong = (v) => v === null || v === undefined || String(v).trim() === '';
// Foto kegiatan tidak wajib.
// Jejak belajar (#jejak, jenis='jejak'): cukup nama guru, dan yang diminta di pertemuan terakhir ATAU foto.
export const WAJIB_JEJAK = [['name', 'nama guru']];
export function kekurangan(report, adaFoto = false) {
  if (report.jenis !== 'jejak') return WAJIB.filter(([k]) => kosong(report[k])).map(([, label]) => label);
  const kurang = WAJIB_JEJAK.filter(([k]) => kosong(report[k])).map(([, label]) => label);
  if (kosong(report.activity) && !adaFoto) kurang.push('yang diminta di pertemuan terakhir, atau fotonya');
  return kurang;
}
