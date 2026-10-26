// Pretest/postest guru dari Pusat Tes YSPI (https://pusat-tes-yspi.vercel.app), dibaca di server.
// Web ini hanya memegang token BACA khusus program Guru (env PUSAT_TES_TOKEN, dibuat di pintu PC kantor
// Pusat Tes): tidak ada kunci database Pusat Tes di sini, tidak ada foto lembar, tidak ada hak menulis.
// Membetulkan lembar, memasang kunci, dan mengirim rangkuman dilakukan di web Pusat Tes.
export async function bacaPusatTes() {
  const token = process.env.PUSAT_TES_TOKEN || '';
  if (!/^[0-9a-f]{64}$/.test(token)) return { aktif: false, alasan: 'Token Pusat Tes belum dipasang di web ini.' };
  const asal = (process.env.PUSAT_TES_URL || 'https://pusat-tes-yspi.vercel.app').replace(/\/+$/, '');
  if (!/^https:\/\/[\w.-]+$/.test(asal)) return { aktif: false, alasan: 'Alamat Pusat Tes tidak sah.' };
  const r = await fetch(asal + '/api/baca?program=guru', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (r.status === 401) return { aktif: false, alasan: 'Token Pusat Tes ditolak (mungkin sudah diganti).' };
  if (!r.ok) return { aktif: false, alasan: 'Pusat Tes belum bisa dihubungi (' + r.status + ').' };
  const d = await r.json();
  return { aktif: true, linkPusat: String(d.linkPusat || asal), kegiatan: Array.isArray(d.kegiatan) ? d.kegiatan : [] };
}
