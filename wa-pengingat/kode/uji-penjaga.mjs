// Uji cepat penjaga pesan akhir pekan; tanpa model, tanpa jaringan.
// Jalankan: node uji-penjaga.mjs
// Uji ini lahir karena sebuah tambalan pernah menulis garis-miring-b di dalam
// template literal sehingga menjadi karakter backspace: penjaganya tampak ada
// di berkas tetapi tidak pernah cocok. Setiap penjaga baru wajib punya kasus.
import { periksaAkhirPekan, rakitAkhirPekan } from './lokal-lengkap.mjs';

const TANGGAL='Sabtu, 12 September 2026';
const AYAT={kutipan:'Layanilah seorang akan yang lain, sesuai dengan karunia yang telah diperoleh tiap-tiap orang sebagai pengurus yang baik dari kasih karunia Allah.',rujukan:'1 Petrus 4:10'};
const data={tanggal:TANGGAL,ayat:AYAT,wiki:{judul:'Tiga Jenis Anugerah — Anugerah Umum'},tracker:[
  {id:'F01',status:'Closed',judul:'a'},
  {id:'F90',status:'Kandidat Close',judul:'b'},
  {id:'F99',status:'Outstanding',judul:'c'},
  {id:'F94',status:'Closed',judul:'d',ditutup:'Auto-close (2026-09-09) — 5 hari tanpa konfirmasi manusia',catatan:[]},
]};
const perintah='Tulis SELURUH pesan YSPI. Tidak ada daftar outstanding, tag, deadline, atau penagihan tugas.';
const dasar={data,perintah,isSaturday:true,example:null,exampleIsToday:false,now:new Date('2026-09-12T03:00:00Z')};

const isi=(ubah={})=>({
  judul:`🙏 Syukur Mingguan YSPI — ${TANGGAL}`,
  pembuka:'Tim terkasih, mari bersyukur atas pekan ini.',
  capaian:[
    {sumber:'F01',teks:'SK PEKA ditutup Andrian pekan ini.'},
    {sumber:'F90',teks:'RB GMK Baradatu sedang disiapkan sebagai mitra.'},
    {sumber:'F99',teks:'Jadwal rapat bulanan dibahas bersama pengurus.'},
    {sumber:'F01',teks:'Data hamba Tuhan dirapikan untuk penyaluran dana.'},
  ],
  refleksi:'Anugerah umum diberikan kepada semua orang. Kita menerimanya sebagai panggilan, bukan sebagai upah. Pekan ini tampak dalam hal kecil yang dikerjakan setia.',
  doa:'🙏 Terima kasih Tuhan atas pekan yang Engkau percayakan. Pakai kami sebagaimana Engkau mau. Amin.',
  ayat:`"${AYAT.kutipan}" (${AYAT.rujukan})`,
  penutup:'Selamat beristirahat, selamat menyongsong Hari Tuhan. 🌿',
  ...ubah});

let lulus=0,gagal=0;
const catat=(benar,nama,tambahan='')=>{console.log(`${benar?'OK  ':'SALAH'} ${nama}${tambahan}`);benar?lulus++:gagal++;};
const uji=(nama,ubah,harusGagal)=>{
  let pesan=null;
  try{periksaAkhirPekan(isi(ubah),{...dasar});}catch(e){pesan=e.message;}
  catat(harusGagal?!!pesan&&pesan.includes(harusGagal):!pesan,nama,pesan?` → ${pesan.slice(0,95)}`:'');
};

uji('pesan wajar diterima',{},null);
uji('judul karangan sendiri ditolak',{judul:'🙏 Syukur Mingguan YSPI — Sabtu ini'},'Judul wajib berbunyi persis');
uji('penutup karangan sendiri ditolak',{penutup:'Selamat berakhir pekan!'},'Penutup wajib berbunyi persis');
uji('ayat yang diubah ditolak',{ayat:'"Kasihilah sesamamu manusia seperti dirimu sendiri." (Matius 22:39)'},'Ayat wajib disalin persis');
uji('ayat yang hilang ditolak',{ayat:''},'Ayat wajib disalin persis');
uji('pembuka mengulang tanggal ditolak',{pembuka:`${TANGGAL} — tim terkasih, mari bersyukur.`},'mengulang tanggal');
uji('klaim selesai pada Outstanding ditolak',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'b disiapkan.'},{sumber:'F99',teks:'Form anggaran sudah selesai diisi.'},{sumber:'F01',teks:'d dirapikan.'}]},'masih Outstanding');
uji('Kandidat Close tanpa keterangan ditolak',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'RB GMK Baradatu didaftarkan sebagai mitra.'},{sumber:'F99',teks:'c dibahas.'},{sumber:'F01',teks:'d dirapikan.'}]},'masih Kandidat Close');
uji('Kandidat Close dengan keterangan diterima',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'RB GMK didaftarkan sebagai mitra, menunggu konfirmasi.'},{sumber:'F99',teks:'c dibahas.'},{sumber:'F01',teks:'d dirapikan.'}]},null);
uji('peristiwa nyata pada item tetap diterima',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'b disiapkan.'},{sumber:'F99',teks:'Rapat bulanan Rabu 9 September terlaksana.'},{sumber:'F01',teks:'d dirapikan.'}]},null);
uji('klaim selesai atas item auto-close ditolak',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'b disiapkan.'},{sumber:'F99',teks:'c dibahas.'},{sumber:'F94',teks:'Varian modul roadmap selesai dibuat.'}]},'ditutup otomatis tanpa konfirmasi');
uji('item auto-close disebut apa adanya diterima',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'b disiapkan.'},{sumber:'F99',teks:'c dibahas.'},{sumber:'F94',teks:'Varian modul roadmap tercatat ditutup otomatis tanpa konfirmasi.'}]},null);
uji('kata terdaftar pada Kandidat Close ditolak',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'RB GMK Baradatu terdaftar sebagai mitra YSPI.'},{sumber:'F99',teks:'c dibahas.'},{sumber:'F01',teks:'d dirapikan.'}]},'masih Kandidat Close');
uji('doa tanpa tanda doa ditolak',{doa:'Terima kasih Tuhan atas pekan ini. Amin.'},'wajib diawali tanda');
uji('refleksi yang melar ditolak',{refleksi:'Anugerah umum itu nyata. '.repeat(40)},'melewati batas');
uji('butir terlalu sedikit ditolak',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F99',teks:'c dibahas.'}]},'wajib 4 sampai 6 butir');
uji('butir lebih dari 20 kata ditolak',{capaian:[{sumber:'F01',teks:'a ditutup.'},{sumber:'F90',teks:'b disiapkan.'},{sumber:'F99',teks:'satu '.repeat(25)},{sumber:'F01',teks:'d dirapikan.'}]},'melebihi 20 kata');
uji('perintah yang tersalin ditolak',{pembuka:'Tidak ada daftar outstanding, tag, deadline, atau penagihan tugas.'},'menyalin perintah sistem');
uji('sumber asing ditolak',{capaian:[{sumber:'F77',teks:'x'},{sumber:'F01',teks:'y'},{sumber:'F99',teks:'z'},{sumber:'F01',teks:'w'}]},'tanpa sumber sah');
uji('kalimat terulang ditolak',{refleksi:'Kita menerima anugerah itu sebagai panggilan hidup. Kita menerima anugerah itu sebagai panggilan hidup.'},'terulang persis');

// Minggu: tanpa capaian, dengan baris sumber wiki, tanpa ayat.
const minggu={...dasar,isSaturday:false};
const isiMinggu=(ubah={})=>({...isi(),judul:`🌿 Hari Istirahat YSPI — ${TANGGAL}`,penutup:'Selamat menikmati Hari Tuhan. Sampai Senin.',
  capaian:[],sumberWiki:'📖 Dari vault SPI: Tiga Jenis Anugerah — Anugerah Umum',ayat:'',...ubah});
const ujiMinggu=(nama,ubah,harusGagal)=>{
  let pesan=null;
  try{periksaAkhirPekan(isiMinggu(ubah),{...minggu});}catch(e){pesan=e.message;}
  catat(harusGagal?!!pesan&&pesan.includes(harusGagal):!pesan,nama,pesan?` → ${pesan.slice(0,95)}`:'');
};
ujiMinggu('Minggu wajar diterima',{},null);
ujiMinggu('Minggu dengan capaian ditolak',{capaian:[{sumber:'F01',teks:'a'}]},'tidak memuat daftar capaian');
ujiMinggu('baris sumber wiki yang keliru ditolak',{sumberWiki:'📖 Dari vault SPI: Topik lain'},'sumberWiki wajib berbunyi persis');

// Perangkaian tidak menambah kata apa pun di luar tulisan model.
const bagian=isi();
const teks=rakitAkhirPekan(bagian,true);
const tulisanModel=[bagian.judul,bagian.pembuka,bagian.refleksi,bagian.doa,bagian.ayat,bagian.penutup,...bagian.capaian.map(c=>c.teks)];
const barisAsing=teks.split('\n').map(b=>b.trim()).filter(b=>b&&!tulisanModel.some(t=>t.includes(b)||b.endsWith(t)));
catat(teks.startsWith(bagian.judul)&&teks.endsWith(bagian.penutup),'rakitan memakai judul dan penutup tulisan model');
catat(barisAsing.length===0,'tidak ada baris tambahan dari program',barisAsing.length?` → ${barisAsing.join(' | ').slice(0,80)}`:'');
catat(teks.includes(AYAT.kutipan),'ayat terverifikasi ada di dalam pesan');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exitCode=gagal?1:0;
