// Inti "pintu laporan guru": satu lapisan baca/ubah atas Supabase "Pelaporan Guru YSPI"
// yang dipakai bersama oleh server HTTP lokal (server.mjs, port 3468) dan server MCP (mcp.mjs).
// Tujuannya: model apa pun (lokal lewat router/DSH, Claude, Codex) membaca laporan dalam
// bentuk yang SAMA, berbahasa Indonesia, tanpa perlu tahu skema Supabase.
//
// Aturan:
// - Nomor HP guru TIDAK pernah keluar dari pintu ini.
// - Pesan asli (raw) hanya keluar bila diminta (mentah: true).
// - Ubah hanya kolom isi laporan (daftar KOLOM_UBAH). Status periksa/kendala, pemilik,
//   sumber, dan penghapusan tetap urusan admin di website.
// - Laporan yang sudah "Disetujui" admin tidak boleh diubah lewat pintu ini.
// - Setiap ubahan dicatat (sebelum & sesudah) di data/ubah-laporan.jsonl supaya bisa dibalik.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ambilSemua, bukaKunci, sensor } from '../supabase-baca.mjs';

const AKAR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(AKAR, '..', 'data');
export const LOG_UBAH = process.env.PINTU_LOG_UBAH || path.join(DATA, 'ubah-laporan.jsonl');

const STATUS = { review: 'Perlu diperiksa', approved: 'Disetujui' };
const KENDALA = { open: 'Terbuka', progress: 'Diproses', resolved: 'Selesai' };

// Nama kolom Indonesia -> kolom Supabase, beserta jenis nilainya.
export const KOLOM_UBAH = {
  guru: ['name', 'teks'], sekolah: ['school', 'teks'], wilayah: ['region', 'teks'], tanggal: ['date', 'tanggal'],
  sesi: ['sessions', 'angka'], siswa: ['students', 'angka'], kegiatan: ['activity', 'teks'], dampak: ['impact', 'teks'],
  kendala: ['challenge', 'teks'], dana_diterima: ['funds_received', 'angka'], dana_dipakai: ['funds_used', 'angka'], catatan_dana: ['funds_note', 'teks'],
};

export function bentuk(r, media = [], { mentah = false } = {}) {
  const x = {
    id: r.id, jenis: r.jenis || 'cerita', guru: r.name || '', sekolah: r.school || '', wilayah: r.region || '',
    tanggal: r.date || '', sesi: r.sessions ?? null, siswa: r.students ?? null,
    kegiatan: r.activity || '', dampak: r.impact || '', kendala: r.challenge || '',
    dana_diterima: r.funds_received ?? null, dana_dipakai: r.funds_used ?? null, catatan_dana: r.funds_note || '',
    status_periksa: STATUS[r.status] || r.status || '', status_kendala: KENDALA[r.issue_status] || r.issue_status || '',
    jumlah_foto: media.length, sumber: r.source || '', model_penyari: r.model || '',
    dibuat: r.created_at || '', diubah: r.updated_at || '',
  };
  if (mentah) x.pesan_asli = r.raw || '';
  return x;
}

// Cache singkat: data kecil, dan beberapa alat sering dipanggil beruntun oleh agen.
let cache = null, cacheWaktu = 0;
const UMUR_CACHE = 30_000;
export async function semua({ segar = false, ambil = ambilSemua } = {}) {
  if (!segar && cache && Date.now() - cacheWaktu < UMUR_CACHE) return cache;
  const [lap, media] = await Promise.all([ambil('yspi_reports'), ambil('yspi_media', 'id,report_id')]);
  const perLaporan = new Map();
  for (const m of media) (perLaporan.get(m.report_id) || perLaporan.set(m.report_id, []).get(m.report_id)).push(m);
  cache = { mentah: lap, media: perLaporan };
  cacheWaktu = Date.now();
  return cache;
}
export const lupakanCache = () => { cache = null; };

const kecil = (s) => String(s || '').toLocaleLowerCase('id');
export async function daftar(f = {}, opsi = {}) {
  const { mentah: rows, media } = await semua(opsi);
  const batas = Math.min(Math.max(Number(f.batas) || 50, 1), 500);
  let hasil = rows.map((r) => bentuk(r, media.get(r.id), { mentah: !!f.mentah }));
  if (f.jenis) hasil = hasil.filter((x) => x.jenis === f.jenis);
  if (f.sekolah) hasil = hasil.filter((x) => kecil(x.sekolah).includes(kecil(f.sekolah)));
  if (f.guru) hasil = hasil.filter((x) => kecil(x.guru).includes(kecil(f.guru)));
  if (f.wilayah) hasil = hasil.filter((x) => kecil(x.wilayah).includes(kecil(f.wilayah)));
  if (f.status) hasil = hasil.filter((x) => kecil(x.status_periksa) === kecil(f.status));
  if (f.sejak) hasil = hasil.filter((x) => (x.tanggal || x.dibuat.slice(0, 10)) >= f.sejak);
  if (f.sampai) hasil = hasil.filter((x) => (x.tanggal || x.dibuat.slice(0, 10)) <= f.sampai);
  if (f.cari) { const q = kecil(f.cari); hasil = hasil.filter((x) => [x.kegiatan, x.dampak, x.kendala, x.guru, x.sekolah].some((v) => kecil(v).includes(q))); }
  hasil.sort((a, b) => String(b.tanggal || b.dibuat).localeCompare(String(a.tanggal || a.dibuat)));
  return { jumlah: hasil.length, ditampilkan: Math.min(batas, hasil.length), laporan: hasil.slice(0, batas) };
}

export async function satu(id, { mentah = false, ...opsi } = {}) {
  const { mentah: rows, media } = await semua(opsi);
  const r = rows.find((x) => x.id === id);
  return r ? bentuk(r, media.get(r.id), { mentah }) : null;
}

// Angka dihitung program, bukan model: model cukup membaca ringkasan ini.
export async function ringkasan(opsi = {}) {
  const { mentah: rows, media } = await semua(opsi);
  const hitung = (fn) => rows.reduce((m, r) => { const k = fn(r) || '(kosong)'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const jumlahAngka = (k) => rows.reduce((s, r) => s + (Number.isFinite(r[k]) ? r[k] : 0), 0);
  return {
    total_laporan: rows.length,
    per_jenis: hitung((r) => r.jenis || 'cerita'),
    per_status_periksa: hitung((r) => STATUS[r.status] || r.status),
    per_sekolah: hitung((r) => r.school),
    per_wilayah: hitung((r) => r.region),
    per_bulan: hitung((r) => String(r.date || r.created_at || '').slice(0, 7)),
    kendala_terbuka: rows.filter((r) => r.issue_status === 'open').length,
    total_siswa_disebut: jumlahAngka('students'),
    total_dana_diterima: jumlahAngka('funds_received'),
    total_dana_dipakai: jumlahAngka('funds_used'),
    laporan_dengan_foto: rows.filter((r) => media.get(r.id)?.length).length,
  };
}

export function periksaUbahan(perubahan) {
  if (!perubahan || typeof perubahan !== 'object' || Array.isArray(perubahan)) throw Error('perubahan harus objek {kolom: nilai}');
  const kunci = Object.keys(perubahan);
  if (!kunci.length) throw Error('perubahan kosong');
  const kolom = {};
  for (const k of kunci) {
    const def = KOLOM_UBAH[k];
    if (!def) throw Error(`Kolom "${k}" tidak boleh diubah lewat pintu ini. Yang boleh: ${Object.keys(KOLOM_UBAH).join(', ')}`);
    const [nama, jenis] = def, v = perubahan[k];
    if (jenis === 'teks') { if (typeof v !== 'string' || v.length > 12000) throw Error(`${k} harus teks ≤12000 huruf`); kolom[nama] = v.trim(); }
    if (jenis === 'angka') { if (v !== null && (!Number.isFinite(v) || v < 0 || v > 1e12)) throw Error(`${k} harus angka ≥0 atau null`); kolom[nama] = v; }
    if (jenis === 'tanggal') { if (v !== '' && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw Error(`${k} harus YYYY-MM-DD atau kosong`); kolom[nama] = v || null; }
  }
  return kolom;
}

async function patch(id, kolom) {
  const kunci = await bukaKunci();
  const cfg = JSON.parse(fs.readFileSync(path.join(process.env.LAPORAN_GURU_PENGHUBUNG || 'C:\\Users\\suluh\\Documents\\Codex\\2026-09-14\\co\\outputs\\yspi-supabase', 'state', 'connection.json'), 'utf8'));
  const r = await fetch(`https://${cfg.project}.supabase.co/rest/v1/yspi_reports?id=eq.${encodeURIComponent(id)}&status=neq.approved`, {
    method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(30_000),
    // Bearer hanya untuk kunci JWT lama (eyJ...), sama seperti penghubung; kunci sb_secret_ cukup apikey.
    headers: { apikey: kunci, ...(kunci.startsWith('eyJ') ? { authorization: 'Bearer ' + kunci } : {}), 'content-type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(kolom),
  });
  if (!r.ok) throw Error(sensor('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200)));
  return r.json();
}

export async function ubah(id, perubahan, { oleh, alasan = '', tulis = patch, ambil } = {}) {
  if (typeof id !== 'string' || !id) throw Error('id laporan wajib');
  if (typeof oleh !== 'string' || !oleh.trim()) throw Error('"oleh" wajib: nama agen/model/orang yang mengubah');
  const kolom = periksaUbahan(perubahan);
  const { mentah: rows } = await semua({ segar: true, ...(ambil ? { ambil } : {}) });
  const lama = rows.find((x) => x.id === id);
  if (!lama) throw Error('Laporan tidak ditemukan');
  if (lama.status === 'approved') throw Error('Laporan sudah Disetujui admin; ubah lewat website Pelaporan Guru.');
  const sebelum = Object.fromEntries(Object.keys(kolom).map((k) => [k, lama[k] ?? null]));
  // Filter status=neq.approved di PATCH menutup celah bila admin menyetujui di antara baca dan tulis.
  const hasil = await tulis(id, kolom);
  if (!Array.isArray(hasil) || !hasil.length) throw Error('Tidak ada baris yang berubah (mungkin baru saja disetujui admin).');
  fs.mkdirSync(path.dirname(LOG_UBAH), { recursive: true });
  fs.appendFileSync(LOG_UBAH, JSON.stringify({ waktu: new Date().toISOString(), id, oleh: oleh.trim().slice(0, 100), alasan: String(alasan).slice(0, 500), sebelum, sesudah: kolom }) + '\n');
  lupakanCache();
  return { ok: true, id, diubah: Object.keys(perubahan), laporan: bentuk(hasil[0]) };
}

// Definisi alat yang sama untuk MCP dan untuk model lokal (format tools Ollama/OpenAI).
export const ALAT = [
  { name: 'daftar_laporan', description: 'Daftar laporan guru YSPI (cerita kegiatan & jejak belajar), terbaru dulu. Semua filter opsional.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      jenis: { type: 'string', enum: ['cerita', 'jejak'] }, sekolah: { type: 'string' }, guru: { type: 'string' }, wilayah: { type: 'string' },
      status: { type: 'string', enum: ['Perlu diperiksa', 'Disetujui'] }, sejak: { type: 'string', description: 'YYYY-MM-DD' }, sampai: { type: 'string', description: 'YYYY-MM-DD' },
      cari: { type: 'string', description: 'kata dalam kegiatan/dampak/kendala/nama/sekolah' }, batas: { type: 'integer', minimum: 1, maximum: 500 },
      mentah: { type: 'boolean', description: 'sertakan pesan asli WhatsApp' } } } },
  { name: 'lihat_laporan', description: 'Satu laporan guru lengkap berdasarkan id.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' }, mentah: { type: 'boolean' } } } },
  { name: 'ringkasan_laporan', description: 'Angka ringkas semua laporan guru (per jenis, sekolah, wilayah, bulan, status; total siswa & dana). Angka dihitung program.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} } },
  { name: 'ubah_laporan', description: 'Ubah kolom isi satu laporan guru yang belum Disetujui. Hanya ubah yang benar-benar tertulis di sumber; jangan mengarang. Setiap ubahan dicatat dan bisa dibalik.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id', 'perubahan', 'oleh', 'alasan'], properties: {
      id: { type: 'string' },
      perubahan: { type: 'object', description: 'kolom yang boleh: ' + Object.keys(KOLOM_UBAH).join(', '), additionalProperties: false,
        properties: Object.fromEntries(Object.entries(KOLOM_UBAH).map(([k, [, j]]) => [k, j === 'angka' ? { type: ['number', 'null'] } : { type: 'string' }])) },
      oleh: { type: 'string', description: 'nama agen/model yang mengubah' }, alasan: { type: 'string' } } } },
];

export async function jalankanAlat(nama, a = {}) {
  if (nama === 'daftar_laporan') return daftar(a);
  if (nama === 'lihat_laporan') { const x = await satu(a.id, { mentah: !!a.mentah }); if (!x) throw Error('Laporan tidak ditemukan'); return x; }
  if (nama === 'ringkasan_laporan') return ringkasan();
  if (nama === 'ubah_laporan') return ubah(a.id, a.perubahan, { oleh: a.oleh, alasan: a.alasan });
  throw Error('Alat tidak dikenal: ' + nama);
}
