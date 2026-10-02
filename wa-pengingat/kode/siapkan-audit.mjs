// Menyiapkan BAHAN AUDIT follow-up untuk model lokal di harness.
//
// Alurnya: baca grup YSPI team, rangkum apa yang layak dicatat (#log), apa yang
// layak ditutup (#close), lalu periksa item terbuka yang sebenarnya sudah
// selesai menurut isi percakapan.
//
// Berkas ini TIDAK menulis ke tracker. Hasil model nanti berupa usulan yang
// diperiksa periksa-usulan.mjs sebelum ada satu sel pun yang disentuh.
//
// Pakai: node siapkan-audit.mjs [jumlah-hari]
import fs from 'node:fs';
import path from 'node:path';
import { BRIDGE, readTracker, groupMessages, dateWIB, dateLong, clean } from './lokal-lengkap.mjs';

const hari=Number(process.argv[2]||3);
const now=new Date(), tanggal=dateWIB(now);
const jamWIB=t=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(t));

const {items,sha256}=readTracker();
const terbuka=items.filter(i=>i.status!=='Closed');
const pesan=groupMessages(hari);
if(!pesan.length)throw Error('Tidak ada pesan grup dalam rentang itu; audit dibatalkan.');

// Nomor urut dipakai model untuk menunjuk bukti; teksnya dicocokkan mekanis
// nanti, jadi model tidak bisa mengarang kutipan.
const daftarPesan=pesan.map((p,n)=>`[P${n+1}] ${jamWIB(p.ts)} ${p.pengirim}: ${clean(p.teks).slice(0,300)}`).join('\n');
const daftarItem=terbuka.map(i=>`| ${i.id} | ${i.status} | ${clean(i.pic)||'-'} | ${clean(i.target)||'-'} | ${clean(i.judul).slice(0,95)} | ${clean(i.terbaru).slice(0,110)||'-'} |`).join('\n');

const teks=`# Audit follow-up YSPI — ${dateLong(now)}

Disiapkan otomatis ${jamWIB(Date.now())} WIB. Tracker dibaca saja pada tahap ini.
SHA-256 Excel: \`${sha256.slice(0,16)}…\` · ${pesan.length} pesan grup ${hari} hari terakhir · ${terbuka.length} item terbuka.

## Tugas Anda

Baca percakapan grup di bawah, bandingkan dengan daftar item terbuka, lalu tulis
hasilnya sebagai JSON ke \`WA-Lokal/pengingat/usulan-${tanggal}.json\`:

\`\`\`json
{
  "logBaru":       [{"judul":"...","pic":"...","target":"...","bukti":"P12","alasan":"..."}],
  "usulTutup":     [{"id":"F07","bukti":"P12","alasan":"..."}],
  "seharusnyaTutup":[{"id":"F07","bukti":"P12","alasan":"..."}]
}
\`\`\`

- **logBaru** — tugas/komitmen baru yang muncul di percakapan dan belum ada di daftar item terbuka.
- **usulTutup** — item terbuka yang menurut percakapan sudah selesai dikerjakan.
- **seharusnyaTutup** — item yang buktinya sudah lama selesai tetapi statusnya masih Outstanding atau Kandidat Close sampai hari ini.

## Aturan

1. Setiap baris WAJIB menyebut \`bukti\` berupa satu kode pesan seperti \`P12\`. Tanpa itu, usulannya ditolak.
2. Kode bukti harus benar-benar mendukung pernyataannya; pemeriksa akan membaca ulang pesan itu.
3. Jangan mengusulkan menutup item hanya karena sudah lama. Kelamaan bukan bukti selesai.
4. Rencana, wacana, dan pertanyaan bukan komitmen. Hanya tulis \`logBaru\` bila ada orang yang jelas mengambil tugas.
5. \`alasan\` satu kalimat, bahasa Indonesia, maksimal 25 kata.
6. Jangan menyentuh berkas Excel. Tahap ini hanya usulan.
7. Kalau sebuah kategori kosong, tulis daftar kosong \`[]\`. Jangan mengarang isi.

## Item terbuka di tracker

| ID | Status | PIC | Tenggat | Judul | Catatan terakhir |
|---|---|---|---|---|---|
${daftarItem}

## Percakapan grup YSPI team (${hari} hari terakhir)

${daftarPesan}
`;

const keluar=path.join(BRIDGE,'pengingat');
fs.mkdirSync(keluar,{recursive:true});
const berkas=path.join(keluar,`audit-${tanggal}.md`);
fs.writeFileSync(berkas,teks);
fs.writeFileSync(path.join(keluar,`audit-${tanggal}.sumber.json`),JSON.stringify({
  tanggal, sha256, hari,
  pesan: pesan.map((p,n)=>({kode:`P${n+1}`, ts:p.ts, pengirim:p.pengirim, teks:p.teks})),
  terbuka: terbuka.map(i=>i.id),
},null,2));
console.log(`Bahan audit ditulis: ${berkas} (${teks.length} huruf).`);
console.log(`${pesan.length} pesan grup, ${terbuka.length} item terbuka.`);
console.log(`Model menjawab ke: WA-Lokal/pengingat/usulan-${tanggal}.json`);
