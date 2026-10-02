// Menunjukkan mode pengingat untuk beberapa hari ke depan.
// Tidak menjalankan model, tidak mengirim apa pun - cuma menghitung.

import { execFileSync } from 'node:child_process';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const jumlah = Number(process.argv[2] || 7);

function modeUntuk(d, sesi) {
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(d);
  const g = (t) => bagian.find((p) => p.type === t).value;
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[g('weekday')];
  const hariKe = Math.floor(Date.UTC(+g('year'), +g('month') - 1, +g('day')) / 86400000);
  if (sesi === 'sore') return 'sore';
  if (dow === 6) return 'syukur';
  if (dow === 7) return 'istirahat';
  // Senin-Jumat selalu per orang; selang-seling dengan per topik dihapus 18 Sep 2026.
  return 'perorang';
}

const JUDUL = {
  perorang: 'Status Follow-Up per ORANG      · dikirim 10.00',
  pertopik: 'Status Follow-Up per TOPIK      · dikirim 10.00',
  syukur: 'Perayaan & Syukur (tanpa daftar)  · dikirim 10.00',
  istirahat: 'Hari Istirahat (doa + 1 topik)  · dikirim 10.00',
  sore: 'disusun, TIDAK dikirim',
};

console.log('Tanggal      Hari      Pagi 10.00                                        Sore 17.05');
console.log('-'.repeat(96));
for (let i = 0; i < jumlah; i++) {
  const d = new Date(Date.now() + i * 86400000);
  const tgl = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(d);
  const namaHari = HARI[new Date(tgl + 'T12:00:00+07:00').getDay()];
  const pagi = modeUntuk(d, 'pagi');
  console.log(`${tgl}   ${namaHari.padEnd(8)}  ${JUDUL[pagi].padEnd(48)}  ${JUDUL.sore}`);
}
