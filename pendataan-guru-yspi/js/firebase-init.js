/* ============================================================
   Pemuat Firebase SDK.
   Modul dimuat dari CDN resmi Google (gstatic.com) hanya ketika
   benar-benar dibutuhkan, supaya halaman formulir tetap ringan.
   ============================================================ */
import { FIREBASE } from './firebase-config.js';

const VERSI = '12.4.0';
const CDN = `https://www.gstatic.com/firebasejs/${VERSI}/`;

/** Firebase belum dikonfigurasi bila masih ada nilai contoh "GANTI_". */
export function belumDikonfigurasi() {
  return Object.values(FIREBASE).some(v => String(v).includes('GANTI_'));
}

/** Halaman dibuka lewat klik dua kali pada berkas, bukan lewat http(s). */
export const DARI_BERKAS = location.protocol === 'file:';

function memo(pembuat) {
  let janji = null;
  return () => {
    if (!janji) {
      janji = pembuat();
      janji.catch(() => { janji = null; });   // biar bisa dicoba lagi
    }
    return janji;
  };
}

async function impor(nama) {
  try {
    return await import(CDN + nama + '.js');
  } catch {
    throw new Error('PUSTAKA_GAGAL');
  }
}

/** Aplikasi Firebase + modul Firestore. Selalu dibutuhkan kedua halaman. */
export const inti = memo(async () => {
  if (belumDikonfigurasi()) throw new Error('BELUM_DIKONFIGURASI');
  const [app, fs] = await Promise.all([impor('firebase-app'), impor('firebase-firestore')]);
  const aplikasi = app.initializeApp(FIREBASE);
  return { aplikasi, fs, db: fs.getFirestore(aplikasi) };
});

/** Modul Authentication. Hanya dipakai halaman admin. */
export const otentikasi = memo(async () => {
  const { aplikasi } = await inti();
  const mod = await impor('firebase-auth');
  return { mod, auth: mod.getAuth(aplikasi) };
});

/** Modul Storage. Hanya dimuat bila PENGATURAN.mode_foto === 'storage'. */
export const penyimpanan = memo(async () => {
  const { aplikasi } = await inti();
  const mod = await impor('firebase-storage');
  return { mod, st: mod.getStorage(aplikasi) };
});

/* ---------- penerjemah galat ---------- */

/** Firebase melempar galat dalam beberapa bentuk (FirebaseError, Error biasa,
 *  kadang teks polos). Jangan mengandalkan satu bidang saja. */
export function rincianGalat(err) {
  const bagian = [err?.name, err?.code, err?.message].filter(Boolean);
  return bagian.length ? bagian.join(' | ') : String(err);
}

/** Benarkah galat ini soal izin / aturan keamanan? */
export function galatIzin(err) {
  const teks = (String(err?.code || '') + ' ' + String(err?.message || '') + ' ' + String(err)).toLowerCase();
  return teks.includes('permission-denied')
      || teks.includes('permission_denied')
      || teks.includes('insufficient permissions')
      || teks.includes('missing or insufficient');
}

/** Mengubah kegagalan teknis menjadi sebab yang bisa ditindaklanjuti,
 *  supaya tidak semua masalah terlihat seperti "internet putus". */
export function jelaskanGalat(err) {
  const kode = String(err?.code || err?.message || err || '');

  if (kode.includes('BELUM_DIKONFIGURASI')) {
    return 'Website ini belum dihubungkan ke database. Pengurus perlu mengisi '
         + 'berkas js/firebase-config.js terlebih dahulu.';
  }
  if (kode.includes('PUSTAKA_GAGAL')) {
    return 'Komponen sistem gagal dimuat. Jaringan yang Anda pakai tampaknya memblokir '
         + 'alamat www.gstatic.com. Coba jaringan lain — misalnya beralih dari WiFi '
         + 'kantor ke data seluler — lalu muat ulang halaman ini.';
  }
  if (DARI_BERKAS) {
    return 'Halaman ini dibuka langsung dari berkas di komputer (file://), sehingga '
         + 'server menolak menerima data. Website harus diakses lewat alamat https://…';
  }
  if (/api-key-not-valid|invalid-api-key|auth\/invalid-api-key|project.*not.*exist/i.test(kode)) {
    return 'Pengaturan Firebase pada website ini belum benar. Mohon laporkan kepada '
         + 'pengurus: ' + kode;
  }
  if (/permission-denied|insufficient permissions|unauthorized/i.test(kode)) {
    return 'Server menolak permintaan karena aturan keamanan database. Mohon laporkan '
         + 'pesan ini kepada pengurus: ' + kode;
  }
  if (/unavailable|failed to fetch|networkerror|load failed|deadline-exceeded|network-request-failed/i.test(kode)) {
    return 'Browser tidak berhasil menghubungi server. Periksa koneksi internet Anda, '
         + 'lalu coba lagi. Bila jaringan yang dipakai membatasi akses situs luar, coba '
         + 'lewat data seluler.';
  }
  if (/invalid-argument|maximum.*size|too large|resource-exhausted/i.test(kode)) {
    return 'Data ditolak server karena terlalu besar. Coba gunakan foto lain yang lebih '
         + 'kecil, atau kurangi panjang isian teks.';
  }
  return 'Terjadi kesalahan. Silakan coba lagi. Bila masalah berlanjut, sampaikan '
       + 'keterangan berikut kepada pengurus: ' + (kode || 'kesalahan tidak diketahui');
}
