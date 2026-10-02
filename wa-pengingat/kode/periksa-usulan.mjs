// Memeriksa USULAN audit dari model lokal. Tidak menulis ke tracker.
//
// Penjaga utamanya: setiap usulan wajib menunjuk satu pesan grup sebagai bukti,
// dan pesan itu dicocokkan ke berkas sumber yang disiapkan siapkan-audit.mjs.
// Model tidak bisa mengarang kutipan, karena kutipannya tidak pernah ia tulis —
// ia hanya menunjuk nomor, dan nomor itu diterjemahkan program.
//
// Pakai: node periksa-usulan.mjs [tanggal]
import fs from 'node:fs';
import path from 'node:path';
import { BRIDGE, readTracker, dateWIB, clean } from './lokal-lengkap.mjs';
import { periksaUsulan } from './audit-penjaga.mjs';

const tanggal=process.argv[2]||dateWIB(new Date());
const dir=path.join(BRIDGE,'pengingat');
const berkasUsulan=path.join(dir,`usulan-${tanggal}.json`);
const berkasSumber=path.join(dir,`audit-${tanggal}.sumber.json`);
if(!fs.existsSync(berkasUsulan))throw Error(`Model belum menulis usulan-${tanggal}.json.`);
if(!fs.existsSync(berkasSumber))throw Error(`Sumber audit-${tanggal}.sumber.json tidak ada; jalankan siapkan-audit.mjs dulu.`);

const usulan=JSON.parse(fs.readFileSync(berkasUsulan,'utf8'));
const sumber=JSON.parse(fs.readFileSync(berkasSumber,'utf8'));
const {items}=readTracker();
const pesanPerKode=new Map(sumber.pesan.map(p=>[p.kode,p]));
const terbuka=new Set(sumber.terbuka);

// Aturannya satu sumber dengan jalur alat (audit-lokal.mjs).
const masalah=periksaUsulan(usulan,{pesanPerKode,terbuka,items});
if(masalah.length){
  console.error(`USULAN DITOLAK — ${masalah.length} masalah:`);
  for(const m of masalah)console.error(`  • ${m}`);
  process.exit(1);
}

const baris=(b,perluId)=>{
  const p=pesanPerKode.get(clean(b.bukti));
  const jam=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(p.ts));
  const judul=perluId?`${b.id} — ${clean(items.find(i=>i.id===b.id).judul).slice(0,70)}`:`${clean(b.judul)} (PIC ${clean(b.pic)||'belum ada'}${clean(b.target)?`, tenggat ${clean(b.target)}`:''})`;
  return `  • ${judul}\n      alasan: ${clean(b.alasan)}\n      bukti [${b.bukti}] ${jam} ${p.pengirim}: ${clean(p.teks).slice(0,150)}`;
};

console.log(`USULAN LOLOS PEMERIKSAAN — ${tanggal}\n`);
for(const [bagian,judul,perluId] of [['logBaru','Layak dicatat sebagai item baru (#log)',false],
                                     ['usulTutup','Layak diusulkan tutup (#close)',true],
                                     ['seharusnyaTutup','Seharusnya sudah ditutup tapi masih terbuka',true]]){
  const daftar=usulan[bagian]||[];
  console.log(`## ${judul} — ${daftar.length}`);
  console.log(daftar.length?daftar.map(b=>baris(b,perluId)).join('\n'):'  (tidak ada)');
  console.log('');
}
console.log('Tidak ada sel Excel yang disentuh: tahap ini hanya usulan.');
