// Gudang laporan guru di Drive: <folder>\data\laporan.json + Foto\ + rekap Excel.
//
// Satu-satunya penulis gudang ini adalah penghubung #laporan (penghubung.mjs) dan,
// sekali saja, migrasi dari Supabase. Website (keuangan-web) hanya MEMBACA.
// Tidak ada yang dihapus: laporan dan foto hanya ditambah atau diperbarui.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buatXlsx } from './xlsx-tulis.mjs';
import { kekurangan } from './aturan-laporan.mjs';

export const NAMA_XLSX = 'Rekap-Laporan-Guru-YSPI.xlsx';
export const EKST = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const SUMBER = { whatsapp: 'WhatsApp', manual: 'Website lama', test: 'Uji coba' };
const bersih = (s) => String(s || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
const wib = (t) => (t ? new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16) : '');
const tautan = (rel) => rel.split('/').map(encodeURIComponent).join('/');

export function kelengkapan(r, jumlahFoto) {
  const kurang = kekurangan(r, jumlahFoto > 0);
  return kurang.length ? 'Kurang: ' + kurang.join(', ') : 'Lengkap';
}

export function bukaGudang(folder, log = console.log) {
  const DATA = path.join(folder, 'data', 'laporan.json');
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  let g = { versi: 1, laporan: [], media: [] };
  try { g = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  // Ditulis ulang sekali saat mulai, supaya perubahan susunan sheet langsung terlihat.
  let rekapTertunda = true;

  const simpan = () => {
    fs.writeFileSync(DATA + '.tmp', JSON.stringify(g, null, 1));
    fs.renameSync(DATA + '.tmp', DATA);
    rekapTertunda = true;
    tulisRekap();
  };
  const cari = (id) => g.laporan.find((r) => r.id === id) || null;
  const mediaDari = (id) => g.media.filter((m) => m.report_id === id);

  function tulisRekap() {
    if (!rekapTertunda) return true;
    const HEADER = ['No', 'Tanggal', 'Nama Guru', 'Sekolah', 'Wilayah', 'Jumlah Sesi', 'Jumlah Siswa', 'Kegiatan Mengajar', 'Kisah Berdampak', 'Kendala & Kebutuhan', 'Dana Diterima', 'Dana Digunakan', 'Catatan Dana', 'No. HP', 'Sumber', 'Kelengkapan', 'Status Pemeriksaan', 'Status Kendala', 'Jumlah Foto', 'Folder Foto', 'Pesan Asli', 'Masuk (WIB)', 'Diperbarui (WIB)', 'ID Laporan'];
    const urutSemua = [...g.laporan].sort((a, b) => String(a.date || a.created_at).localeCompare(String(b.date || b.created_at)) || a.created_at.localeCompare(b.created_at));
    // Satu berkas, beda sheet: cerita di "Laporan", jejak belajar (#jejak) di "Jejak Belajar".
    const urut = urutSemua.filter((r) => r.jenis !== 'jejak'), urutJejak = urutSemua.filter((r) => r.jenis === 'jejak');
    const barisJejak = [['No', 'Tanggal', 'Nama Guru', 'Sekolah', 'Wilayah', 'Jumlah Siswa Ikut', 'Di Pertemuan Terakhir Siswa Diminta', 'Hasilnya / Catatan Guru', 'No. HP', 'Sumber', 'Kelengkapan', 'Status Pemeriksaan', 'Jumlah Foto', 'Folder Foto', 'Pesan Asli', 'Masuk (WIB)', 'Diperbarui (WIB)', 'ID Laporan'],
      ...urutJejak.map((r, i) => {
        const f = mediaDari(r.id);
        return [i + 1, { tanggal: r.date || '' }, r.name, r.school, r.region, r.students ?? '', r.activity, r.impact, r.phone, SUMBER[r.source] || r.source,
          kelengkapan(r, f.length), r.status_periksa || '', f.length, f.length ? { teks: 'Buka folder', tautan: tautan('Foto/' + r.folder) } : '', r.raw, wib(r.created_at), wib(r.updated_at), r.id];
      })];
    const barisLaporan = [HEADER, ...urut.map((r, i) => {
      const f = mediaDari(r.id);
      return [i + 1, { tanggal: r.date || '' }, r.name, r.school, r.region, r.sessions ?? '', r.students ?? '', r.activity, r.impact, r.challenge,
        { angka: r.funds_received, format: 'uang' }, { angka: r.funds_used, format: 'uang' }, r.funds_note, r.phone, SUMBER[r.source] || r.source,
        kelengkapan(r, f.length), r.status_periksa || '', r.status_kendala || '', f.length, f.length ? { teks: 'Buka folder', tautan: tautan('Foto/' + r.folder) } : '', r.raw, wib(r.created_at), wib(r.updated_at), r.id];
    })];
    const byId = new Map(g.laporan.map((r) => [r.id, r]));
    const barisFoto = [['No', 'Tanggal Laporan', 'Nama Guru', 'Sekolah', 'Berkas', 'Jenis', 'Diterima (WIB)', 'ID Laporan', 'Asal'],
      ...g.media.filter((m) => byId.has(m.report_id)).map((m, i) => {
        const r = byId.get(m.report_id);
        return [i + 1, { tanggal: r.date || '' }, r.name, r.school, { teks: path.posix.basename(m.file), tautan: tautan(m.file) }, m.type.startsWith('video/') ? 'Video' : 'Foto', wib(m.created_at), r.id, r.jenis === 'jejak' ? 'Jejak belajar' : 'Cerita'];
      })];
    const isi = buatXlsx([
      { judul: 'Laporan', lebar: [5, 12, 22, 26, 16, 8, 9, 50, 40, 40, 14, 14, 30, 16, 12, 28, 16, 12, 8, 13, 50, 17, 17, 38], baris: barisLaporan },
      { judul: 'Jejak Belajar', lebar: [5, 12, 22, 26, 16, 10, 50, 40, 16, 12, 28, 16, 8, 13, 50, 17, 17, 38], baris: barisJejak },
      { judul: 'Foto', lebar: [5, 13, 22, 26, 22, 8, 17, 38, 14], baris: barisFoto },
      { judul: 'Keterangan', lebar: [26, 90], baris: [
        ['Hal', 'Keterangan'],
        ['Sumber', 'Pesan WhatsApp #cerita / #laporan (teks atau voice note) ke nomor YSPI, diproses penghubung di PC kantor, masuk ke Supabase "Pelaporan Guru YSPI", lalu disalin satu arah ke folder Drive ini tiap 15 menit.'],
        ['Jejak Belajar', 'Sheet "Jejak Belajar" berisi hasil belajar siswa di rumah yang dibagikan guru lewat #jejak: apa yang diminta kepada siswa di pertemuan terakhir, beserta hasil/fotonya. Satu sumber dan satu folder Foto dengan cerita; kolom "Asal" di sheet Foto membedakannya.'],
        ['Diperbarui', wib(new Date().toISOString())],
        ['Jumlah laporan', urut.length],
        ['Jumlah jejak belajar', urutJejak.length],
        ['Jumlah foto/video', barisFoto.length - 1],
        ['Penting', 'Berkas ini DITULIS ULANG otomatis setiap datanya berubah. Ubah laporan di website Pelaporan Guru, bukan di sini. Suntingan di sini akan hilang — salin dulu bila ingin mengolah.'],
        ['Isian laporan', 'Kolom nama, sekolah, dll. disarikan model lokal (qwen3:8b) dari pesan guru. Kolom "Pesan Asli" adalah teks guru apa adanya; cocokkan bila ragu.'],
        ['Data mentah', 'data\\laporan.json (dibaca halaman Laporan Guru di dasbor YSPI).'],
      ] },
    ]);
    const berkas = path.join(folder, NAMA_XLSX), sementara = path.join(folder, '~tulis-' + NAMA_XLSX);
    try {
      fs.writeFileSync(sementara, isi);
      fs.renameSync(sementara, berkas);
      rekapTertunda = false;
      return true;
    } catch (e) {
      fs.rmSync(sementara, { force: true });
      log(e.code === 'EBUSY' || e.code === 'EPERM' ? `${NAMA_XLSX} sedang dibuka; ditulis nanti.` : 'Rekap gagal ditulis: ' + e.message);
      return false;
    }
  }

  return {
    folder,
    laporan: cari,
    semua: () => g,
    jumlahMedia: (id) => mediaDari(id).length,
    adaMedia: (id) => g.media.some((m) => m.id === id),
    tulisRekap,
    // Laporan baru; id yang sudah ada diabaikan (aman diulang).
    tambahLaporan(r) {
      if (cari(r.id)) return false;
      const kini = new Date().toISOString();
      g.laporan.push({ ...r, created_at: r.created_at || kini, updated_at: r.updated_at || kini });
      simpan();
      return true;
    },
    // Untuk sinkron dari Supabase: tambah bila belum ada, perbarui bila isinya berubah.
    // Mengembalikan 'baru' | 'ubah' | null. Folder foto yang sudah dikunci tidak berubah.
    samakan(r) {
      const lama = cari(r.id);
      if (!lama) { g.laporan.push({ ...r }); simpan(); return 'baru'; }
      const { folder, ...isiLama } = lama;
      if (JSON.stringify(isiLama) === JSON.stringify(r)) return null;
      for (const k of Object.keys(lama)) if (k !== 'folder') delete lama[k];
      Object.assign(lama, r);
      simpan();
      return 'ubah';
    },
    ubahLaporan(id, ubah) {
      const r = cari(id);
      if (!r) throw new Error('Laporan tidak ditemukan: ' + id);
      const folder = r.folder;
      Object.assign(r, ubah, { id, updated_at: new Date().toISOString() });
      if (folder) r.folder = folder; else delete r.folder;
      simpan();
    },
    // Berkas ditulis dulu, baru dicatat: kalau terputus di tengah, diulang dengan aman.
    tambahMedia({ id, report_id, type, isi, created_at, name }) {
      if (g.media.some((m) => m.id === id)) return false;
      const r = cari(report_id);
      if (!r) throw new Error('Laporan untuk lampiran tidak ditemukan: ' + report_id);
      // Nama folder ditentukan saat foto pertama tiba (biasanya nama guru sudah terisi),
      // lalu dikunci supaya perubahan isian tidak membuat folder ganda.
      r.folder ||= bersih(`${r.jenis === 'jejak' ? 'Jejak ' : ''}${r.date || r.created_at.slice(0, 10)} ${r.name || 'Tanpa nama'} - ${r.id.slice(-8)}`).slice(0, 120);
      const urut = mediaDari(report_id).length + 1;
      const file = `Foto/${r.folder}/${type.startsWith('video/') ? 'video' : 'foto'}-${String(urut).padStart(2, '0')}${EKST[type] || ''}`;
      const tujuan = path.join(folder, ...file.split('/'));
      fs.mkdirSync(path.dirname(tujuan), { recursive: true });
      fs.writeFileSync(tujuan + '.unduh', isi);
      fs.renameSync(tujuan + '.unduh', tujuan);
      g.media.push({ id, report_id, type, file, name: name || '', bytes: isi.length, sha256: createHash('sha256').update(isi).digest('hex'), created_at: created_at || new Date().toISOString() });
      simpan();
      return true;
    },
  };
}
