/* ============================================================
   Cetak / Simpan PDF biodata satu guru.

   Dokumennya disusun tersendiri di dalam iframe tersembunyi, bukan
   dengan menyembunyikan bagian-bagian dashboard lewat CSS. Dengan cara
   ini tidak ada sisa tampilan dashboard yang bisa ikut tercetak, dan
   tata letaknya bebas dirancang untuk kertas A4.

   Susunan kolomnya dijaga sama dengan blok detail pada js/admin.js dan
   lembar biodata pada js/export-excel.js. Bila satu diubah, ubah juga
   yang lain.
   ============================================================ */

const aman = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const teks = v => (v === null || v === undefined || String(v).trim() === '') ? '—' : String(v);

const barisBaru = v => aman(teks(v)).replace(/\n/g, '<br>');

function tanggalPanjang(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('id-ID', { dateStyle: 'long' });
}

function waktuKirim(v) {
  if (!v) return '—';
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
}

const BAGIAN = [
  ['Data Pribadi', [
    ['Nama Lengkap',          g => g.nama],
    ['Jenis Kelamin',         g => g.jenis_kelamin],
    ['Tempat, Tanggal Lahir', g => `${teks(g.tempat_lahir)}, ${tanggalPanjang(g.tanggal_lahir)}`],
    ['Alamat Rumah / Surat',  g => g.alamat, true],
    ['RT / RW',               g => `${teks(g.rt)} / ${teks(g.rw)}`],
    ['Dusun',                 g => g.dusun],
    ['Desa / Kelurahan',      g => g.desa],
    ['Kecamatan',             g => g.kecamatan],
    ['Kabupaten / Kota',      g => g.kabupaten],
    ['Provinsi',              g => g.provinsi],
    ['Telepon Rumah',         g => g.telepon_rumah],
    ['Telepon Sekolah',       g => g.telepon_sekolah],
    ['HP / WhatsApp',         g => g.telepon_hp],
    ['Kontak Lainnya',        g => g.telepon_lainnya],
    ['Golongan Darah',        g => g.gol_darah]
  ]],
  ['Pendidikan', [
    ['Pendidikan Terakhir',   g => g.pendidikan],
    ['Jurusan',               g => g.jurusan],
    ['Tahun Kelulusan',       g => g.tahun_lulus],
    ['Universitas / Sekolah', g => g.universitas],
    ['Alamat Universitas / Sekolah', g => g.alamat_universitas, 'lebar']
  ]],
  ['Gereja', [
    ['Nama Gereja',   g => g.gereja],
    ['Alamat Gereja', g => g.alamat_gereja, 'lebar']
  ]],
  ['Keluarga & Pekerjaan', [
    ['Status Pernikahan',      g => g.status_nikah],
    ['Nama Suami / Istri',     g => g.pasangan],
    ['TTL Suami / Istri',      g => g.ttl_pasangan],
    ['Nama Anak',              g => g.anak, true],
    ['Gaji / Honor dari Mengajar PAK per Bulan', g => g.gaji_pak],
    ['Pekerjaan Sambilan',     g => g.pekerjaan_sambilan],
    ['Jabatan di Desa / Kampung', g => g.jabatan_desa]
  ]],
  ['Rekening Bank', [
    ['Nomor Rekening',         g => g.no_rekening],
    ['Nama Bank',              g => g.nama_bank],
    ['Cabang Bank',            g => g.cabang_bank],
    ['Email Rekening',         g => g.email_rekening]
  ]]
];

const GAYA = `
  @page { size: A4 portrait; margin: 12mm 12mm 13mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    color: #1f1b1c; font-size: 9.4pt; line-height: 1.32; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .lembar { break-after: page; }
  .lembar:last-child { break-after: auto; }

  .kop { display: flex; align-items: center; gap: 12px; }
  .kop img { height: 36px; width: auto; }
  .kop .kanan { margin-left: auto; text-align: right; }
  .kop .kanan .besar { font-size: 13.5pt; font-weight: 800; color: #8f1219; letter-spacing: -.3px; }
  .kop .kanan .kecil { font-size: 7.6pt; color: #6d6467; }
  .pita { height: 2.5px; background: linear-gradient(90deg,#8f1219,#c4202a 55%,#e04a4a); margin: 5px 0 9px; }

  .identitas { display: flex; gap: 13px; align-items: flex-start; margin-bottom: 9px; }
  .identitas .foto, .identitas .kosong {
    width: 27mm; height: 35mm; flex: none; border-radius: 4px; background: #fdf1f1;
  }
  .identitas .foto { object-fit: cover; border: 1px solid #e8dedf; }
  .identitas .kosong {
    border: 1px dashed #dcc7c8; display: flex; align-items: center; justify-content: center;
    color: #a8969a; font-size: 7.4pt; text-align: center;
  }
  .identitas h1 { margin: 0 0 1px; font-size: 16pt; color: #8f1219; letter-spacing: -.4px; line-height: 1.1; }
  .identitas .sub { color: #6d6467; font-size: 8.6pt; margin-bottom: 7px; }
  .sorot { display: flex; flex-wrap: wrap; gap: 5px; }
  .sorot span {
    background: #fdf1f1; color: #8f1219; border: 1px solid #f3dcdd;
    border-radius: 20px; padding: 1.5px 9px; font-size: 8pt; font-weight: 600;
  }

  .bagian { break-inside: avoid; margin-bottom: 7px; }
  .bagian > h2 {
    margin: 0 0 5px; font-size: 8.4pt; font-weight: 700; color: #fff; background: #c4202a;
    padding: 3px 8px; border-radius: 3px; letter-spacing: .05em; text-transform: uppercase;
  }
  .kisi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 14px; }
  .item { padding: 1.5px 0; border-bottom: 1px solid #f4eef0; break-inside: avoid; }
  .item.penuh { grid-column: 1 / -1; }
  .item.lebar { grid-column: span 2; }
  .item .k { font-size: 6.9pt; color: #857c7f; text-transform: uppercase; letter-spacing: .03em; line-height: 1.25; }
  .item .v { font-size: 9.4pt; font-weight: 500; line-height: 1.25; }

  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #ecdfe1; padding: 2.5px 5px; text-align: left; font-size: 8pt; vertical-align: top; }
  th { background: #fdf1f1; color: #8f1219; font-weight: 700; }
  tbody tr:nth-child(even) td { background: #fcfafa; }
  tfoot td { background: #fdf1f1; font-weight: 700; color: #8f1219; }
  td.angka, th.angka { text-align: center; }

  .kaki {
    margin-top: 8px; padding-top: 5px; border-top: 1px solid #ecdfe1;
    display: flex; justify-content: space-between; gap: 12px;
    font-size: 7.2pt; color: #857c7f;
  }
  .kaki b { color: #8f1219; }
`;

function susunLembar(guru, foto, urlLogo) {
  const sorot = [
    guru.jenis_kelamin,
    guru.telepon_hp ? 'HP ' + guru.telepon_hp : null,
    guru.gereja,
    guru.sekolah.length ? `${guru.sekolah.length} kelas dilayani` : null
  ].filter(Boolean).map(t => `<span>${aman(t)}</span>`).join('');

  const isiBagian = BAGIAN.map(([judul, kolom]) => `
    <section class="bagian">
      <h2>${aman(judul)}</h2>
      <div class="kisi">
        ${kolom.map(([label, ambil, penuh]) => `
          <div class="item${penuh === true ? ' penuh' : penuh === 'lebar' ? ' lebar' : ''}">
            <div class="k">${aman(label)}</div>
            <div class="v">${barisBaru(ambil(guru))}</div>
          </div>`).join('')}
      </div>
    </section>`).join('');

  const totalSiswa = guru.sekolah.reduce((t, s) => t + (Number(s.jumlah_siswa) || 0), 0);
  const tabelSekolah = guru.sekolah.length ? `
    <table>
      <thead>
        <tr>
          <th class="angka">No</th><th>Nama Sekolah</th><th>Alamat Sekolah</th>
          <th class="angka">Kelas</th><th class="angka">Siswa</th>
          <th>Ruang / Tempat</th><th>Hari</th><th>Jam</th>
        </tr>
      </thead>
      <tbody>
        ${guru.sekolah.map((s, i) => `
          <tr>
            <td class="angka">${i + 1}</td>
            <td>${aman(teks(s.nama_sekolah))}</td>
            <td>${aman(teks(s.alamat_sekolah))}</td>
            <td class="angka">${aman(teks(s.kelas))}</td>
            <td class="angka">${aman(teks(s.jumlah_siswa))}</td>
            <td>${aman(teks(s.ruangan))}</td>
            <td>${aman(teks(s.hari_mengajar))}</td>
            <td>${aman(teks(s.jam_mengajar))}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Jumlah</td>
          <td class="angka">${guru.sekolah.length}</td>
          <td class="angka">${totalSiswa}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>` : '<div class="item"><div class="v">Belum ada data sekolah.</div></div>';

  const kotakFoto = foto
    ? `<img class="foto" src="${aman(foto)}" alt="Foto ${aman(guru.nama)}">`
    : '<div class="kosong">Tanpa foto</div>';

  return `<article class="lembar">
    <header class="kop">
      <img src="${aman(urlLogo)}" alt="Yayasan Suluh Prana Indonesia">
      <div class="kanan">
        <div class="besar">BIODATA GURU</div>
        <div class="kecil">Sistem Pendataan Guru</div>
      </div>
    </header>
    <div class="pita"></div>

    <div class="identitas">
      ${kotakFoto}
      <div>
        <h1>${aman(teks(guru.nama))}</h1>
        <div class="sub">${aman(teks(guru.alamat))}</div>
        <div class="sorot">${sorot}</div>
      </div>
    </div>

    ${isiBagian}

    <section class="bagian">
      <h2>Sekolah yang Dilayani Saat Ini</h2>
      ${tabelSekolah}
    </section>

    <footer class="kaki">
      <div>Yayasan Suluh Prana Indonesia · <b>No. bukti ${aman(String(guru.id).slice(0, 8).toUpperCase())}</b></div>
      <div>Data dikirim ${aman(waktuKirim(guru.created_at))}</div>
    </footer>
  </article>`;
}

function susunDokumen(daftar, urlLogo, judul) {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>${aman(judul)}</title>
<style>${GAYA}</style>
</head><body>
${daftar.map(({ guru, foto }) => susunLembar(guru, foto, urlLogo)).join('\n')}
</body></html>`;
}

/** Menunggu seluruh gambar termuat supaya tidak tercetak kosong. */
function tungguGambar(doc, batasMs = 15000) {
  const gambar = [...doc.images];
  if (!gambar.length) return Promise.resolve();
  return Promise.race([
    Promise.all(gambar.map(g => g.complete
      ? Promise.resolve()
      : new Promise(selesai => { g.onload = selesai; g.onerror = selesai; }))),
    new Promise(selesai => setTimeout(selesai, batasMs))
  ]);
}

/** Menyusun dokumen di iframe tersembunyi lalu memanggil dialog cetak. */
async function cetakDokumen(daftar, judul) {
  const bingkai = document.createElement('iframe');
  bingkai.setAttribute('aria-hidden', 'true');
  bingkai.setAttribute('title', 'Biodata untuk dicetak');
  /* Diletakkan di luar layar dengan ukuran nyata — iframe berukuran nol
     tidak dicetak oleh sebagian browser. */
  bingkai.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;';
  document.body.appendChild(bingkai);

  const bersihkan = () => { if (bingkai.parentNode) bingkai.remove(); };

  try {
    const urlLogo = new URL('assets/logo-yspi.png', document.baseURI).href;
    const doc = bingkai.contentDocument;
    doc.open();
    doc.write(susunDokumen(daftar, urlLogo, judul));
    doc.close();

    await tungguGambar(doc);

    const jendela = bingkai.contentWindow;
    jendela.onafterprint = bersihkan;
    jendela.focus();
    jendela.print();
    setTimeout(bersihkan, 120000);   // jaring pengaman bila onafterprint tak dipanggil
  } catch (err) {
    bersihkan();
    throw err;
  }
}

/**
 * Cetak biodata satu guru.
 * @param guru  objek guru (beserta array sekolah)
 * @param foto  data URL atau URL foto, boleh null
 */
export async function cetakBiodata(guru, foto) {
  return cetakDokumen([{ guru, foto }], `Biodata ${guru.nama || 'Guru'}`);
}

/**
 * Cetak biodata banyak guru sekaligus — satu guru satu halaman.
 * @param daftarGuru  array guru (sudah tersaring & terurut sesuai layar)
 * @param ambilFoto   async (guru) => data URL / URL / null
 * @param lapor       (teks) => void, untuk menampilkan kemajuan
 */
export async function cetakSemuaBiodata({ daftarGuru, ambilFoto, lapor = () => {} }) {
  if (!daftarGuru.length) throw new Error('Tidak ada data guru untuk dicetak.');

  const siap = [];
  for (let i = 0; i < daftarGuru.length; i++) {
    let foto = null;
    try {
      foto = await ambilFoto(daftarGuru[i]);
    } catch (err) {
      console.warn('Foto gagal diambil untuk', daftarGuru[i].nama, err);
    }
    siap.push({ guru: daftarGuru[i], foto });
    lapor(`Menyiapkan biodata ${i + 1} dari ${daftarGuru.length}…`);
  }

  lapor('Menyusun halaman cetak…');
  await cetakDokumen(siap, `Biodata Guru YSPI (${siap.length} orang)`);
  return { jumlah: siap.length, berfoto: siap.filter(x => x.foto).length };
}
