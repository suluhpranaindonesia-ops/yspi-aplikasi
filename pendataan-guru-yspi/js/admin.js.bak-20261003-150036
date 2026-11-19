/* ============================================================
   Dashboard pengurus — hanya untuk akun yang terdaftar di
   koleksi "pengurus" pada Firestore.
   ============================================================ */
import { PENGATURAN } from './firebase-config.js';
import { inti, otentikasi, penyimpanan, jelaskanGalat, galatIzin, rincianGalat,
         belumDikonfigurasi, DARI_BERKAS } from './firebase-init.js';

const $ = s => document.querySelector(s);

let dataGuru = [];                 // seluruh guru + array sekolah di dalamnya
const cacheFoto = new Map();       // id guru -> URL / data URL (null bila gagal)
const sedangAmbilFoto = new Map(); // id guru -> Promise
let pengguna = null;

/* ---------- util tampilan ---------- */
const aman = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const nilai = v => (v === null || v === undefined || String(v).trim() === '') ? '—' : String(v);

function keTanggal(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
function waktuLengkap(v) {
  const d = keTanggal(v);
  return d ? d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
function tanggalSaja(v) {
  const d = keTanggal(v);
  return d ? d.toLocaleDateString('id-ID', { dateStyle: 'long' }) : nilai(v);
}

function pesan(teks, tipe = 'galat') {
  const el = $('#pesan');
  el.className = 'pesan ' + tipe;
  el.textContent = teks;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function bersihkanPesan() { $('#pesan').style.display = 'none'; }

/* ============================================================
   Masuk / keluar
   ============================================================ */
function jelaskanLogin(err) {
  const kode = String(err?.code || err?.message || '');
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/i.test(kode))
    return 'Email atau password salah. Silakan periksa kembali.';
  if (/invalid-email/i.test(kode))       return 'Format email tidak benar.';
  if (/user-disabled/i.test(kode))       return 'Akun ini dinonaktifkan. Hubungi pengurus utama.';
  if (/too-many-requests/i.test(kode))   return 'Terlalu banyak percobaan gagal. Tunggu beberapa menit, lalu coba lagi.';
  if (/operation-not-allowed/i.test(kode))
    return 'Metode login Email/Password belum diaktifkan di Firebase Console '
         + '(Authentication → Sign-in method).';
  return jelaskanGalat(err);
}

$('#formMasuk').addEventListener('submit', async e => {
  e.preventDefault();
  bersihkanPesan();
  const tombol = $('#tombolMasuk');
  tombol.disabled = true;
  tombol.textContent = 'Memproses…';
  try {
    const { mod, auth } = await otentikasi();
    await mod.signInWithEmailAndPassword(auth, $('#email').value.trim(), $('#katasandi').value);
    // onAuthStateChanged yang membuka dashboard
  } catch (err) {
    console.error(err);
    pesan(jelaskanLogin(err));
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Masuk';
  }
});

/* Password Firebase tidak bisa dibaca siapa pun — hanya bisa disetel ulang
   lewat tautan yang dikirim ke email pemiliknya. */
$('#tombolLupa').addEventListener('click', async () => {
  bersihkanPesan();
  const email = $('#email').value.trim();
  if (!email) {
    pesan('Isi dulu kolom Email di atas, lalu tekan "Lupa password?" lagi.');
    $('#email').focus();
    return;
  }

  const tombol = $('#tombolLupa');
  const pulihkan = () => { tombol.disabled = false; tombol.textContent = 'Lupa password?'; };
  tombol.disabled = true;
  tombol.textContent = 'Mengirim…';

  try {
    const { mod, auth } = await otentikasi();
    await mod.sendPasswordResetEmail(auth, email);
  } catch (err) {
    console.error(err);
    const kode = String(err?.code || '');
    if (/invalid-email/i.test(kode)) { pesan('Format email tidak benar.'); pulihkan(); return; }
    /* Email tak dikenal sengaja tidak dibedakan dari yang terdaftar, supaya
       halaman ini tidak bisa dipakai menebak-nebak siapa saja pengurusnya. */
    if (!/user-not-found/i.test(kode)) { pesan(jelaskanGalat(err)); pulihkan(); return; }
  }

  pesan('Bila ' + email + ' terdaftar sebagai pengurus, tautan untuk membuat password '
      + 'baru sudah dikirim ke alamat itu. Periksa kotak masuk dan folder spam.', 'ok');
  pulihkan();
});

$('#tombolKeluar').addEventListener('click', async () => {
  try {
    const { mod, auth } = await otentikasi();
    await mod.signOut(auth);
  } catch {}
  location.reload();
});

/** Menguji langsung apakah akun ini benar-benar boleh membaca data guru.
 *  Lebih tepat daripada menebak lewat keberadaan satu dokumen, karena hak akses
 *  bisa datang dari dua jalur: daftar UID di firestore.rules, atau dokumen pada
 *  koleksi "pengurus". */
async function bolehMembacaData() {
  const { db, fs } = await inti();
  try {
    await fs.getDocs(fs.query(fs.collection(db, 'guru'), fs.limit(1)));
    return true;
  } catch (err) {
    console.error('Uji baca ditolak:', err);
    if (galatIzin(err)) return false;
    throw err;   // koneksi / konfigurasi — ditangani pemanggil
  }
}

async function bukaDashboard(akun) {
  pengguna = akun;
  $('#akun').textContent = 'Masuk sebagai ' + akun.email;
  $('#tombolKeluar').classList.remove('tersembunyi');

  let berhak;
  try {
    berhak = await bolehMembacaData();
  } catch (err) {
    console.error(err);
    pesan(jelaskanGalat(err) + '\n\nRincian teknis: ' + rincianGalat(err)
        + '\nUID akun ini: ' + akun.uid);
    return;
  }

  if (!berhak) {
    pesan('Akun ini berhasil login, tetapi belum berhak membuka data guru.\n\n'
        + 'UID akun ini:\n' + akun.uid + '\n\n'
        + 'Pengurus utama perlu menambahkan UID tersebut — lewat daftar pada '
        + 'firestore.rules, atau lewat dokumen pada koleksi "pengurus" di Firestore. '
        + 'Bila UID ini sudah terdaftar, tunggu satu menit lalu muat ulang halaman: '
        + 'perubahan aturan keamanan butuh waktu singkat untuk berlaku.');
    return;
  }

  $('#kartuMasuk').classList.add('tersembunyi');
  $('#dashboard').classList.remove('tersembunyi');
  await muatData();
}

/* ============================================================
   Ambil data
   ============================================================ */
async function muatData() {
  bersihkanPesan();
  $('#daftar').innerHTML = '<div class="kosong">Memuat data…</div>';
  cacheFoto.clear();
  sedangAmbilFoto.clear();

  try {
    const { db, fs } = await inti();
    const cuplikan = await fs.getDocs(
      fs.query(fs.collection(db, 'guru'), fs.orderBy('created_at', 'desc'))
    );
    dataGuru = cuplikan.docs.map(d => {
      const isi = d.data();
      return { id: d.id, ...isi, sekolah: Array.isArray(isi.sekolah) ? isi.sekolah : [] };
    });
    hitungStatistik();
    tampilkan();

    /* Firestore bisa menjawab dari salinan lokal ketika server tak terjangkau.
       Tanpa peringatan ini, daftar kosong terlihat seperti "belum ada data". */
    if (cuplikan.metadata.fromCache) {
      pesan('Data di layar ini berasal dari salinan lokal di browser karena server Firebase '
          + 'belum terjangkau. Periksa koneksi internet, lalu tekan "Muat Ulang".', 'info');
    }
  } catch (err) {
    console.error(err);
    $('#daftar').innerHTML = '';
    pesan('Gagal mengambil data guru. ' + jelaskanGalat(err));
  }
}

function hitungStatistik() {
  const semua = dataGuru.flatMap(g => g.sekolah);
  $('#stGuru').textContent = dataGuru.length.toLocaleString('id-ID');
  $('#stSekolah').textContent = new Set(
    semua.map(s => String(s.nama_sekolah || '').trim().toLowerCase()).filter(Boolean)
  ).size.toLocaleString('id-ID');
  $('#stKelas').textContent = semua.length.toLocaleString('id-ID');
  $('#stSiswa').textContent = semua
    .reduce((total, s) => total + (Number(s.jumlah_siswa) || 0), 0)
    .toLocaleString('id-ID');
}

/* ============================================================
   Foto — diambil hanya saat dibutuhkan
   ============================================================ */
async function ambilFoto(guru) {
  if (cacheFoto.has(guru.id)) return cacheFoto.get(guru.id);
  if (sedangAmbilFoto.has(guru.id)) return sedangAmbilFoto.get(guru.id);

  const tugas = (async () => {
    try {
      if (guru.foto_mode === 'storage') {
        if (!guru.foto_path) return null;
        const { mod, st } = await penyimpanan();
        return await mod.getDownloadURL(mod.ref(st, guru.foto_path));
      }
      const { db, fs } = await inti();
      const dok = await fs.getDoc(fs.doc(db, 'foto_guru', guru.id));
      return dok.exists() ? (dok.data().data || null) : null;
    } catch (err) {
      console.error('Foto gagal dimuat untuk', guru.id, err);
      return null;
    }
  })();

  sedangAmbilFoto.set(guru.id, tugas);
  const hasil = await tugas;
  sedangAmbilFoto.delete(guru.id);
  cacheFoto.set(guru.id, hasil);
  return hasil;
}

/* Muat foto begitu barisnya terlihat di layar, bukan sekaligus semuanya. */
const pengamat = new IntersectionObserver(async entri => {
  for (const e of entri) {
    if (!e.isIntersecting) continue;
    const kotak = e.target;
    pengamat.unobserve(kotak);
    const guru = dataGuru.find(g => g.id === kotak.dataset.foto);
    if (!guru) continue;
    const sumber = await ambilFoto(guru);
    if (!document.body.contains(kotak)) continue;
    if (sumber) {
      kotak.innerHTML = `<img src="${aman(sumber)}" alt="Foto ${aman(guru.nama)}"
        style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
    } else {
      kotak.textContent = 'Tanpa foto';
    }
  }
}, { rootMargin: '200px' });

/* ============================================================
   Pencarian, pengurutan, daftar
   ============================================================ */
function cocok(guru, kueri) {
  if (!kueri) return true;
  const teks = [
    guru.nama, guru.telepon_hp, guru.telepon_rumah, guru.telepon_sekolah, guru.gereja,
    guru.alamat, guru.dusun, guru.desa, guru.kecamatan, guru.kabupaten, guru.provinsi,
    guru.pendidikan, guru.jurusan, guru.universitas, guru.pasangan, guru.jabatan_desa,
    ...guru.sekolah.flatMap(s => [s.nama_sekolah, s.kelas, s.alamat_sekolah, s.ruangan, s.hari_mengajar])
  ].join(' ').toLowerCase();
  return kueri.toLowerCase().split(/\s+/).filter(Boolean).every(kata => teks.includes(kata));
}

function terurut(daftar) {
  const mode = $('#urut').value;
  const salinan = [...daftar];
  const waktu = g => keTanggal(g.created_at)?.getTime() ?? 0;
  if (mode === 'lama')  return salinan.sort((a, b) => waktu(a) - waktu(b));
  if (mode === 'nama')  return salinan.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
  if (mode === 'kelas') return salinan.sort((a, b) => b.sekolah.length - a.sekolah.length);
  return salinan.sort((a, b) => waktu(b) - waktu(a));
}

function hasilTersaring() {
  return terurut(dataGuru.filter(g => cocok(g, $('#cari').value.trim())));
}

function tampilkan() {
  const tampil = hasilTersaring();
  $('#jumlah').textContent =
    `Menampilkan ${tampil.length.toLocaleString('id-ID')} dari ${dataGuru.length.toLocaleString('id-ID')} guru terdata.`;

  if (!tampil.length) {
    $('#daftar').innerHTML = `<div class="kosong">${dataGuru.length
      ? 'Tidak ada data yang cocok dengan pencarian.'
      : 'Belum ada data guru yang masuk.'}</div>`;
    return;
  }

  $('#daftar').innerHTML = tampil.map(g => {
    const tersimpan = cacheFoto.get(g.id);
    const isiAvatar = tersimpan
      ? `<img src="${aman(tersimpan)}" alt="Foto ${aman(g.nama)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`
      : 'Memuat…';
    const label = g.sekolah.slice(0, 6).map(s =>
        `<span class="tanda">${aman(nilai(s.nama_sekolah))} · ${aman(nilai(s.kelas))}</span>`).join('')
      + (g.sekolah.length > 6 ? `<span class="tanda">+${g.sekolah.length - 6} lainnya</span>` : '');

    return `<article class="baris">
      <div class="avatar" data-foto="${aman(g.id)}" data-detail="${aman(g.id)}" title="Lihat detail">${isiAvatar}</div>
      <div class="rincian">
        <h3>${aman(nilai(g.nama))}</h3>
        <div class="meta">
          <b>HP:</b> ${aman(nilai(g.telepon_hp))} &nbsp;·&nbsp; <b>Gereja:</b> ${aman(nilai(g.gereja))}<br>
          <b>Alamat:</b> ${aman(nilai(g.alamat))}${g.desa ? ', Desa ' + aman(g.desa) : ''}${g.kecamatan ? ', Kec. ' + aman(g.kecamatan) : ''}<br>
          <b>Pendidikan:</b> ${aman(nilai(g.pendidikan))}${g.jurusan ? ' — ' + aman(g.jurusan) : ''}
          &nbsp;·&nbsp; <b>Masuk:</b> ${aman(waktuLengkap(g.created_at))}
        </div>
        <div>${label || '<span class="tanda">Belum ada data sekolah</span>'}</div>
        <div class="aksi">
          <button class="kedua kecil" data-detail="${aman(g.id)}">Lihat Detail</button>
          <button class="bahaya kecil" data-hapus="${aman(g.id)}">Hapus Data</button>
        </div>
      </div>
    </article>`;
  }).join('');

  $('#daftar').querySelectorAll('[data-foto]').forEach(el => {
    if (!cacheFoto.get(el.dataset.foto)) pengamat.observe(el);
  });
}

$('#daftar').addEventListener('click', e => {
  const hapus = e.target.closest('[data-hapus]');
  if (hapus) { hapusGuru(hapus.dataset.hapus); return; }
  const detail = e.target.closest('[data-detail]');
  if (detail) bukaDetail(detail.dataset.detail);
});

/* ============================================================
   Detail
   ============================================================ */
const BLOK = [
  ['Data Pribadi', [
    ['Nama Lengkap', g => g.nama], ['Jenis Kelamin', g => g.jenis_kelamin],
    ['Tempat Lahir', g => g.tempat_lahir], ['Tanggal Lahir', g => tanggalSaja(g.tanggal_lahir)],
    ['Alamat Rumah / Surat', g => g.alamat, true],
    ['RT / RW', g => `${nilai(g.rt)} / ${nilai(g.rw)}`],
    ['Dusun', g => g.dusun], ['Desa / Kelurahan', g => g.desa],
    ['Kecamatan', g => g.kecamatan], ['Kabupaten / Kota', g => g.kabupaten],
    ['Provinsi', g => g.provinsi], ['Telepon Rumah', g => g.telepon_rumah],
    ['Telepon Sekolah', g => g.telepon_sekolah], ['HP / WhatsApp', g => g.telepon_hp],
    ['Kontak Lainnya', g => g.telepon_lainnya]
  ]],
  ['Pendidikan', [
    ['Pendidikan Terakhir', g => g.pendidikan], ['Jurusan', g => g.jurusan],
    ['Universitas / Sekolah', g => g.universitas], ['Tahun Kelulusan', g => g.tahun_lulus],
    ['Alamat Universitas / Sekolah', g => g.alamat_universitas, true]
  ]],
  ['Gereja', [
    ['Nama Gereja', g => g.gereja], ['Alamat Gereja', g => g.alamat_gereja, true]
  ]],
  ['Keluarga & Pekerjaan', [
    ['Status Pernikahan', g => g.status_nikah], ['Nama Suami / Istri', g => g.pasangan],
    ['TTL Suami / Istri', g => g.ttl_pasangan, true], ['Nama Anak', g => g.anak, true],
    ['Gaji / Honor dari Mengajar PAK per Bulan', g => g.gaji_pak],
    ['Pekerjaan Sambilan', g => g.pekerjaan_sambilan],
    ['Golongan Darah', g => g.gol_darah], ['Jabatan di Desa / Kampung', g => g.jabatan_desa]
  ]],
  ['Rekening Bank', [
    ['Nomor Rekening', g => g.no_rekening], ['Nama Bank', g => g.nama_bank],
    ['Cabang Bank', g => g.cabang_bank], ['Email Rekening', g => g.email_rekening]
  ]]
];

async function bukaDetail(id) {
  const g = dataGuru.find(x => x.id === id);
  if (!g) return;

  const isiBlok = BLOK.map(([judul, kolom]) => `
    <div class="judul-blok" style="grid-column:1/-1">${judul}</div>
    ${kolom.map(([label, ambil, penuh]) => `
      <div class="item"${penuh ? ' style="grid-column:1/-1"' : ''}>
        <div class="k">${label}</div>
        <div class="v">${aman(nilai(ambil(g))).replace(/\n/g, '<br>')}</div>
      </div>`).join('')}`).join('');

  const tabel = g.sekolah.length ? `
    <table>
      <thead><tr><th>No</th><th>Nama Sekolah</th><th>Alamat</th><th>Kelas</th><th>Siswa</th>
        <th>Ruangan</th><th>Hari</th><th>Jam</th></tr></thead>
      <tbody>${g.sekolah.map((s, i) => `<tr>
        <td>${i + 1}</td><td>${aman(nilai(s.nama_sekolah))}</td><td>${aman(nilai(s.alamat_sekolah))}</td>
        <td>${aman(nilai(s.kelas))}</td><td>${aman(nilai(s.jumlah_siswa))}</td>
        <td>${aman(nilai(s.ruangan))}</td>
        <td>${aman(nilai(s.hari_mengajar))}</td><td>${aman(nilai(s.jam_mengajar))}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="kosong">Belum ada data sekolah.</div>';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-isi" role="dialog" aria-modal="true" aria-label="Detail guru">
    <button class="kedua kecil tutup" data-tutup>Tutup</button>
    <div class="kepala-detail">
      <div id="fotoDetail" style="width:124px;height:155px;flex:none;border-radius:11px;background:#fdf1f1;
           display:flex;align-items:center;justify-content:center;font-size:12px;color:#a8969a">Memuat…</div>
      <div>
        <h2 style="margin:0 0 4px;font-size:22px;color:#8f1219">${aman(nilai(g.nama))}</h2>
        <div class="meta">
          ${aman(nilai(g.jenis_kelamin))} · ${aman(nilai(g.telepon_hp))}<br>
          Dikirim ${aman(waktuLengkap(g.created_at))}<br>
          <small>No. bukti: ${aman(g.id.slice(0, 8).toUpperCase())}</small>
        </div>
        <div class="aksi">
          <button class="kedua kecil" data-cetak>Cetak / Simpan PDF</button>
          <a class="kedua kecil tersembunyi" id="unduhFoto" style="text-decoration:none;display:inline-block"
             download="foto-${aman(String(g.nama || 'guru').replace(/[^\w\s-]/g, ''))}.jpg">Unduh Foto</a>
        </div>
      </div>
    </div>
    <div class="kisi-detail">${isiBlok}</div>
    <div class="judul-blok">Sekolah yang Dilayani</div>
    <div class="tabel-mini">${tabel}</div>
  </div>`;

  function tutup() {
    modal.remove();
    document.removeEventListener('keydown', tombolEsc);
  }
  function tombolEsc(e) { if (e.key === 'Escape') tutup(); }

  /* Foto baru tersedia setelah diambil di bawah; tombol cetak memakainya. */
  let fotoDetail = null;

  modal.addEventListener('click', async e => {
    if (e.target === modal || e.target.closest('[data-tutup]')) { tutup(); return; }
    const cetak = e.target.closest('[data-cetak]');
    if (!cetak) return;

    const labelAsli = cetak.textContent;
    cetak.disabled = true;
    cetak.textContent = 'Menyiapkan…';
    try {
      const { cetakBiodata } = await import('./cetak-biodata.js');
      await cetakBiodata(g, fotoDetail);
    } catch (err) {
      console.error(err);
      pesan('Gagal menyiapkan halaman cetak. ' + jelaskanGalat(err));
    } finally {
      cetak.disabled = false;
      cetak.textContent = labelAsli;
    }
  });
  document.addEventListener('keydown', tombolEsc);
  document.body.appendChild(modal);

  const sumber = await ambilFoto(g);
  fotoDetail = sumber;
  const kotak = modal.querySelector('#fotoDetail');
  if (!kotak) return;
  if (sumber) {
    kotak.outerHTML = `<img src="${aman(sumber)}" alt="Foto ${aman(g.nama)}">`;
    const unduh = modal.querySelector('#unduhFoto');
    unduh.href = sumber;
    if (String(sumber).startsWith('http')) unduh.target = '_blank';
    unduh.classList.remove('tersembunyi');
  } else {
    kotak.textContent = 'Tanpa foto';
  }
}

/* ============================================================
   Hapus
   ============================================================ */
async function hapusGuru(id) {
  const g = dataGuru.find(x => x.id === id);
  if (!g) return;
  if (!confirm(`Hapus data "${g.nama}" beserta ${g.sekolah.length} baris sekolah dan fotonya?\n\n`
             + 'Tindakan ini tidak dapat dibatalkan.')) return;

  try {
    const { db, fs } = await inti();
    const kumpulan = fs.writeBatch(db);
    kumpulan.delete(fs.doc(db, 'guru', id));
    if (g.foto_mode !== 'storage') kumpulan.delete(fs.doc(db, 'foto_guru', id));
    await kumpulan.commit();

    if (g.foto_mode === 'storage' && g.foto_path) {
      try {
        const { mod, st } = await penyimpanan();
        await mod.deleteObject(mod.ref(st, g.foto_path));
      } catch (err) {
        console.warn('Data terhapus, tetapi berkas foto gagal dihapus:', err);
      }
    }

    cacheFoto.delete(id);
    dataGuru = dataGuru.filter(x => x.id !== id);
    hitungStatistik();
    tampilkan();
    pesan(`Data "${g.nama}" berhasil dihapus.`, 'ok');
  } catch (err) {
    console.error(err);
    pesan('Gagal menghapus. ' + jelaskanGalat(err));
  }
}

/* ============================================================
   Export
   ============================================================ */
const JUDUL_KOLOM = ['Nama', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Alamat', 'RT', 'RW',
  'Dusun', 'Desa/Kelurahan', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Telepon Rumah',
  'Telepon Sekolah', 'HP/WhatsApp', 'Kontak Lainnya', 'Pendidikan Terakhir', 'Jurusan',
  'Universitas/Sekolah', 'Tahun Lulus', 'Alamat Universitas', 'Gereja', 'Alamat Gereja',
  'Status Pernikahan', 'Suami/Istri', 'TTL Suami/Istri', 'Anak',
  'Gaji/Honor dari Mengajar PAK per Bulan',
  'Pekerjaan Sambilan', 'Gol. Darah', 'Jabatan Desa',
  'No. Rekening', 'Nama Bank', 'Cabang Bank', 'Email Rekening', 'Nama Sekolah', 'Alamat Sekolah', 'Kelas',
  'Jumlah Siswa', 'Ruang/Tempat Mengajar', 'Hari Mengajar', 'Jam Mengajar', 'Tanggal Kirim',
  'No. Bukti'];

function barisExport() {
  const hasil = [];
  hasilTersaring().forEach(g => {
    (g.sekolah.length ? g.sekolah : [{}]).forEach(s => {
      hasil.push([
        g.nama, g.jenis_kelamin, g.tempat_lahir, g.tanggal_lahir, g.alamat, g.rt, g.rw, g.dusun,
        g.desa, g.kecamatan, g.kabupaten, g.provinsi, g.telepon_rumah, g.telepon_sekolah,
        g.telepon_hp, g.telepon_lainnya, g.pendidikan, g.jurusan, g.universitas, g.tahun_lulus,
        g.alamat_universitas, g.gereja, g.alamat_gereja, g.status_nikah, g.pasangan,
        g.ttl_pasangan, g.anak, g.gaji_pak, g.pekerjaan_sambilan, g.gol_darah, g.jabatan_desa,
        g.no_rekening, g.nama_bank, g.cabang_bank, g.email_rekening,
        s.nama_sekolah, s.alamat_sekolah, s.kelas, s.jumlah_siswa, s.ruangan,
        s.hari_mengajar, s.jam_mengajar,
        waktuLengkap(g.created_at), g.id.slice(0, 8).toUpperCase()
      ].map(v => v ?? ''));
    });
  });
  return hasil;
}

function unduh(isi, namaBerkas, jenis) {
  const blob = new Blob(['﻿' + isi], { type: jenis });
  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(blob);
  tautan.download = namaBerkas;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  setTimeout(() => URL.revokeObjectURL(tautan.href), 1000);
}
const namaBerkas = ext => `pendataan-guru-yspi-${new Date().toISOString().slice(0, 10)}.${ext}`;

$('#tombolCsv').addEventListener('click', () => {
  // pemisah titik koma supaya langsung rapi di Excel berbahasa Indonesia
  const sel = v => '"' + String(v).replace(/"/g, '""') + '"';
  const isi = [JUDUL_KOLOM, ...barisExport()].map(r => r.map(sel).join(';')).join('\r\n');
  unduh(isi, namaBerkas('csv'), 'text/csv;charset=utf-8');
});

/* Excel: satu lembar biodata per guru, foto ikut tertanam. Modulnya —
   berikut pustaka ExcelJS yang hampir 1 MB — baru dimuat saat tombol ditekan,
   supaya dashboard tetap ringan dibuka. */
$('#tombolExcel').addEventListener('click', async () => {
  const tampil = hasilTersaring();
  if (!tampil.length) { pesan('Tidak ada data yang bisa diekspor.'); return; }
  if (tampil.length > 60 && !confirm(
        `Akan dibuat ${tampil.length} lembar biodata lengkap dengan fotonya.\n\n`
      + 'Berkasnya bisa berukuran besar dan perlu waktu beberapa menit. Untuk hasil '
      + 'yang lebih ringan, gunakan kotak Cari dulu — ekspor hanya mengambil data '
      + 'yang sedang tampil.\n\nLanjutkan?')) return;

  const tombol = $('#tombolExcel');
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    const { unduhBiodataExcel } = await import('./export-excel.js');
    const hasil = await unduhBiodataExcel({
      daftarGuru: tampil,
      ambilFoto,
      lapor: keterangan => pesan(keterangan, 'info')
    });
    pesan(`Berkas Excel selesai: ${hasil.jumlah} lembar biodata, `
        + `${hasil.berfoto} di antaranya lengkap dengan foto.`, 'ok');
  } catch (err) {
    console.error(err);
    pesan('Gagal membuat berkas Excel. ' + jelaskanGalat(err));
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Export Biodata Excel';
  }
});


/* Cetak semua biodata sekaligus — satu guru satu halaman A4. */
$('#tombolCetakSemua').addEventListener('click', async () => {
  const tampil = hasilTersaring();
  if (!tampil.length) { pesan('Tidak ada data yang bisa dicetak.'); return; }
  if (tampil.length > 40 && !confirm(
        `Akan disusun ${tampil.length} halaman biodata berikut fotonya.\n\n`
      + 'Penyiapannya perlu waktu dan memakan memori browser. Untuk hasil yang lebih '
      + 'ringan, saring dulu lewat kotak Cari — pencetakan hanya mengambil data yang '
      + 'sedang tampil.\n\nLanjutkan?')) return;

  const tombol = $('#tombolCetakSemua');
  tombol.disabled = true;
  tombol.textContent = 'Menyiapkan…';
  try {
    const { cetakSemuaBiodata } = await import('./cetak-biodata.js');
    const hasil = await cetakSemuaBiodata({
      daftarGuru: tampil,
      ambilFoto,
      lapor: keterangan => pesan(keterangan, 'info')
    });
    pesan(`Siap dicetak: ${hasil.jumlah} halaman biodata, `
        + `${hasil.berfoto} di antaranya lengkap dengan foto. `
        + 'Pada dialog cetak, pilih "Save as PDF" bila ingin disimpan sebagai berkas.', 'ok');
  } catch (err) {
    console.error(err);
    pesan('Gagal menyiapkan halaman cetak. ' + jelaskanGalat(err));
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Cetak Semua (PDF)';
  }
});

/* ============================================================
   Pengikat & jalan pertama kali
   ============================================================ */
$('#tombolMuatUlang').addEventListener('click', muatData);
$('#cari').addEventListener('input', tampilkan);
$('#urut').addEventListener('change', tampilkan);

(async () => {
  if (DARI_BERKAS) {
    pesan('Halaman ini dibuka langsung dari berkas komputer (file://). Login tidak akan berhasil. '
        + 'Halaman pengurus harus diakses lewat alamat https://… setelah website dipublikasikan.');
    return;
  }
  if (belumDikonfigurasi()) {
    pesan('Firebase belum dikonfigurasi. Isi dulu berkas js/firebase-config.js dengan data project '
        + 'Firebase Anda, lalu deploy ulang.');
    return;
  }
  try {
    const { mod, auth } = await otentikasi();
    mod.onAuthStateChanged(auth, akun => {
      if (akun) bukaDashboard(akun);
    });
  } catch (err) {
    console.error(err);
    pesan(jelaskanGalat(err));
  }
})();
