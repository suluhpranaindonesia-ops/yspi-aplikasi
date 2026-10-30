'use client';
import {useState} from 'react';
import {CalendarDays,MapPin,Users,HandHeart,ChevronLeft,ChevronRight} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

// Kegiatan Temu Kasih: data tetap (bukan dari Supabase), terpisah dari cerita guru.
// Sumber: KONTEN.md & foto di DRAFT/ops/marketing/.../18-Temu-Kasih-Guru-PAK-Cilacap-September-2026.
// Sengaja TIDAK memuat nominal dana, voucher, nama penerima dukungan, atau nomor HP.
type Kegiatan={id:string;judul:string;tanggal:string;waktu:string;tempat:string;peserta:string;tim:string;ringkasan:string;rundown:[string,string][];didengar:string[];arah:string[];foto:{n:string;ket:string}[]};
const kegiatan:Kegiatan[]=[{
 id:'cilacap-2026-09',
 judul:'Temu Kasih Guru PAK Kabupaten Cilacap',
 tanggal:'Rabu, 30 September 2026',
 waktu:'11.00–15.00 WIB',
 tempat:'GKJ Jeruk Legi, Cilacap',
 peserta:'28 guru Pendidikan Agama Kristen Kabupaten Cilacap',
 tim:'Lanny Pakan, Rudy Cristianto, Hendru Widjaja, Andrian Purnama, Ribia Minaryati',
 ringkasan:'Pertemuan perdana YSPI bersama guru-guru PAK Kabupaten Cilacap, lanjutan dari pertemuan dengan 9 guru di Adipala pada 27 Juni 2026. Hari itu tim YSPI lebih banyak mendengar: tentang kelas gabungan, bahan ajar yang terbatas, dan kerinduan guru untuk terus bertumbuh. Ibu Indarti, guru PAK dari Yogyakarta, berbagi pengalamannya: dari guru untuk guru.',
 rundown:[['11.00–12.00','Wawancara tim YSPI dengan 10 guru'],['12.00–12.30','Pembukaan: pujian dan doa'],['12.30–13.00','Makan siang bersama'],['13.00–13.20','Mengenal YSPI'],['13.20–13.50','Berbagi pengalaman: Ibu Indarti, guru PAK Yogyakarta'],['13.50–14.20','Cara kerja pendampingan YSPI (Ibu Ribia)'],['14.20–15.00','Tanya jawab, penutup, dan pembagian handuk dari donatur']],
 didengar:['Banyak guru mengajar di beberapa sekolah sekaligus.','Di satu sekolah muridnya bisa hanya satu anak; kelas 1–6 sering digabung.','Bahan ajar masih bertumpu pada LKS dan media gambar hampir tidak ada.','Sebagian guru belum punya laptop sendiri.'],
 arah:['Pertemuan daring rutin dua kali sebulan.','Bahan ajar per tema yang siap dipakai.','Kunjungan langsung per kuartal.','Grup WhatsApp Guru PAK Cilacap terbentuk pertengahan Oktober 2026.'],
 foto:[{n:'01',ket:'Foto bersama guru PAK Cilacap dan tim YSPI'},{n:'02',ket:'Peserta di depan spanduk Temu Kasih'},{n:'03',ket:'Sambutan dari mimbar'},{n:'04',ket:'Menyapa para guru'},{n:'05',ket:'Sesi di depan jemaat'},{n:'06',ket:'Doa bersama'},{n:'07',ket:'Peserta menyimak'},{n:'08',ket:'Suasana ruang pertemuan'},{n:'09',ket:'Paparan di layar'},{n:'10',ket:'Para guru mengikuti sesi'},{n:'11',ket:'Bersama di depan spanduk'},{n:'12',ket:'Peserta di barisan depan'},{n:'13',ket:'Berbagi di depan peserta'},{n:'14',ket:'Suasana dari sisi ruangan'},{n:'15',ket:'Para guru PAK Cilacap'},{n:'16',ket:'Peserta Temu Kasih'},{n:'17',ket:'Foto bersama'},{n:'18',ket:'Sesi tanya jawab'}]
}];
const src=(n:string,kecil=false)=>'/temu-kasih/'+n+(kecil?'-kecil':'')+'.jpg';

export function TemuKasih(){
 const [buka,setBuka]=useState<{k:Kegiatan;i:number}|null>(null);
 const geser=(d:number)=>setBuka(b=>b&&{...b,i:(b.i+d+b.k.foto.length)%b.k.foto.length});
 return <div className="temu-space">{kegiatan.map(k=><article key={k.id} className="temu-kegiatan">
  <section className="temu-hero"><img src={src(k.foto[0].n)} alt={k.foto[0].ket}/><div><p className="eyebrow">KEGIATAN TEMU KASIH</p><h2>{k.judul}</h2><ul className="temu-fakta"><li><CalendarDays size={17}/>{k.tanggal} · {k.waktu}</li><li><MapPin size={17}/>{k.tempat}</li><li><Users size={17}/>{k.peserta}</li></ul></div></section>
  <div className="temu-grid"><section className="panel compact"><h2>Ringkasan kegiatan</h2><p className="muted">{k.ringkasan}</p><h3 className="temu-sub">Tim YSPI</h3><p className="muted">{k.tim}</p></section>
  <section className="panel compact"><h2>Susunan acara</h2><ol className="temu-rundown">{k.rundown.map(([w,a])=><li key={w}><span>{w}</span>{a}</li>)}</ol></section></div>
  <div className="temu-grid"><section className="panel compact"><h2>Yang kami dengar dari guru</h2><ul className="temu-list">{k.didengar.map(x=><li key={x}>{x}</li>)}</ul></section>
  <section className="panel compact"><h2>Langkah pendampingan berikutnya</h2><ul className="temu-list">{k.arah.map(x=><li key={x}>{x}</li>)}</ul><p className="temu-pesan"><HandHeart size={18}/>Guru PAK di Cilacap: kalian tidak sendiri.</p></section></div>
  <section className="panel compact"><div className="panel-heading"><div><h2>Galeri foto</h2><p>{k.foto.length} foto kegiatan. Klik untuk memperbesar.</p></div></div><div className="temu-galeri">{k.foto.map((f,i)=><button key={f.n} onClick={()=>setBuka({k,i})} aria-label={'Perbesar foto: '+f.ket}><img src={src(f.n,true)} alt={f.ket} loading="lazy"/></button>)}</div></section>
 </article>)}
 <Dialog open={!!buka} onOpenChange={v=>!v&&setBuka(null)}><DialogContent className="report-dialog temu-lightbox sm:max-w-5xl">{buka&&<><DialogHeader><DialogTitle>{buka.k.foto[buka.i].ket}</DialogTitle><DialogDescription>{buka.k.judul} · foto {buka.i+1} dari {buka.k.foto.length}</DialogDescription></DialogHeader><img src={src(buka.k.foto[buka.i].n)} alt={buka.k.foto[buka.i].ket}/><div className="dialog-actions"><button className="secondary" onClick={()=>geser(-1)}><ChevronLeft size={16}/>Sebelumnya</button><button className="secondary" onClick={()=>geser(1)}>Berikutnya<ChevronRight size={16}/></button></div></>}</DialogContent></Dialog>
 </div>;
}
