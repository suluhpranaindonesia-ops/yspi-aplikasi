/**
 * Salin Google Calendar YSPI ke berkas JSON di Google Drive (cara 2).
 *
 * Berkas hasilnya (kalender-yspi.json) tersinkron ke PC lewat Google Drive,
 * lalu dibaca kewajiban.mjs tiap pagi. Skrip ini HANYA MEMBACA kalender.
 *
 * Pasang sekali:
 *   1. Buka https://script.google.com dengan akun yang bisa melihat kalender YSPI
 *      → Proyek baru → tempel seluruh isi berkas ini → Simpan.
 *   2. Pilih fungsi `pasang` → Jalankan → izinkan akses Kalender & Drive.
 *      `pasang` langsung menyalin sekali, lalu memasang jadwal tiap 3 jam.
 *   3. Lihat Log eksekusi: ada baris "Tersimpan: N acara → ..." kalau berhasil.
 */

// Nama kalender (cocok sebagian, tidak peka huruf besar/kecil) — atau isi
// CALENDAR_ID langsung (Setelan kalender → "ID Kalender") agar tidak salah pilih.
const NAMA_KALENDER = 'YSPI';
const CALENDAR_ID = '';

// Folder tujuan di Drive. Kosong = "SPI-Kerja/kewajiban/kalender" di My Drive
// akun yang menjalankan skrip (dibuat bila belum ada). Kalau akun ini BUKAN
// akun yang tersinkron ke PC, isi FOLDER_ID dengan ID folder bersama.
const FOLDER_ID = '';
const JALUR_FOLDER = ['SPI-Kerja', 'kewajiban', 'kalender'];

const MULAI = new Date('2026-09-01T00:00:00+07:00');
const SAMPAI = new Date('2028-06-01T00:00:00+07:00');
const TZ = 'Asia/Jakarta';
const NAMA_BERKAS = 'kalender-yspi.json';

function salinKalender() {
  const kal = ambilKalender_();
  const acara = kal.getEvents(MULAI, SAMPAI).map(e => {
    const allDay = e.isAllDayEvent();
    let mulai, selesai, waktu;
    if (allDay) {
      const s = e.getAllDayStartDate(), x = e.getAllDayEndDate(); // akhir eksklusif
      mulai = tgl_(s);
      selesai = tgl_(new Date(Math.max(s.getTime(), x.getTime() - 86400000)));
      waktu = 'Sepanjang hari';
    } else {
      mulai = tgl_(e.getStartTime());
      selesai = tgl_(e.getEndTime());
      waktu = Utilities.formatDate(e.getStartTime(), TZ, 'HH:mm') + '–' + Utilities.formatDate(e.getEndTime(), TZ, 'HH:mm');
    }
    return {
      uid: e.getId(),               // iCalUID, sama dengan kolom "UID Google Calendar"
      start: mulai, end: selesai, waktu: waktu,
      judul: (e.getTitle() || '(tanpa judul)').trim(),
      lokasi: (e.getLocation() || '').trim() || null,
      berulang: e.isRecurringEvent(),
    };
  });
  acara.sort((a, b) => (a.start + a.judul).localeCompare(b.start + b.judul));
  const isi = JSON.stringify({
    sumber: 'apps-script', kalender: kal.getName(), dibuat: new Date().toISOString(),
    jendela: [tgl_(MULAI), tgl_(SAMPAI)], acara: acara,
  }, null, 1);
  const folder = ambilFolder_();
  const ada = folder.getFilesByName(NAMA_BERKAS);
  if (ada.hasNext()) ada.next().setContent(isi);
  else folder.createFile(NAMA_BERKAS, isi, MimeType.PLAIN_TEXT);
  console.log('Tersimpan: ' + acara.length + ' acara dari "' + kal.getName() + '" → ' + folder.getName() + '/' + NAMA_BERKAS);
}

function pasang() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'salinKalender')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('salinKalender').timeBased().everyHours(3).create();
  salinKalender();
}

function ambilKalender_() {
  if (CALENDAR_ID) {
    const k = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!k) throw new Error('CALENDAR_ID tidak ditemukan atau akun ini tidak punya akses: ' + CALENDAR_ID);
    return k;
  }
  const cocok = CalendarApp.getAllCalendars().filter(k => k.getName().toLowerCase().indexOf(NAMA_KALENDER.toLowerCase()) >= 0);
  if (cocok.length !== 1) {
    throw new Error('Nama "' + NAMA_KALENDER + '" cocok dengan ' + cocok.length + ' kalender (' +
      cocok.map(k => k.getName()).join(', ') + '). Isi CALENDAR_ID supaya pasti.');
  }
  return cocok[0];
}

function ambilFolder_() {
  if (FOLDER_ID) return DriveApp.getFolderById(FOLDER_ID);
  let f = DriveApp.getRootFolder();
  JALUR_FOLDER.forEach(nama => {
    const it = f.getFoldersByName(nama);
    f = it.hasNext() ? it.next() : f.createFolder(nama);
  });
  return f;
}

function tgl_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
