// Penjaga usulan audit follow-up — satu sumber, dipakai jalur harness
// (periksa-usulan.mjs) maupun jalur alat (audit-lokal.mjs).
//
// Model tidak pernah menulis kutipan bukti. Ia hanya menunjuk kode pesan
// seperti "P12"; program yang menerjemahkannya jadi pengirim, jam, dan isi.
// Karena itu mengarang kutipan tidak mungkin secara teknis — tapi menunjuk
// pesan yang TIDAK membahas itemnya tetap mungkin (uji 14 Sep: F83 dengan P10),
// jadi usulan tetap berupa usulan dan hasilnya dilaporkan apa adanya.
import { clean } from './lokal-lengkap.mjs';

export const KATEGORI = [
  ['logBaru', false, 'Layak dicatat sebagai item baru'],
  ['usulTutup', true, 'Layak diusulkan tutup'],
  ['seharusnyaTutup', true, 'Seharusnya sudah ditutup tapi masih terbuka'],
];

export function periksaUsulan(usulan, { pesanPerKode, terbuka, items }) {
  const masalah = [];
  if (!usulan || typeof usulan !== 'object') return ['Usulan bukan objek JSON.'];
  const periksaBaris = (bagian, b, n, perluId) => {
    const nama = `${bagian}[${n}]`;
    if (!b || typeof b !== 'object') return masalah.push(`${nama}: bukan objek.`);
    if (!pesanPerKode.has(clean(b.bukti))) {
      const kode = [...pesanPerKode.keys()];
      masalah.push(`${nama}: bukti "${b.bukti || '(kosong)'}" bukan kode pesan yang ada; kode sah hanya ${kode[0]} sampai ${kode.at(-1)}.`);
    }
    if (!clean(b.alasan)) masalah.push(`${nama}: alasan kosong.`);
    else if (clean(b.alasan).split(' ').length > 25) masalah.push(`${nama}: alasan ${clean(b.alasan).split(' ').length} kata, batas 25.`);
    if (/#(?:log|close|reopen)/i.test(`${b.alasan || ''} ${b.judul || ''}`)) {
      masalah.push(`${nama}: jangan menulis tag #log/#close/#reopen; agen Mac membacanya sebagai perintah.`);
    }
    if (perluId) {
      if (!/^F\d+$/.test(clean(b.id || ''))) masalah.push(`${nama}: id "${b.id || '(kosong)'}" bukan kode item.`);
      else if (!items.some((i) => i.id === b.id)) masalah.push(`${nama}: ${b.id} tidak ada di tracker.`);
      else if (!terbuka.has(b.id)) masalah.push(`${nama}: ${b.id} sudah Closed; tidak perlu diusulkan lagi.`);
    } else if (!clean(b.judul)) masalah.push(`${nama}: judul kosong.`);
  };
  for (const [bagian, perluId] of KATEGORI) {
    const daftar = usulan[bagian];
    if (!Array.isArray(daftar)) { masalah.push(`${bagian}: bukan daftar (tulis [] bila kosong).`); continue; }
    daftar.forEach((b, n) => periksaBaris(bagian, b, n + 1, perluId));
  }
  const semuaId = [...(usulan.usulTutup || []), ...(usulan.seharusnyaTutup || [])].map((b) => b?.id);
  const ganda = semuaId.filter((id, n) => id && semuaId.indexOf(id) !== n);
  if (ganda.length) masalah.push(`Item muncul lebih dari sekali: ${[...new Set(ganda)].join(', ')}.`);
  return masalah;
}

export const jamWIB = (t) => new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(t));

export function buktiSingkat(pesanPerKode, kode) {
  const p = pesanPerKode.get(clean(kode));
  return p ? `${clean(p.pengirim) || 'anggota'}, ${jamWIB(p.ts)}` : '(bukti tidak ada)';
}
