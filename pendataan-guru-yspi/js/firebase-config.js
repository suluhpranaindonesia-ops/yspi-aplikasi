/* ============================================================
   SATU-SATUNYA BERKAS YANG PERLU ANDA UBAH.

   Salin nilai di bawah dari Firebase Console:
   Project settings (ikon gerigi) → General → Your apps → Web app
   → "SDK setup and configuration" → pilih "Config".

   Nilai-nilai ini MEMANG BOLEH DILIHAT PUBLIK. apiKey Firebase
   bukan kata sandi — ia hanya penunjuk alamat project. Yang menjaga
   data Anda adalah berkas firestore.rules dan storage.rules.

   JANGAN PERNAH menaruh "service account key" / kunci admin di sini.
   ============================================================ */
export const FIREBASE = {
  apiKey:            "AIzaSyC2_I0CszsH2MJaHuQaMr7MGaCZHu5ftD4",
  authDomain:        "pendataan-guru-yspi.firebaseapp.com",
  projectId:         "pendataan-guru-yspi",
  storageBucket:     "pendataan-guru-yspi.firebasestorage.app",
  messagingSenderId: "446266382152",
  appId:             "1:446266382152:web:2f3290d1a4029ba887457d"
};

export const PENGATURAN = {
  /* Cara menyimpan foto guru:
     'firestore' — foto disimpan di dalam database. BISA DIPAKAI DI PAKET
                   GRATIS (Spark). Foto otomatis diperkecil di bawah 600 KB.
                   Pilihan ini yang aktif secara bawaan.
     'storage'   — foto disimpan di Firebase Storage. Kualitas foto lebih
                   besar, tetapi Firebase mewajibkan paket Blaze
                   (pay-as-you-go, tetap ada kuota gratis) untuk mengaktifkan
                   Storage pada project baru.
     Boleh diganti kapan saja; data lama tetap terbaca karena setiap guru
     menyimpan catatan modenya sendiri. */
  mode_foto: 'firestore',

  /* Batas jumlah blok sekolah/kelas per guru. Harus sama dengan angka
     pada firestore.rules. */
  maks_sekolah: 40
};
