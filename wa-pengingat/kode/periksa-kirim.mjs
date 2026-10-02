// Memeriksa tulisan model lokal DARI HARNESS, lalu mengantrekannya.
//
// Model di harness menulis pesan-<tanggal>-<sesi>.json; skrip ini menjalankan
// penjaga yang sama dengan jalur langsung (periksaAkhirPekan), merangkai
// teksnya, lalu menitipkannya ke WA-Lokal/antrian/. Model tidak menulis ke
// antrian sendiri: penjaga harus berada di antara menulis dan mengirim.
//
// Pakai: node periksa-kirim.mjs [pagi] [--uji]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BRIDGE, TUJUAN_SAH, readTracker, recentEntries, wikiSource, verifiedVerse,
         periksaAkhirPekan, rakitAkhirPekan, hashTracker,
         modeFor, dateWIB, dateLong, clean } from './lokal-lengkap.mjs';

const sesi=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'pagi';
const uji=process.argv.includes('--uji');
const now=new Date(), tanggal=dateWIB(now), mode=modeFor(now,sesi);
const isSabtu=mode==='syukur';
if(!['syukur','istirahat'].includes(mode))throw Error(`Hari ini bukan akhir pekan (mode ${mode}).`);

const catat=pesan=>{
  const waktu=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
  const baris=`${tanggal} ${waktu}  [harness] ${pesan}`;
  console.log(baris);
  try{fs.appendFileSync('C:/Users/suluh/.dsh/pengingat.log',baris+'\n');}catch{}
};

const keluar=path.join(BRIDGE,'pengingat');
const berkas=path.join(keluar,`pesan-${tanggal}-${sesi}.json`);
if(!fs.existsSync(berkas))throw Error(`Model belum menulis ${path.basename(berkas)}; tidak ada yang diperiksa.`);
const v=JSON.parse(fs.readFileSync(berkas,'utf8'));

const snapshot=readTracker();
const wiki=wikiSource(mode,now);
const db=new DatabaseSync('C:/Users/suluh/wa-konsol/data/wa.db',{readOnly:true});
let contoh;
try{contoh=db.prepare('SELECT id,ts,teks FROM pesan WHERE jid=? AND teks LIKE ? ORDER BY ts DESC LIMIT 1').get('<id-grup-yspi>@g.us',isSabtu?'🙏 Syukur%':'🌿 Hari Istirahat%');}
finally{db.close();}
const contohHariIni=contoh&&dateWIB(new Date(contoh.ts))===tanggal;
const data={tanggal:dateLong(now),tracker:recentEntries(snapshot.items,now),wiki,ayat:isSabtu?verifiedVerse():null};

// perintah kosong: penjaga penyalin-perintah tidak berlaku di jalur harness,
// karena perintahnya ada di berkas bahan, bukan di prompt sistem.
periksaAkhirPekan(v,{data,perintah:'',isSaturday:isSabtu,example:contoh,exampleIsToday:contohHariIni,now,log:catat});
const teks=rakitAkhirPekan(v,isSabtu);
if(hashTracker()!==snapshot.sha256)throw Error('Tracker berubah saat pemeriksaan; tidak dikirim.');

fs.writeFileSync(path.join(keluar,`pesan-${tanggal}-${sesi}.md`),teks);
catat(`Tulisan model lolos ${isSabtu?v.capaian.length+' butir, ':''}${teks.length} huruf. Hash Excel tetap sama.`);

if(uji){catat('Mode uji: tidak diantrikan.');process.exit(0);}
const status=fs.readFileSync(path.join(BRIDGE,'status.md'),'utf8');
if(!/keadaan: \*\*tersambung\*\*/.test(status))throw Error('WhatsApp belum tersambung; hasil disimpan, belum diantrikan.');
const kunci=`pengingat-${tanggal}-${sesi}`;
const sudah=[path.join(BRIDGE,'antrian'),path.join(BRIDGE,'outbox')].flatMap(d=>fs.readdirSync(d)).some(f=>f.startsWith(kunci));
if(sudah&&!process.argv.includes('--paksa')){catat('Sudah ada kiriman/antrian hari ini; tidak mengirim duplikat.');process.exit(0);}
const nama=sudah?`${kunci}-${Date.now()}`:kunci;
const tujuan=JSON.parse(fs.readFileSync(path.join(BRIDGE,'pengingat.json'),'utf8')).tujuan;
if(!TUJUAN_SAH.has(tujuan))throw Error('Tujuan tidak diotorisasi: '+tujuan);
fs.writeFileSync(path.join(BRIDGE,'antrian',nama+'.json'),JSON.stringify({to:tujuan,text:teks},null,2),{flag:'wx'});
catat(`DIANTRIKAN ${nama}.json → ${TUJUAN_SAH.get(tujuan)} ${tujuan}; menunggu bukti outbox, belum mengklaim terkirim.`);
