/* ============================================================
   Formulir publik pendataan guru.
   ============================================================ */
import { PENGATURAN } from './firebase-config.js';
import { inti, penyimpanan, jelaskanGalat, galatIzin, rincianGalat,
         belumDikonfigurasi, DARI_BERKAS } from './firebase-init.js';

const $ = s => document.querySelector(s);
const KUNCI_DRAF = 'yspi-pendataan-guru-draf-v1';

/* Batas ukuran foto. Mode 'firestore' menyimpan foto sebagai teks di dalam
   dokumen, dan satu dokumen Firestore maksimal 1 MB — karena itu targetnya
   jauh lebih kecil. */
const PROFIL_FOTO = PENGATURAN.mode_foto === 'storage'
  ? { maksSisi: 1400, mutu: 0.86, target: 1_200_000 }
  : { maksSisi: 1000, mutu: 0.82, target:   460_000 };

/* ---------- pesan status ---------- */
const elPesan = $('#pesan');
function pesan(teks, tipe = 'info') {
  elPesan.className = 'pesan ' + tipe;
  elPesan.textContent = teks;
  elPesan.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function bersihkanPesan() { elPesan.style.display = 'none'; }

/* ---------- peringatan dini ---------- */
if (DARI_BERKAS) {
  pesan('Halaman ini sedang dibuka langsung dari berkas komputer (file://). Formulir bisa diisi, '
      + 'tetapi pengiriman pasti gagal. Website harus dipublikasikan dulu lalu diakses lewat '
      + 'alamat https://…', 'galat');
} else if (belumDikonfigurasi()) {
  pesan('Website ini belum dihubungkan ke database Firebase. Pengurus perlu mengisi berkas '
      + 'js/firebase-config.js terlebih dahulu. Formulir belum dapat dikirim.', 'galat');
}

/* ============================================================
   Blok sekolah
   ============================================================ */
const daftar = $('#daftarSekolah');
const KOLOM_SEKOLAH = [
  ['nama_sekolah',   'Nama Sekolah',            true,  true ],
  ['alamat_sekolah', 'Alamat Sekolah',          false, true ],
  ['kelas',          'Kelas',                   true,  false],
  ['jumlah_siswa',   'Jumlah Siswa',            false, false],
  ['ruangan',        'Ruang / Tempat Mengajar', false, false],
  ['hari_mengajar',  'Hari Mengajar',           false, false],
  ['jam_mengajar',   'Jam Mengajar',            false, false]
];
const PLACEHOLDER = {
  kelas:          'Contoh: 1, atau 4 dan 5',
  ruangan:        'Contoh: Ruang kelas 1A, Perpustakaan',
  hari_mengajar:  'Contoh: Senin, Rabu',
  jam_mengajar:   'Contoh: 4 jpl'
};

function tambahSekolah(isi = null) {
  if (daftar.children.length >= PENGATURAN.maks_sekolah) {
    pesan(`Maksimal ${PENGATURAN.maks_sekolah} blok sekolah/kelas.`, 'galat');
    return null;
  }
  const blok = document.createElement('div');
  blok.className = 'sekolah';
  blok.innerHTML = `
    <div class="kepala-blok">
      <span class="nomor"></span>
      <button type="button" class="bahaya kecil" data-hapus-blok>Hapus</button>
    </div>
    <div class="kisi-sekolah">
      ${KOLOM_SEKOLAH.map(([kolom, label, wajib, penuh]) => `
        <div${penuh ? ' style="grid-column:1/-1"' : ''}>
          <label>${label}${wajib ? ' <span class="wajib">*</span>' : ''}</label>
          <input data-kolom="${kolom}"${wajib ? ' data-wajib="1"' : ''} maxlength="200"${
            kolom === 'jumlah_siswa' ? ' type="number" min="0" max="9999" inputmode="numeric"' : ''}${
            PLACEHOLDER[kolom] ? ` placeholder="${PLACEHOLDER[kolom]}"` : ''}>
        </div>`).join('')}
    </div>`;

  blok.querySelector('[data-hapus-blok]').addEventListener('click', () => {
    if (daftar.children.length === 1) {
      pesan('Minimal satu blok sekolah/kelas harus diisi.', 'galat');
      return;
    }
    blok.remove();
    nomorUlang();
    simpanDraf();
  });

  daftar.appendChild(blok);
  if (isi) {
    blok.querySelectorAll('[data-kolom]').forEach(i => { i.value = isi[i.dataset.kolom] ?? ''; });
  }
  nomorUlang();
  return blok;
}

function nomorUlang() {
  [...daftar.children].forEach((el, i) => {
    el.querySelector('.nomor').textContent = `Sekolah / Kelas ke-${i + 1}`;
  });
}

function bacaSekolah() {
  return [...daftar.children].map(blok => {
    const baris = {};
    blok.querySelectorAll('[data-kolom]').forEach(i => {
      const v = i.value.trim();
      baris[i.dataset.kolom] = v === '' ? null : v;
    });
    baris.jumlah_siswa = baris.jumlah_siswa == null ? null : (Number(baris.jumlah_siswa) || 0);
    return baris;
  });
}

$('#tambahSekolah').addEventListener('click', () => {
  const baru = tambahSekolah();
  baru?.querySelector('input').focus();
});

/* ============================================================
   Simpan otomatis di perangkat (localStorage)
   ============================================================ */
const form = $('#formGuru');
let jedaSimpan;

function simpanDraf() {
  clearTimeout(jedaSimpan);
  jedaSimpan = setTimeout(() => {
    try {
      const isian = {};
      new FormData(form).forEach((v, k) => { if (k !== 'foto') isian[k] = v; });
      localStorage.setItem(KUNCI_DRAF, JSON.stringify({ isian, sekolah: bacaSekolah() }));
    } catch { /* penyimpanan penuh atau ditolak — abaikan saja */ }
  }, 400);
}

function pulihkanDraf() {
  let draf;
  try { draf = JSON.parse(localStorage.getItem(KUNCI_DRAF) || 'null'); } catch { return false; }
  if (!draf || !draf.isian) return false;

  let adaIsi = false;
  for (const [k, v] of Object.entries(draf.isian)) {
    const el = form.elements[k];
    if (el && typeof v === 'string' && v !== '') { el.value = v; adaIsi = true; }
  }
  (draf.sekolah || []).forEach(baris => {
    if (Object.values(baris).some(v => v !== null && v !== '')) { tambahSekolah(baris); adaIsi = true; }
  });
  return adaIsi;
}

function hapusDraf() {
  try { localStorage.removeItem(KUNCI_DRAF); } catch {}
}

/* ============================================================
   Foto: pratinjau + perkecil
   ============================================================ */
let fotoSiap = null;   // Blob yang sudah diperkecil

async function ambilBitmap(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  }
  return await new Promise((selesai, gagal) => {
    const img = new Image();
    img.onload  = () => selesai(img);
    img.onerror = () => gagal(new Error('Gambar tidak terbaca.'));
    img.src = URL.createObjectURL(file);
  });
}

function keBlob(sumber, sisiMaks, mutu) {
  const lebarAsli = sumber.width || sumber.naturalWidth;
  const tinggiAsli = sumber.height || sumber.naturalHeight;
  const skala = Math.min(1, sisiMaks / Math.max(lebarAsli, tinggiAsli));
  const kanvas = document.createElement('canvas');
  kanvas.width  = Math.max(1, Math.round(lebarAsli * skala));
  kanvas.height = Math.max(1, Math.round(tinggiAsli * skala));
  const ctx = kanvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, kanvas.width, kanvas.height);   // PNG transparan → putih
  ctx.drawImage(sumber, 0, 0, kanvas.width, kanvas.height);
  return new Promise(r => kanvas.toBlob(r, 'image/jpeg', mutu));
}

/** Perkecil bertahap sampai di bawah ukuran target. */
async function perkecilFoto(file) {
  const sumber = await ambilBitmap(file);
  let sisi = PROFIL_FOTO.maksSisi, mutu = PROFIL_FOTO.mutu, hasil = null;
  for (let putaran = 0; putaran < 7; putaran++) {
    hasil = await keBlob(sumber, sisi, mutu);
    if (!hasil) break;
    if (hasil.size <= PROFIL_FOTO.target) break;
    if (mutu > 0.5) mutu -= 0.12; else sisi = Math.round(sisi * 0.8);
  }
  sumber.close?.();
  if (!hasil) throw new Error('Foto gagal diproses di perangkat ini.');
  return hasil;
}

const ukuran = n => n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

$('#foto').addEventListener('change', async e => {
  const file = e.target.files[0];
  const pratinjau = $('#pratinjau'), info = $('#infoFoto');
  fotoSiap = null;
  pratinjau.innerHTML = '';

  if (!file) {
    pratinjau.textContent = 'Belum ada foto';
    info.textContent = 'Format JPG, PNG, atau WEBP.';
    return;
  }
  if (!file.type.startsWith('image/')) {
    pesan('Berkas yang dipilih bukan gambar.', 'galat');
    e.target.value = ''; pratinjau.textContent = 'Belum ada foto';
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    pesan('Ukuran foto maksimal 20 MB.', 'galat');
    e.target.value = ''; pratinjau.textContent = 'Belum ada foto';
    return;
  }

  pratinjau.textContent = 'Memproses…';
  info.textContent = 'Memproses foto…';
  try {
    fotoSiap = await perkecilFoto(file);
    const gambar = document.createElement('img');
    gambar.src = URL.createObjectURL(fotoSiap);
    gambar.alt = 'Pratinjau foto guru';
    pratinjau.innerHTML = '';
    pratinjau.appendChild(gambar);
    info.textContent = fotoSiap.size < file.size
      ? `Siap dikirim — ${ukuran(file.size)} diperkecil menjadi ${ukuran(fotoSiap.size)}.`
      : `Siap dikirim — ${ukuran(fotoSiap.size)}.`;
    bersihkanPesan();
  } catch (err) {
    pratinjau.textContent = 'Belum ada foto';
    info.textContent = 'Format JPG, PNG, atau WEBP.';
    pesan('Foto tidak dapat diproses. Coba pilih foto lain (JPG atau PNG).', 'galat');
  }
});

/* ============================================================
   Kirim
   ============================================================ */
function idAcak() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

const tunggu = ms => new Promise(r => setTimeout(r, ms));

function blobKeTeks(blob) {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload  = () => selesai(pembaca.result);
    pembaca.onerror = () => gagal(new Error('Foto gagal dibaca.'));
    pembaca.readAsDataURL(blob);
  });
}

/* Harus sama persis dengan batas pada firestore.rules. */
const PANJANG_MINIMUM = [
  ['nama', 2, 'Nama lengkap terlalu pendek — mohon tulis nama lengkap Anda, minimal 2 huruf.'],
  ['telepon_hp', 5, 'Nomor HP / WhatsApp terlalu pendek. Mohon tulis nomor lengkap, contoh: 081234567890.'],
  ['no_rekening', 5, 'Nomor rekening terlalu pendek. Mohon tulis nomor rekening lengkap.'],
  ['nama_bank', 2, 'Nama bank terlalu pendek. Mohon tulis nama bank, contoh: BRI.'],
  ['cabang_bank', 2, 'Cabang bank terlalu pendek. Mohon tulis nama cabang bank.']
];

let sedangKirim = false;

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (sedangKirim) return;
  bersihkanPesan();

  /* Aturan keamanan di server menuntut panjang minimum tertentu. Diperiksa lebih
     dahulu supaya guru mendapat penjelasan yang tepat — bukan pesan umum, dan
     bukan penolakan server yang membingungkan. Kolom yang masih kosong sengaja
     dilewati agar tetap tertangani sebagai "isian wajib". */
  for (const [kolom, minimal, penjelasan] of PANJANG_MINIMUM) {
    const isian = form.elements[kolom];
    const nilai = isian ? isian.value.trim() : '';
    if (nilai !== '' && nilai.length < minimal) {
      pesan(penjelasan, 'galat');
      isian.focus();
      return;
    }
  }

  if (!form.checkValidity()) {
    const kosong = form.querySelector(':invalid');
    pesan('Masih ada isian wajib yang kosong atau belum benar. Silakan periksa kembali.', 'galat');
    kosong?.focus();
    return;
  }
  if (!fotoSiap) {
    pesan('Foto guru wajib diunggah.', 'galat');
    $('#foto').focus();
    return;
  }
  for (const blok of daftar.children) {
    for (const input of blok.querySelectorAll('[data-wajib]')) {
      if (!input.value.trim()) {
        pesan('Nama sekolah dan kelas wajib diisi pada setiap blok sekolah.', 'galat');
        input.focus();
        return;
      }
    }
  }

  if (navigator.onLine === false) {
    pesan('Perangkat Anda sedang tidak tersambung ke internet. Nyalakan data seluler atau WiFi, '
        + 'lalu tekan "Kirim Data Guru" lagi. Isian Anda tidak akan hilang.', 'galat');
    return;
  }

  const tombol = $('#tombolKirim');
  sedangKirim = true;
  form.classList.add('memuat');
  tombol.textContent = 'Menyiapkan data…';

  let jalurFoto = null;

  try {
    const { db, fs } = await inti();
    const acuan = fs.doc(fs.collection(db, 'guru'));

    const data = { sekolah: bacaSekolah() };
    new FormData(form).forEach((v, k) => {
      if (k === 'foto') return;
      const nilai = String(v).trim();
      data[k] = nilai === '' ? null : nilai;
    });
    data.pernyataan = true;
    data.foto_mode  = PENGATURAN.mode_foto === 'storage' ? 'storage' : 'firestore';
    data.foto_path  = null;
    data.created_at = fs.serverTimestamp();

    const kumpulan = fs.writeBatch(db);

    if (data.foto_mode === 'storage') {
      tombol.textContent = 'Mengunggah foto…';
      const { mod, st } = await penyimpanan();
      jalurFoto = `foto-guru/${new Date().getFullYear()}/${idAcak()}.jpg`;
      await mod.uploadBytes(mod.ref(st, jalurFoto), fotoSiap, { contentType: 'image/jpeg' });
      data.foto_path = jalurFoto;
    } else {
      tombol.textContent = 'Menyiapkan foto…';
      const teksFoto = await blobKeTeks(fotoSiap);
      kumpulan.set(fs.doc(db, 'foto_guru', acuan.id), {
        data: teksFoto,
        created_at: fs.serverTimestamp()
      });
    }

    tombol.textContent = 'Menyimpan data…';
    kumpulan.set(acuan, data);

    /* Firestore menyimpan penulisan yang belum terkirim di dalam browser dan
       terus mencobanya sampai server menjawab. Karena itu commit() bisa
       menggantung lama pada jaringan buruk — jangan biarkan guru menatap
       tombol tanpa penjelasan, dan jangan pula suruh mengirim ulang
       (datanya bisa dobel). */
    const janji = kumpulan.commit();
    const hasil = await Promise.race([janji.then(() => 'selesai'), tunggu(25000)]);
    if (hasil !== 'selesai') {
      tombol.textContent = 'Menunggu server…';
      pesan('Koneksi ke server sedang lambat atau terputus. Data Anda sudah tersimpan di HP ini '
          + 'dan akan terkirim otomatis begitu internet tersambung kembali.\n\n'
          + 'MOHON JANGAN MENUTUP HALAMAN INI. Konfirmasi akan muncul sendiri bila sudah '
          + 'berhasil. Tidak perlu menekan tombol kirim lagi.', 'info');
      await janji;
    }

    hapusDraf();
    $('#kartuForm').classList.add('tersembunyi');
    $('#kodeBukti').textContent = acuan.id.slice(0, 8).toUpperCase();
    $('#kartuSukses').classList.remove('tersembunyi');
    bersihkanPesan();
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    /* Penolakan izin pada formulir publik hampir selalu berarti bentuk datanya
       tidak lolos pemeriksaan server — bukan masalah hak akses. Arahkan guru
       memperbaiki isiannya, jangan disuruh menghubungi pengurus. */
    pesan(galatIzin(err)
      ? 'Server menolak data ini karena ada isian yang belum sesuai ketentuan.\n\n'
        + 'Yang paling sering: nama lengkap kurang dari 2 huruf, nomor HP kurang dari '
        + '5 angka, atau ada isian yang jauh terlalu panjang. Mohon periksa kembali '
        + 'lalu tekan Kirim lagi.\n\nRincian teknis: ' + rincianGalat(err)
      : jelaskanGalat(err), 'galat');
    // Foto yang terlanjur terunggah dibiarkan; pengurus bisa membersihkannya
    // dari Firebase Console. Guru anonim sengaja tidak diberi izin menghapus.
  } finally {
    sedangKirim = false;
    form.classList.remove('memuat');
    tombol.textContent = 'Kirim Data Guru';
  }
});

/* ============================================================
   Kosongkan & isi lagi
   ============================================================ */
function kosongkan() {
  form.reset();
  daftar.innerHTML = '';
  tambahSekolah();
  fotoSiap = null;
  $('#pratinjau').textContent = 'Belum ada foto';
  $('#infoFoto').textContent = 'Format JPG, PNG, atau WEBP.';
  hapusDraf();
}

$('#tombolKosong').addEventListener('click', () => {
  if (confirm('Kosongkan seluruh isian formulir?')) { kosongkan(); bersihkanPesan(); }
});

$('#tombolIsiLagi').addEventListener('click', () => {
  kosongkan();
  $('#kartuSukses').classList.add('tersembunyi');
  $('#kartuForm').classList.remove('tersembunyi');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ============================================================
   Jalan pertama kali
   ============================================================ */
const adaDraf = pulihkanDraf();
if (!daftar.children.length) tambahSekolah();
if (adaDraf && !DARI_BERKAS && !belumDikonfigurasi()) {
  pesan('Isian Anda sebelumnya berhasil dipulihkan. Silakan lanjutkan — foto perlu dipilih ulang.', 'ok');
}

form.addEventListener('input', simpanDraf);
form.addEventListener('change', simpanDraf);

window.addEventListener('beforeunload', e => {
  if (sedangKirim) { e.preventDefault(); e.returnValue = ''; }
});
