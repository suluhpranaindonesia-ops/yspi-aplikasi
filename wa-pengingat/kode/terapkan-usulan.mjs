// Menerapkan usulan model ke SALINAN KERJA tracker di C:, bukan ke Drive.
//
// Keputusan pengguna 14 Sep 2026: berlatih di salinan lokal dulu; berkas di
// Google Drive baru disentuh kalau hasilnya sudah terbukti aman. Tracker di
// Drive punya penulis lain — agen Mac menulisnya tiap pagi 08.08 — jadi dua
// penulis di dua mesin berisiko melahirkan salinan konflik Drive.
//
// Urutannya: usulan diperiksa ulang (periksa-usulan.mjs) -> salinan kerja
// dicadangkan -> openpyxl menulis -> hash sebelum/sesudah dilaporkan.
//
// Pakai: node terapkan-usulan.mjs [tanggal] [--terapkan]
//   tanpa --terapkan hanya memperlihatkan rencana, tidak menulis apa pun.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BRIDGE, dateWIB, clean } from './lokal-lengkap.mjs';

const DIR=path.dirname(new URL(import.meta.url).pathname.slice(1));
const KERJA='C:/Users/suluh/wa-konsol/tracker-kerja';
const BUKU=path.join(KERJA,'YSPI-Follow-Up-Tracker.xlsx');
const PYTHON='C:/Users/suluh/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';

const tanggal=process.argv.find(a=>/^\d{4}-\d{2}-\d{2}$/.test(a))||dateWIB(new Date());
const terapkan=process.argv.includes('--terapkan');

// Jalur Drive tidak boleh dituju dari sini sama sekali.
if(BUKU.toLowerCase().startsWith('g:'))throw Error('Salinan kerja tidak boleh berada di Drive.');
if(!fs.existsSync(BUKU))throw Error(`Salinan kerja tidak ada: ${BUKU}`);

// Penjaga usulan dijalankan ulang di sini; satu sumber kebenaran, bukan disalin.
try {
  execFileSync('node',[path.join(DIR,'periksa-usulan.mjs'),tanggal],{stdio:'pipe',encoding:'utf8'});
} catch(error) {
  console.error('Usulan tidak lolos pemeriksaan; tidak ada yang ditulis.\n');
  console.error(error.stdout||'');
  console.error(error.stderr||'');
  process.exit(1);
}

const usulan=JSON.parse(fs.readFileSync(path.join(BRIDGE,'pengingat',`usulan-${tanggal}.json`),'utf8'));
const sumber=JSON.parse(fs.readFileSync(path.join(BRIDGE,'pengingat',`audit-${tanggal}.sumber.json`),'utf8'));
const pesanPerKode=new Map(sumber.pesan.map(p=>[p.kode,p]));
const asal=b=>`${clean(b.alasan)} [bukti ${b.bukti}: ${clean(pesanPerKode.get(clean(b.bukti)).pengirim)}]`;

const perubahan={
  tutup:[...(usulan.usulTutup||[]),...(usulan.seharusnyaTutup||[])].map(b=>({id:b.id,catatan:asal(b)})),
  baru:(usulan.logBaru||[]).map(b=>({judul:clean(b.judul),pic:clean(b.pic),target:clean(b.target),catatan:asal(b)})),
};

console.log(`Salinan kerja : ${BUKU}`);
console.log(`Usulan        : usulan-${tanggal}.json\n`);
console.log(`Akan ditandai Kandidat Close (${perubahan.tutup.length}):`);
console.log(perubahan.tutup.length?perubahan.tutup.map(t=>`  • ${t.id} — ${t.catatan}`).join('\n'):'  (tidak ada)');
console.log(`\nAkan ditambahkan sebagai item baru (${perubahan.baru.length}):`);
console.log(perubahan.baru.length?perubahan.baru.map(t=>`  • ${t.judul} — PIC ${t.pic||'belum ada'}${t.target?`, tenggat ${t.target}`:''}`).join('\n'):'  (tidak ada)');

if(!terapkan){console.log('\nBelum ditulis. Tambahkan --terapkan untuk benar-benar menulis ke salinan kerja.');process.exit(0);}

const cap=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const cadangan=path.join(KERJA,`cadangan-${cap}.xlsx`);
fs.copyFileSync(BUKU,cadangan);
const berkasUbah=path.join(KERJA,`perubahan-${tanggal}.json`);
fs.writeFileSync(berkasUbah,JSON.stringify(perubahan,null,2));

const hasil=JSON.parse(execFileSync(PYTHON,[path.join(DIR,'tulis-tracker.py'),BUKU,berkasUbah],{encoding:'utf8',timeout:120000,windowsHide:true}));
console.log(`\nCadangan   : ${path.basename(cadangan)}`);
console.log(`sha sebelum: ${hasil.sha256_sebelum.slice(0,16)}`);
console.log(`sha sesudah: ${hasil.sha256_sesudah.slice(0,16)}  (${hasil.berubah?'berubah':'TIDAK berubah'})`);
console.log('Perubahan  :');
for(const p of hasil.perubahan)console.log(`  • ${p}`);
console.log('\nBerkas di Google Drive tidak disentuh.');
