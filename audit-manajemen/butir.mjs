// Satu sumber butir audit manajemen YSPI. md, xlsx, dan web dibangun dari sini.
// dasar: 'vault' = butir diturunkan dari catatan di vault/memori kerja (rujukan disebut);
//        'umum'  = praktik umum tata kelola yayasan, BUKAN dari sumber YSPI — sesuaikan.
// cek: kunci pemeriksaan otomatis yang dijalankan web lokal (opsional).

export const SKALA = [
  { kode: 'Memenuhi', nilai: 2 },
  { kode: 'Sebagian', nilai: 1 },
  { kode: 'Belum', nilai: 0 },
  { kode: 'N/A', nilai: null },
];

export const RANAH = [
  {
    kode: 'A', nama: 'Tata Kelola',
    bagian: [
      { kode: 'A1', nama: 'Legalitas & dasar hukum', butir: [
        ['Akta Pendirian No. 03/2024 tersimpan (asli + salinan digital) dan mudah ditemukan', 'Lokasi berkas asli; salinan di Operation/01 AD:ART', 'vault', 'wiki/operasional/pendirian-ad-art-spi.md'],
        ['SK pengesahan badan hukum yayasan (Kemenkumham) tersedia', 'Nomor & tanggal SK, salinan berkas', 'umum', ''],
        ['Kontradiksi domisili "Blok II vs XII" sudah dipastikan dengan notaris', 'Keterangan notaris / akta perubahan', 'vault', 'wiki/operasional/pendirian-ad-art-spi.md (flag)'],
        ['Alamat yayasan seragam di akta, kop surat, website, dan rekening', 'Bandingkan keempat dokumen', 'vault', 'wiki/operasional/renovasi-penyiapan-kantor-2026.md'],
        ['NPWP yayasan aktif dan kegiatan sesuai KBLI di akta (85500, 88992, 94990)', 'Kartu/SKT NPWP; daftar kegiatan', 'vault', 'wiki/operasional/pendirian-ad-art-spi.md'],
      ]},
      { kode: 'A2', nama: 'Organ yayasan (Pembina, Pengurus, Pengawas)', butir: [
        ['Susunan organ 2026 tertulis dan sesuai akta (atau ada akta perubahan)', 'Daftar organ + dasar aktanya', 'vault', 'index wiki: "komposisi pengurus 2026 belum bersumber akta"'],
        ['Nama Pembina konsisten antar dokumen ("Lanny Mariani Hanani" vs "Lanny Pakan")', 'Akta vs daftar pengurus', 'vault', 'wiki/operasional/pendirian-ad-art-spi.md (flag)'],
        ['Jabatan & tanggung jawab tiap pengurus tertulis', 'SK / daftar jabatan', 'vault', 'wiki/entitas/* ("jabatan belum ada sumber")'],
        ['Pengawas menerima laporan dan memberi tanggapan secara berkala', 'Notulen/rangkuman grup Pengawas', 'vault', 'grup WA Pengawas YSPI'],
        ['Rapat Pembina tahunan mengesahkan laporan tahunan', 'Notulen rapat Pembina', 'umum', ''],
      ]},
      { kode: 'A3', nama: 'Rapat & tindak lanjut keputusan', butir: [
        ['Rapat pengurus berjalan berkala dan terjadwal', 'Jadwal + daftar rapat 3 bulan terakhir', 'vault', 'Operation/Meeting Notes/'],
        ['Notulen disahkan dan disimpan di Operation/Meeting Notes', 'Notulen bertanda pengesahan', 'vault', 'Operation/Meeting Notes/'],
        ['Setiap keputusan rapat masuk Follow Up Log dengan PIC dan tenggat', 'Cocokkan notulen terakhir dengan tracker', 'vault', 'Follow Up Log'],
        ['Item tracker tanpa langkah berikutnya > 30 hari ditinjau (tunda/tutup/eskalasi)', 'Daftar item stale + keputusan', 'vault', 'DRAFT/ops/Audit-YSPI-2026-09-07 (F67/F83/F84)'],
        ['Penutupan item tracker berdasarkan bukti atau keputusan manusia', 'Contoh 5 item Closed + buktinya', 'vault', 'Review-Tracker-102-Item.md'],
      ]},
      { kode: 'A4', nama: 'Kebijakan & SOP', butir: [
        ['Kebijakan Keuangan & Stewardship tertulis dan dikenal pelaksana', 'Dokumen kebijakan', 'vault', 'wiki/operasional/kebijakan-keuangan-stewardship.md'],
        ['SK Kebijakan PK (Persembahan Kasih) sudah difinalkan (F13)', 'SK bertanda tangan', 'vault', 'wiki/operasional/kebijakan-pk-persembahan-kasih.md'],
        ['SOP voucher berlaku dan diikuti', 'SOP + contoh voucher', 'vault', 'DRAFT/ops/SOP-Agent-Voucher-YSPI.md'],
        ['Surat keluar bernomor dan tercatat di register surat', 'Register surat (mis. 003/SP/K/VII/2026)', 'vault', 'wiki/entitas/yayasan-trampil-indonesia.md'],
        ['Kebijakan perlindungan anak/peserta (safeguarding) tertulis', 'Dokumen kebijakan + pihak yang bertanggung jawab', 'umum', ''],
        ['Kebijakan perlindungan data pribadi (guru, HT, penerima manfaat)', 'Aturan akses + persetujuan pemilik data', 'umum', ''],
      ]},
      { kode: 'A5', nama: 'SDM & penugasan', butir: [
        ['Uraian tugas staf admin tertulis; jalur lapor ke Andrian dipatuhi', 'Job desc + contoh laporan', 'vault', 'Persiapan-Rapat-YSPI-2026-09-09.md (keputusan 19 Jun)'],
        ['Narasumber/utusan memakai surat tugas resmi', 'Surat tugas per kegiatan', 'vault', 'wiki/program/semiloka-pendidikan-kristen-surabaya-2026.md'],
        ['Beban kerja dan prioritas pelaksana disepakati (kapasitas)', 'Daftar prioritas bulan berjalan', 'vault', 'Persiapan-Rapat-YSPI-2026-09-09.md'],
      ]},
      { kode: 'A6', nama: 'Program & pertanggungjawaban', butir: [
        ['Setiap kegiatan terlaksana punya laporan kegiatan', 'Daftar kegiatan vs laporan', 'vault', 'wiki/program/laporan-kegiatan-yspi-2026.md'],
        ['Setiap kegiatan tercatat di aplikasi aktivitas', 'Hitung kegiatan di aplikasi vs laporan', 'vault', 'suluhpranaindonesia.vercel.app/aktivitas'],
        ['Angka peserta konsisten antar sumber (contoh: Youth Camp 121 vs 103)', 'Daftar selisih + keputusan angka resmi', 'vault', 'wiki/program/youth-camp-pouk-sambu-2026.md'],
        ['KPI program dipantau terhadap target katalog', 'Rekap capaian KPI', 'vault', 'wiki/program/katalog-program-2026-2027.md'],
        ['Laporan guru (#laporan/#jejak) ditinjau pengurus secara berkala', 'Catatan tinjauan di website Pelaporan Guru', 'vault', 'DRAFT/Laporan Guru/'],
      ]},
    ],
  },
  {
    kode: 'B', nama: 'Keuangan',
    bagian: [
      { kode: 'B1', nama: 'Kas & bank', butir: [
        ['Saldo Giro BCA direkonsiliasi dengan mutasi bank setiap bulan', 'Lembar rekonsiliasi bulan terakhir', 'vault', 'wiki/operasional/laporan-keuangan-giro-bca-2025-2026.md'],
        ['Rekening penampung donasi dan rekening operasional dibedakan pencatatannya', 'Daftar rekening + fungsinya', 'vault', 'wiki/operasional/laporan-keuangan-giro-bca-2025-2026.md'],
        ['Kas kecil punya batas saldo dan dihitung fisik (opname) berkala', 'Berita acara opname', 'vault', 'wiki/operasional/kebijakan-keuangan-stewardship.md (petty cash)'],
        ['Transaksi bank memerlukan otorisasi lebih dari satu orang', 'Pengaturan otorisasi bank', 'umum', ''],
      ]},
      { kode: 'B2', nama: 'Voucher & pengeluaran', butir: [
        ['Setiap pengeluaran memakai voucher (VCH) yang disetujui sebelum transfer', 'Sampel 5 transfer + vouchernya', 'vault', 'Operation/ops/keuangan/voucher/'],
        ['Pengaju, penyetuju, dan pembayar adalah orang yang berbeda', 'Sampel voucher', 'umum', ''],
        ['Voucher PENDING pertanggungjawaban > 30 hari dieskalasi', 'Daftar voucher pending + umurnya', 'vault', 'Persiapan-Rapat-YSPI-2026-09-09.md (5 voucher pending)'],
        ['LPJ + bon + bukti transfer lengkap sebelum voucher SELESAI', 'Sampel voucher SELESAI', 'vault', 'SOP-Agent-Voucher-YSPI.md'],
        ['Sisa dana dikembalikan dan dicatat', 'Bukti pengembalian (mis. sisa dana Lampung)', 'vault', 'Persiapan-Rapat-YSPI-2026-09-09.md'],
        ['Bon kas kecil dari #bon tercatat di dasbor keuangan', 'Cocokkan bon WA vs dasbor', 'vault', 'keuangan-web (pemantau #bon)'],
      ]},
      { kode: 'B3', nama: 'Pencatatan & pelaporan', butir: [
        ['Jurnal memakai bagan akun (COA) yang disepakati', 'COA + sampel jurnal', 'vault', 'wiki/operasional/kebijakan-keuangan-stewardship.md'],
        ['Biaya pribadi pengurus dicatat sebagai sumbangan sekaligus biaya (F83)', 'Daftar kontribusi in-kind', 'vault', 'wiki/operasional/kebijakan-keuangan-stewardship.md (5 Agu)'],
        ['Laporan keuangan periodik disampaikan ke pengurus dan pengawas', 'Laporan bulan terakhir + bukti kirim', 'vault', 'grup WA Financial / Pengawas'],
        ['Anggaran tahun berikutnya (2027) disusun dan disetujui', 'Draf/ketetapan anggaran', 'vault', 'Persiapan-Rapat-YSPI-2026-09-09.md (Penggalangan-Dana)'],
        ['Laporan keuangan tahunan disusun (dan diaudit bila wajib menurut UU Yayasan)', 'Laporan tahunan', 'umum', ''],
      ]},
      { kode: 'B4', nama: 'Honor, PK & pajak', butir: [
        ['Honor narasumber dipotong PPh 21 sesuai kesepakatan dan ada bukti potong', 'Sampel bukti potong', 'vault', 'wiki/operasional/kebijakan-pk-persembahan-kasih.md'],
        ['Honor guru PAK dibayar pada hari terakhir bulan', 'Tanggal transfer 3 bulan terakhir', 'vault', 'wiki/operasional/kebijakan-keuangan-stewardship.md'],
        ['Tarif PK yang ditagihkan sesuai tarif indikatif yang disepakati', 'Sampel tagihan PK', 'vault', 'wiki/operasional/kebijakan-pk-persembahan-kasih.md'],
      ]},
      { kode: 'B5', nama: 'Donasi & dana terikat', butir: [
        ['Donasi tercatat per donatur dan tanda terima diterbitkan', 'Daftar donatur + tanda terima', 'vault', 'wiki/operasional/laporan-keuangan-giro-bca-2025-2026.md'],
        ['Dana terikat (mis. LBC, BRI) dipisah pencatatannya dan dilaporkan ke pemberi', 'Kartu dana terikat + laporan ke pemberi', 'vault', 'wiki/program/kolaborasi-yayasan-bri-2026.md'],
        ['Talangan/eksposur dana (F98) dipantau sampai diganti', 'Saldo talangan + jadwal penggantian', 'vault', 'Persiapan-Rapat-YSPI-2026-09-09.md (LBC)'],
        ['SOP dana prasyarat sebelum penggalangan dana dipatuhi', 'SOP + contoh penerapan', 'vault', 'wiki/operasional/kebijakan-keuangan-stewardship.md'],
      ]},
    ],
  },
  {
    kode: 'C', nama: 'Sistem & Data',
    bagian: [
      { kode: 'C1', nama: 'Layanan berjalan', butir: [
        ['Semua layanan di penjaga.json menjawab di port-nya', 'Hasil cek otomatis', 'vault', 'SPI-Kerja/penjaga.json', 'layanan'],
        ['Sinkron laporan guru berhasil < 30 menit terakhir, tanpa galat', 'Hasil cek otomatis /status', 'vault', 'http://127.0.0.1:3463/status', 'sinkron'],
        ['Hanya SATU penghubung #laporan yang aktif (port 8773)', 'Tidak ada balasan ganda di grup', 'vault', 'AGENTS.md SPI-Kerja'],
        ['Dasbor keuangan hanya diakses lewat Tailscale (tidak terbuka ke internet)', 'Pengaturan jaringan', 'vault', 'memori: keuangan-web-yspi'],
      ]},
      { kode: 'C2', nama: 'Akses & keamanan', butir: [
        ['2FA aktif di GitHub (suluhpranaindonesia-ops)', 'Pengaturan keamanan akun', 'vault', 'memori: akun-2fa (9 Okt: belum)'],
        ['2FA aktif di Supabase', 'Pengaturan keamanan akun', 'vault', 'memori: akun-2fa (9 Okt: belum)'],
        ['2FA aktif di akun Google yayasan', 'Pengaturan keamanan akun', 'vault', 'memori: akun-2fa (belum dicek)'],
        ['Sandi bersama dasbor keuangan dimatikan setelah semua memakai akun pribadi', 'Halaman Akses dasbor', 'vault', 'memori: keuangan-web-yspi (sandi bersama masih aktif)'],
        ['Daftar akun admin (Supabase, Vercel, dasbor) ditinjau; akun tak terpakai dicabut', 'Daftar akun + tanggal tinjau', 'umum', ''],
        ['Repo GitHub private dan tidak memuat .env, sandi, atau data', 'Cek .gitignore + isi repo', 'vault', 'SPI-Kerja/.gitignore'],
        ['Aturan akses database ditinjau sebelum menambah kolom sensitif (mis. rekening)', 'Rules terakhir + tanggal ubah', 'vault', 'memori: pendataan-guru-yspi'],
      ]},
      { kode: 'C3', nama: 'Cadangan & pemulihan', butir: [
        ['Cadangan database Supabase dibuat berkala', 'Tanggal cadangan terakhir', 'umum', ''],
        ['Cadangan sesi bot WA tersimpan aman dan tidak disentuh', 'Folder Backup-WA-bot ada', 'vault', 'AGENTS.md SPI-Kerja'],
        ['Pemulihan dari cadangan pernah diuji', 'Catatan uji pulih', 'umum', ''],
      ]},
      { kode: 'C4', nama: 'Integritas data & vault', butir: [
        ['Lint wiki berkala; temuan kontradiksi ditindaklanjuti', 'Lint terakhir di wiki/_audit', 'vault', 'wiki/_audit/', 'lint'],
        ['Airlock dipatuhi: output AI hanya di DRAFT, wiki lewat Ingest', 'Sampel perubahan wiki vs log.md', 'vault', 'wiki/AGENTS.md'],
        ['state.md vault diperbarui setelah sesi yang mengubah keadaan', 'Tanggal updated: di state.md', 'vault', 'state.md', 'state'],
        ['Data uji ditandai jelas dan tidak terhitung dalam laporan', 'Daftar data uji (mis. 3 data #jejak)', 'vault', 'memori: jejak-belajar'],
        ['Berkas konflik/duplikat Drive dibersihkan', 'Pencarian berkas " 2." / .fuse_hidden', 'vault', 'wiki/_audit/lint-2026-07-20.md'],
        ['Rujukan wiki di butir audit ini masih menunjuk halaman yang ada', 'Hasil cek otomatis (dijalankan ulang tiap wiki berubah)', 'vault', 'audit-manajemen/butir.mjs', 'rujukan'],
      ]},
    ],
  },
];

// Daftar datar untuk md/xlsx/web.
export function semuaButir() {
  const hasil = [];
  for (const r of RANAH) for (const b of r.bagian) b.butir.forEach(([kriteria, bukti, dasar, rujukan, cek], i) => {
    hasil.push({ id: `${b.kode}.${i + 1}`, ranah: r.nama, bagian: `${b.kode} ${b.nama}`, kriteria, bukti, dasar, rujukan, cek: cek || '' });
  });
  return hasil;
}
