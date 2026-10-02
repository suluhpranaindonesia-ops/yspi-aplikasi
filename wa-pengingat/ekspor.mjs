// Salin kode pengingat wa-konsol ke folder ini dalam bentuk bersih, untuk GitHub.
// wa-konsol/pengingat sendiri TIDAK diubah (bot sedang berjalan; aturannya di
// C:\Users\suluh\wa-konsol\AGENTS.md). Jalankan ulang sebelum setiap push:
//   node wa-pengingat/ekspor.mjs
//
// Yang diganti placeholder: nomor pribadi pengurus dan ID grup YSPI. Nilai
// aslinya dibaca dari lokal-lengkap.mjs saat skrip jalan, jadi tidak pernah
// tertulis di sini. Nomor agent (WA yayasan) sengaja dibiarkan.
// Yang tidak disalin: data tracker, contoh pesan, log, keluaran, state, cadangan.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUMBER = 'C:/Users/suluh/wa-konsol/pengingat';
const TUJUAN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kode');
const TIDAK = [/\.test\.mjs$/, /\.sebelum-/, /\.bak/]; // tes memuat contoh data tracker

const inti = fs.readFileSync(path.join(SUMBER, 'lokal-lengkap.mjs'), 'utf8');
const ambil = (nama) => inti.match(new RegExp(`export const ${nama} = '([^']+)'`))?.[1];
const daniel = ambil('DANIEL'), grup = ambil('GRUP_YSPI');
if (!daniel || !grup) throw Error('DANIEL/GRUP_YSPI tidak ditemukan di lokal-lengkap.mjs; ekspor dibatalkan.');
const hp = daniel.split('@')[0];                        // 62xxx
const ganti = [
  [daniel, '<nomor-pengurus>@s.whatsapp.net'],
  [grup, '<id-grup-yspi>@g.us'],
  [hp, '<nomor-pengurus>'],
  ['0' + hp.slice(2), '<nomor-pengurus>'],
  [grup.split('@')[0], '<id-grup-yspi>'],
];

const pilih = fs.readdirSync(SUMBER, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.(mjs|py|cmd|vbs)$|^MEKANISME\.md$|^ayat-terverifikasi\.json$/.test(e.name))
  .map((e) => e.name).filter((n) => !TIDAK.some((r) => r.test(n))).sort();

fs.rmSync(TUJUAN, { recursive: true, force: true });
fs.mkdirSync(TUJUAN, { recursive: true });
for (const n of pilih) {
  let t = fs.readFileSync(path.join(SUMBER, n), 'utf8');
  for (const [a, b] of ganti) t = t.split(a).join(b);
  fs.writeFileSync(path.join(TUJUAN, n), t);
}
const sisa = pilih.filter((n) => ganti.some(([a]) => fs.readFileSync(path.join(TUJUAN, n), 'utf8').includes(a)));
if (sisa.length) throw Error('Masih ada nomor/ID asli di: ' + sisa.join(', '));
console.log(`Disalin ${pilih.length} berkas ke ${TUJUAN}:\n  ` + pilih.join('\n  '));
