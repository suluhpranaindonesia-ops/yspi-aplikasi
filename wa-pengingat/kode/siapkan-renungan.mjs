// Menyiapkan BAHAN renungan akhir pekan untuk model lokal DI HARNESS.
//
// Model di harness membaca berkas ini dengan alatnya sendiri, lalu menulis
// bagian-bagian pesan ke pesan-<tanggal>-<sesi>.json. Pengambilan data dari
// Excel dan SQLite tetap mekanis: itu harus persis, dan tracker hanya dibaca.
//
// Pakai: node siapkan-renungan.mjs [pagi]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BRIDGE, readTracker, recentEntries, wikiSource, verifiedVerse,
         modeFor, dateWIB, dateLong, clean } from './lokal-lengkap.mjs';

const sesi=process.argv[2]||'pagi';
const now=new Date(), tanggal=dateWIB(now);
const mode=modeFor(now,sesi);
if(!['syukur','istirahat'].includes(mode))throw Error(`Hari ini bukan akhir pekan (mode ${mode}); bahan renungan tidak disiapkan.`);
const isSabtu=mode==='syukur';

const {items,sha256}=readTracker();
const riwayat=recentEntries(items,now);
const wiki=wikiSource(mode,now);
const ayat=isSabtu?verifiedVerse():null;
const wajibJudul=`${isSabtu?'🙏 Syukur Mingguan YSPI':'🌿 Hari Istirahat YSPI'} — ${dateLong(now)}`;
const wajibPenutup=isSabtu?'Selamat beristirahat, selamat menyongsong Hari Tuhan. 🌿':'Selamat menikmati Hari Tuhan. Sampai Senin.';
const wajibSumberWiki=`📖 Dari vault SPI: ${wiki.judul}`;

const db=new DatabaseSync('C:/Users/suluh/wa-konsol/data/wa.db',{readOnly:true});
let contoh;
try{contoh=db.prepare('SELECT id,ts,teks FROM pesan WHERE jid=? AND teks LIKE ? ORDER BY ts DESC LIMIT 1').get('<id-grup-yspi>@g.us',isSabtu?'🙏 Syukur%':'🌿 Hari Istirahat%');}
finally{db.close();}
const contohHariIni=contoh&&dateWIB(new Date(contoh.ts))===tanggal;

const otomatis=i=>/auto-?close/i.test(`${i.ditutup||''} ${(i.catatan||[]).join(' ')}`);
const barisItem=i=>`| ${i.id} | ${i.status}${otomatis(i)?' (ditutup OTOMATIS, tanpa konfirmasi manusia)':''} | ${clean(i.judul).slice(0,110)} | ${clean((i.catatan||[]).join(' ')).slice(0,160)||clean(i.ditutup)} |`;

const bagian=isSabtu?`- \`judul\` — wajib berbunyi persis: ${wajibJudul}
- \`pembuka\` — sapa tim langsung, jangan mengulang tanggal
- \`capaian\` — daftar 4 sampai 6 objek {"sumber":"<ID tracker>","teks":"<satu kalimat>"}
- \`refleksi\` — 3 sampai 4 kalimat, bertolak dari Anugerah Umum di bawah, menyentuh pekan ini
- \`doa\` — 2 sampai 3 kalimat, diawali 🙏
- \`ayat\` — wajib berbunyi persis: "${ayat.kutipan}" (${ayat.rujukan})
- \`penutup\` — wajib berbunyi persis: ${wajibPenutup}`
:`- \`judul\` — wajib berbunyi persis: ${wajibJudul}
- \`pembuka\` — ajak berhenti sejenak, jangan mengulang tanggal
- \`capaian\` — kosongkan: []
- \`sumberWiki\` — wajib berbunyi persis: ${wajibSumberWiki}
- \`refleksi\` — 4 sampai 5 kalimat merangkum topik wiki, tautkan 1 sampai 2 kejadian nyata pekan ini
- \`doa\` — 2 sampai 3 kalimat, diawali 🙏
- \`penutup\` — wajib berbunyi persis: ${wajibPenutup}`;

const aturan=isSabtu?`1. Satu kalimat per butir, paling banyak 20 kata, pakai kalimatmu sendiri — jangan salin judul panjang dari tabel.
2. Item **Outstanding** hanya boleh ditulis sebagai kemajuan (mulai, sedang berjalan, disiapkan, dibahas). Jangan ditulis selesai.
3. Item **Kandidat Close** boleh ditulis selesai, asalkan kalimat itu kamu tutup dengan kata-kata persis \`(menunggu konfirmasi)\`.
4. Item **Closed** boleh ditulis selesai — KECUALI yang ditandai ditutup OTOMATIS. Penutupan otomatis setelah lima hari tanpa konfirmasi bukan bukti pekerjaannya dikerjakan; sebut apa adanya sebagai tercatat ditutup otomatis, atau pilih capaian lain.
5. Peristiwa yang benar terjadi pekan ini (rapat berlangsung, kunjungan dilakukan) boleh ditulis apa adanya meski baris trackernya masih Outstanding.
6. Tidak ada daftar outstanding, kode item, tenggat, tag, atau penagihan tugas di dalam pesan.
7. Jangan menyalin kalimat dari contoh grup; itu hanya acuan bentuk.`
:`1. Minggu tidak memuat daftar capaian sama sekali.
2. Tidak ada kode item, tenggat, tag, atau penagihan tugas.
3. Jangan menyalin kalimat dari contoh grup; itu hanya acuan bentuk.`;

const berkasJawaban=`pesan-${tanggal}-${sesi}.json`;
const teks=`# Bahan renungan ${isSabtu?'Sabtu (Syukur)':'Minggu (Hari Istirahat)'} — ${dateLong(now)}

Disiapkan otomatis ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB.
Tracker dibaca saja, tidak diubah. SHA-256 Excel: \`${sha256.slice(0,16)}…\`

## Tugas Anda

Tulis SELURUH kata pesannya sendiri, lalu simpan sebagai JSON di
\`WA-Lokal/pengingat/${berkasJawaban}\` dengan kunci berikut:

${bagian}

Setelah berkas itu ada, skrip pemeriksa akan menjalankan penjaganya dan
mengantrekan pesannya. Jangan menulis ke \`WA-Lokal/antrian/\` sendiri.

## Aturan yang akan diperiksa

${aturan}

## Item tracker yang bergerak sepekan terakhir

| ID | Status | Judul | Catatan terakhir |
|---|---|---|---|
${riwayat.map(barisItem).join('\n')}

## Bacaan wiki: ${wiki.judul}

${wiki.isi.slice(0,isSabtu?2500:3500)}
${contohHariIni?`
## Laporan grup HARI INI — boleh dipakai sebagai fakta tambahan (sumber: contohGrup)

${contoh.teks}
`:''}`;

const keluar=path.join(BRIDGE,'pengingat');
fs.mkdirSync(keluar,{recursive:true});
const berkas=path.join(keluar,`bahan-${tanggal}-${sesi}.md`);
fs.writeFileSync(berkas,teks);
console.log(`Bahan ${mode} ditulis: ${berkas} (${teks.length} huruf, ${riwayat.length} item bergerak).`);
console.log(`Model di harness menjawab ke: WA-Lokal/pengingat/${berkasJawaban}`);
