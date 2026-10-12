// Daftar pemeriksaan Audit Management Checker YSPI (fungsi & kesehatan teknis).
// Implementasi tiap pemeriksaan ada di cek.mjs dengan ID yang sama.
// Status: OK · Peringatan · Masalah.

export const STATUS = ['OK', 'Peringatan', 'Masalah'];

export const RANAH = [
  { kode: 'A', nama: 'Checker sendiri', cek: [
    ['A1', 'Uji kode checker terakhir lolos', 'Buka riwayat audit otomatis, perbaiki langkah yang gagal; pemantau menguji ulang sendiri setelah berkas disimpan.'],
    ['A2', 'Audit otomatis berjalan teratur', 'Bila lama tidak berjalan: pastikan layanan 3466 hidup di penjaga.json dan lihat penjaga.log.'],
    ['A3', 'Kode checker tersimpan di GitHub', 'Perubahan yang belum di-push akan diuji & di-push pemantau; bila tertahan, lihat alasan di riwayat.'],
    ['A4', 'Konfigurasi penjaga sah', 'Perbaiki penjaga.json: JSON sah, garis miring ganda, peluncur ada di dalam C:\\Users\\suluh, port tidak ganda.'],
  ]},
  { kode: 'B', nama: 'Wiki & vault', cek: [
    ['B1', 'Lint wiki masih baru (≤ 7 hari)', 'Jalankan lint wiki (workflow Lint di wiki/AGENTS.md).'],
    ['B2', 'Antrean ingest di _staging/inbox', 'Jalankan Ingest untuk berkas yang menunggu, atau pindahkan yang ditolak ke _staging/rejected oleh manusia.'],
    ['B3', 'Semua halaman wiki tercantum di index.md', 'Tambahkan halaman yang belum tercantum ke index.md lewat workflow Ingest/Lint.'],
    ['B4', 'Tautan antarhalaman wiki tidak rusak', 'Perbaiki tautan atau buat halaman yang dirujuk (lewat Ingest).'],
    ['B5', 'state.md mengikuti perubahan wiki', 'Perbarui state.md dan stempel updated: (kontrak embassy).'],
    ['B6', 'log.md mencatat perubahan wiki terakhir', 'Halaman yang berubah sesudah log.md: pastikan perubahannya lewat Ingest dan dicatat di log.md (append only).'],
    ['B7', 'Halaman wiki utuh (tidak kosong, frontmatter tertutup, teks terbaca)', 'Pulihkan halaman dari riwayat versi Google Drive.'],
    ['B8', 'Tidak ada berkas konflik/duplikat Drive', 'Bandingkan isinya dengan berkas asli; manusia memilih yang benar dan menghapus salinannya.'],
  ]},
  { kode: 'C', nama: 'Web & layanan', cek: [
    ['C1', 'Layanan lokal (penjaga) menjawab', 'Lihat penjaga.log; jalankan peluncur layanan yang mati secara manual untuk melihat galatnya.'],
    ['C2', 'Layanan stabil (24 jam terakhir)', 'Layanan yang sering dinyalakan ulang kemungkinan mogok berulang; periksa log aplikasinya.'],
    ['C3', 'Penjaga sendiri berjalan', 'Jalankan ulang penjaga DSH (dsh-penjaga.ps1) atau mulai ulang PC.'],
    ['C4', 'WhatsApp konsol tersambung', 'Buka Konsol WhatsApp (port 3458) dan sambungkan ulang (QR/kode pairing).'],
    ['C5', 'Sinkron laporan guru sehat', 'Lihat laporan-guru\\data\\sinkron.log dan http://127.0.0.1:3463/status.'],
    ['C6', 'Situs publik (Vercel) bisa dibuka', 'Buka dasbor Vercel proyek terkait; lihat deployment terakhir.'],
  ]},
  { kode: 'D', nama: 'Data: hilang, rusak, risiko', cek: [
    ['D1', 'Berkas data utuh & terbaca (JSON, SQLite, XLSX)', 'Berkas rusak: pulihkan dari riwayat versi Drive atau cadangan; jangan biarkan aplikasi menulis di atasnya.'],
    ['D2', 'Tidak ada data hilang atau menyusut mendadak', 'Cek apakah penghapusan disengaja (mis. data uji); bila tidak, pulihkan dari riwayat versi Drive.'],
    ['D3', 'Laporan guru konsisten (salinan, rekap, foto)', 'Tunggu satu putaran sinkron (15 menit); bila tetap selisih, lihat sinkron.log.'],
    ['D4', 'Tidak ada sisa tulis terputus (.tmp)', 'Berkas .tmp lama menandakan penulisan gagal di tengah jalan; cek berkas aslinya utuh.'],
    ['D5', 'Data penting punya cadangan', 'Buat cadangan berkala untuk data yang tidak berada di Google Drive.'],
    ['D6', 'Kode aplikasi sudah di-commit & di-push', 'Commit dan push perubahan aplikasi agar kode tidak hilang bila PC rusak.'],
    ['D7', 'Ruang disk C: cukup', 'Kosongkan ruang disk; disk penuh membuat penulisan data gagal atau terpotong.'],
  ]},
];

export function semuaButir() {
  return RANAH.flatMap((r) => r.cek.map(([id, judul, saran]) => ({ id, ranah: r.nama, judul, saran })));
}
