// Mengirim ringkasan audit yang SUDAH dirangkai dan ditinjau, tanpa memanggil
// model lagi. Dipakai setelah audit-lokal.mjs berjalan dalam mode tinjau:
// menjalankan ulang seluruh audit hanya untuk mengirim berarti membuang belasan
// menit waktu model dan bisa menghasilkan isi yang berbeda dari yang ditinjau.
//
// Pakai: node kirim-audit.mjs [tanggal] [--paksa]
import fs from 'node:fs';
import path from 'node:path';
import { BRIDGE, TUJUAN_SAH, GRUP_YSPI, dateWIB } from './lokal-lengkap.mjs';

const tanggal = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || dateWIB(new Date());
const berkas = path.join(BRIDGE, 'pengingat', `audit-grup-${tanggal}.md`);
if (!fs.existsSync(berkas)) throw Error(`Ringkasan audit ${tanggal} belum ada; jalankan audit-lokal.mjs dulu.`);
const teks = fs.readFileSync(berkas, 'utf8').trim();
if (!teks) throw Error('Ringkasan audit kosong.');
if (/#(?:log|close|reopen)/i.test(teks)) throw Error('Ringkasan memuat tag perintah; agen Mac akan membacanya sebagai perintah. Tidak dikirim.');
if (!TUJUAN_SAH.has(GRUP_YSPI)) throw Error('Grup tidak ada dalam daftar tujuan yang diotorisasi.');

const status = fs.readFileSync(path.join(BRIDGE, 'status.md'), 'utf8');
if (!/keadaan: \*\*tersambung\*\*/.test(status)) throw Error('WhatsApp belum tersambung; tidak diantrekan.');

const kunci = `audit-grup-${tanggal}`;
const sudah = [path.join(BRIDGE, 'antrian'), path.join(BRIDGE, 'outbox')].flatMap((d) => fs.readdirSync(d)).some((f) => f.startsWith(kunci) && f.endsWith('.json'));
if (sudah && !process.argv.includes('--paksa')) { console.log(`Audit ${tanggal} sudah pernah diantrekan; tidak mengirim ganda.`); process.exit(0); }
const nama = sudah ? `${kunci}-${Date.now()}` : kunci;
fs.writeFileSync(path.join(BRIDGE, 'antrian', nama + '.json'), JSON.stringify({ to: GRUP_YSPI, text: teks }, null, 2), { flag: 'wx' });
console.log(`DIANTRIKAN ${nama}.json → ${TUJUAN_SAH.get(GRUP_YSPI)} (${teks.length} huruf); menunggu bukti outbox.`);
