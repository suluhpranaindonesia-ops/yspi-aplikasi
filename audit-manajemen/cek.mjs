// Implementasi pemeriksaan Audit Management Checker (ID sama dengan butir.mjs).
// Semua pemeriksaan HANYA MEMBACA, kecuali jejak ukuran data (data\jejak-data.json)
// yang dipakai D2 untuk mendeteksi data yang hilang/menyusut.

import net from 'node:net';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { semuaButir } from './butir.mjs';

export const KERJA = 'C:\\Users\\suluh\\My Drive\\SPI-Kerja';
export const VAULT = 'C:\\Users\\suluh\\Vault-SPI';
const WIKI = path.join(VAULT, 'wiki');
const AUDIT_DATA = path.join(KERJA, 'audit-manajemen', 'data');
const PENJAGA = path.join(KERJA, 'penjaga.json');
const PENJAGA_LOG = 'C:\\Users\\suluh\\.dsh\\penjaga.log';
const LAPORAN_GURU = path.join(VAULT, 'DRAFT', 'Laporan Guru');
const SITUS = [
  'https://suluhpranaindonesia.vercel.app',
  'https://yspi-cerita-pencapaian.vercel.app',
  'https://pendataan-guru-yspi.vercel.app',
  'https://pemantauan-ht-pouk.vercel.app',
];
// Berkas data yang dijaga. Di dalam My Drive / vault = punya riwayat versi Google Drive.
const SUMBER = [
  ['Keuangan (bon, donasi)', path.join(KERJA, 'keuangan-web', 'data', 'keuangan.json'), 'json'],
  ['Akun dasbor keuangan', path.join(KERJA, 'keuangan-web', 'data', 'akses.json'), 'json'],
  ['Laporan guru (salinan Supabase)', path.join(LAPORAN_GURU, 'data', 'laporan.json'), 'json', (j) => j.laporan?.length ?? null],
  ['Rekap laporan guru', path.join(LAPORAN_GURU, 'Rekap-Laporan-Guru-YSPI.xlsx'), 'xlsx'],
  ['Status sinkron laporan guru', path.join(KERJA, 'laporan-guru', 'data', 'state.json'), 'json'],
  ['Pemantauan HT (koneksi)', path.join(KERJA, 'pemantauan-ht', 'data', 'koneksi.json'), 'json'],
  ['Pemantauan HT (WhatsApp)', path.join(KERJA, 'pemantauan-ht', 'data', 'wa.json'), 'json'],
  ['Pengingat kewajiban (tambahan)', path.join(KERJA, 'kewajiban', 'tambahan.json'), 'json'],
  ['Daftar layanan penjaga', PENJAGA, 'json'],
  ['Database Konsol WhatsApp', 'C:\\Users\\suluh\\wa-konsol\\data\\wa.db', 'sqlite'],
  ['Riwayat audit otomatis', path.join(AUDIT_DATA, 'otomatis.json'), 'json'],
].map(([nama, berkas, jenis, hitung]) => ({ nama, berkas, jenis, hitung }));
const DI_DRIVE = (p) => p.startsWith('C:\\Users\\suluh\\My Drive\\') || p.startsWith(VAULT + '\\');

// Cadangan harian wa.db (dibuat perbaiki.mjs; folder ini tersinkron Google Drive, tidak ikut GitHub).
export const WA_DB = 'C:\\Users\\suluh\\wa-konsol\\data\\wa.db';
export const CADANGAN_WA = path.join(KERJA, 'cadangan', 'wa-konsol');
export function cadanganWaTerakhir() {
  try {
    return fs.readdirSync(CADANGAN_WA).filter((f) => /^wa-\d{8}-\d{6}\.db$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(CADANGAN_WA, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0] || null;
  } catch { return null; }
}

// Isi yang tidak boleh ikut ter-commit (dipakai pemantau & perbaikan D6).
export const POLA_RAHASIA = [
  [/[\w.+-]+@(?!users\.noreply\.github\.com)[\w-]+\.[a-z]{2,}/i, 'alamat email'],
  [/\b(\+?62|08)\d{8,12}\b/, 'nomor HP'],
  [/Rp\s?\d/i, 'angka rupiah'],
  [/(password|sandi|token|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{6,}/i, 'sandi/token'],
];

// Sisa tulis terputus (.tmp dsb.) lebih tua dari 10 menit di folder data aplikasi.
const AKAR_DATA = [path.join(KERJA, 'keuangan-web', 'data'), path.join(KERJA, 'laporan-guru', 'data'), path.join(KERJA, 'pemantauan-ht', 'data'),
  path.join(KERJA, 'kewajiban'), AUDIT_DATA, path.join(LAPORAN_GURU, 'data'), 'C:\\Users\\suluh\\wa-konsol\\data'];
export async function cariTmp() {
  const temu = [];
  for (const a of AKAR_DATA) {
    let nama = []; try { nama = await fsp.readdir(a, { recursive: true }); } catch { continue; }
    for (const n of nama) {
      if (!/\.(tmp|part|partial)$|~$/i.test(n) || n.split(path.sep)[0] === 'karantina') continue;
      try { const st = await fsp.stat(path.join(a, n)); if (Date.now() - st.mtimeMs > 10 * 6e4) temu.push({ p: path.join(a, n), t: st.mtimeMs }); } catch {}
    }
  }
  return temu;
}

const exec = promisify(execFile);
const git = async (...a) => (await exec('git', ['-C', KERJA, ...a], { maxBuffer: 20e6, windowsHide: true })).stdout;
const h = (status, ringkas, detail = '') => ({ status, ringkas, detail });
const hari = (ms) => (Date.now() - ms) / 864e5;
const tglLokal = (ms) => new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
export const cekPort = (port) => new Promise((ok) => {
  const s = net.connect({ host: '127.0.0.1', port });
  const selesai = (hidup) => { s.destroy(); ok(hidup); };
  s.setTimeout(1500, () => selesai(false));
  s.once('connect', () => selesai(true));
  s.once('error', () => selesai(false));
});
const daftarRinci = (arr, n = 25) => arr.slice(0, n).join('\n') + (arr.length > n ? `\n… dan ${arr.length - n} lagi` : '');
function bacaJson(p, cadangan = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return cadangan; } }
function jumlahRekaman(j) {
  if (Array.isArray(j)) return j.length;
  if (j && typeof j === 'object') { const arr = Object.values(j).filter(Array.isArray); return arr.length ? arr.reduce((a, x) => a + x.length, 0) : null; }
  return null;
}

// ---------- bahan bersama per putaran (dibaca sekali) ----------
function buatKonteks({ uji }) {
  const memo = {};
  const sekali = (k, f) => (memo[k] ||= f());
  return {
    uji,
    penjaga: () => sekali('penjaga', async () => JSON.parse(await fsp.readFile(PENJAGA, 'utf8'))),
    riwayat: () => sekali('riwayat', async () => bacaJson(path.join(AUDIT_DATA, 'otomatis.json'), { riwayat: [] }).riwayat || []),
    sinkron: () => sekali('sinkron', async () => (await fetch('http://127.0.0.1:3463/status', { signal: AbortSignal.timeout(3000) })).json()),
    wiki: () => sekali('wiki', async () => {
      const nama = await fsp.readdir(WIKI, { recursive: true });
      const hal = [];
      for (const n of nama) {
        if (!n.endsWith('.md')) continue;
        const p = path.join(WIKI, n);
        try { const s = await fsp.stat(p); if (s.isFile()) hal.push({ rel: n.split(path.sep).join('/'), p, ukuran: s.size, ubah: s.mtimeMs }); } catch {}
      }
      return hal;
    }),
    isiWiki: (hal) => sekali('isi:' + hal.p, () => fsp.readFile(hal.p, 'utf8')),
    sumber: () => sekali('sumber', async () => Promise.all(SUMBER.map(async (s) => {
      const r = { ...s, ada: false };
      try {
        const st = await fsp.stat(s.berkas); r.ada = true; r.ukuran = st.size; r.ubah = st.mtimeMs;
        if (st.size === 0) r.galat = 'berkas kosong (0 byte)';
        else if (s.jenis === 'json') { try { const j = JSON.parse(await fsp.readFile(s.berkas, 'utf8')); r.jumlah = s.hitung ? s.hitung(j) : jumlahRekaman(j); } catch (e) { r.galat = 'JSON rusak: ' + e.message; } }
        else {
          const fd = await fsp.open(s.berkas, 'r');
          try {
            const kepala = Buffer.alloc(16); await fd.read(kepala, 0, 16, 0);
            if (s.jenis === 'sqlite' && kepala.toString('latin1') !== 'SQLite format 3\u0000') r.galat = 'kepala SQLite tidak sah';
            if (s.jenis === 'xlsx') {
              const n = Math.min(st.size, 65557), ekor = Buffer.alloc(n); await fd.read(ekor, 0, n, st.size - n);
              if (kepala.readUInt32LE(0) !== 0x04034b50 || ekor.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) < 0) r.galat = 'XLSX/zip tidak utuh';
            }
          } finally { await fd.close(); }
        }
      } catch (e) { if (e.code !== 'ENOENT') r.galat = e.message; }
      return r;
    }))),
  };
}

// ---------- implementasi ----------
const CEK = {
  async A1(k) {
    const r = (await k.riwayat()).find((x) => x.langkah?.some((l) => /^Sintaks|^Server uji|^Bangun/.test(l.nama)));
    if (!r) return h('OK', 'Belum ada perubahan kode yang perlu diuji sejak pemantau aktif.');
    const gagal = r.langkah.filter((l) => !l.ok);
    return r.hasil === 'GAGAL' && gagal.length
      ? h('Masalah', `Uji kode ${tglLokal(Date.parse(r.waktu))} GAGAL — perubahan tidak di-push.`, gagal.map((l) => `✗ ${l.nama}: ${l.ket}`).join('\n'))
      : h('OK', `Uji kode terakhir lolos (${tglLokal(Date.parse(r.waktu))}); ${r.push}.`);
  },
  async A2(k) {
    const r = (await k.riwayat()).find((x) => !x.sedang);
    if (!r) return h('Peringatan', 'Belum ada putaran audit otomatis sebelumnya.');
    const jam = (Date.now() - Date.parse(r.waktu)) / 36e5;
    const s = jam <= 2 ? 'OK' : jam <= 24 ? 'Peringatan' : 'Masalah';
    return h(s, `Putaran terakhir ${Math.round(jam * 60)} menit lalu (${r.pemicu}): ${r.hasil}.`);
  },
  async A3() {
    const kotor = (await git('status', '--porcelain', '--untracked-files=all', '--', 'audit-manajemen')).split('\n').filter(Boolean);
    const depan = (await git('log', '--oneline', 'origin/main..HEAD', '--', 'audit-manajemen')).split('\n').filter(Boolean);
    if (!kotor.length && !depan.length) return h('OK', 'Kode checker sama dengan GitHub.');
    return h('Peringatan', `${kotor.length} berkas belum di-commit, ${depan.length} commit belum di-push.`, daftarRinci([...kotor, ...depan]));
  },
  async A4(k) {
    let j; try { j = await k.penjaga(); } catch (e) { return h('Masalah', 'penjaga.json tidak sah — seluruh daftar layanan diabaikan penjaga.', e.message); }
    const masalah = [], port = new Set();
    for (const l of j.layanan || []) {
      if (port.has(l.port)) masalah.push(`port ${l.port} dipakai lebih dari satu layanan`);
      port.add(l.port);
      if (!l.peluncur?.toLowerCase().startsWith('c:\\users\\suluh\\')) masalah.push(`${l.nama}: peluncur di luar C:\\Users\\suluh`);
      else if (!fs.existsSync(l.peluncur)) masalah.push(`${l.nama}: peluncur tidak ada (${l.peluncur})`);
    }
    return masalah.length ? h('Masalah', `${masalah.length} masalah di penjaga.json.`, masalah.join('\n')) : h('OK', `${j.layanan.length} layanan terdaftar dengan benar.`);
  },

  async B1() {
    const lint = fs.readdirSync(path.join(WIKI, '_audit')).filter((f) => /^lint-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().pop();
    if (!lint) return h('Masalah', 'Belum ada lint wiki.');
    const d = Math.floor(hari(Date.parse(lint.slice(5, 15))));
    return h(d <= 7 ? 'OK' : d <= 14 ? 'Peringatan' : 'Masalah', `Lint terakhir ${lint} (${d} hari lalu).`);
  },
  async B2() {
    const akar = path.join(VAULT, '_staging', 'inbox');
    const ada = [];
    for (const n of await fsp.readdir(akar, { recursive: true })) {
      if (/(^|[\\/])(\.gitkeep|README\.md|desktop\.ini)$/i.test(n)) continue;
      const s = await fsp.stat(path.join(akar, n)); if (s.isFile()) ada.push({ n, d: Math.floor(hari(s.mtimeMs)) });
    }
    if (!ada.length) return h('OK', 'Tidak ada berkas menunggu ingest.');
    ada.sort((a, b) => b.d - a.d);
    return h('Peringatan', `${ada.length} berkas menunggu ingest; terlama ${ada[0].d} hari.`, daftarRinci(ada.map((x) => `${x.d} hari — ${x.n}`)));
  },
  async B3(k) {
    // Tercantum = disebut di index.md, atau di indeks bagian (mis. atom/index-atom.md) relatif ke foldernya.
    const hal = await k.wiki();
    const indeks = await Promise.all(hal.filter((x) => /(^|\/)index(-[\w-]+)?\.md$/.test(x.rel)).map(async (x) => ({ dir: path.dirname(x.p), isi: await k.isiWiki(x) })));
    const lewati = /(^|\/)(index(-[\w-]+)?|log|AGENTS|README)\.md$|^_audit\/|^_templates?\//i;
    const belum = hal.filter((x) => !lewati.test(x.rel) && !indeks.some((i) => i.isi.includes(path.relative(i.dir, x.p).split(path.sep).join('/')))).map((x) => x.rel);
    return belum.length ? h('Peringatan', `${belum.length} halaman belum tercantum di index.md / indeks bagiannya.`, daftarRinci(belum)) : h('OK', `Semua ${hal.length} halaman tercantum di indeks.`);
  },
  async B4(k) {
    const hal = await k.wiki(), rusak = [];
    for (const x of hal) {
      if (/^AGENTS\.md$|^_audit\//.test(x.rel)) continue; // contoh tautan & laporan lint lama (arsip)
      const isi = await k.isiWiki(x);
      for (const m of isi.matchAll(/\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(m[1])) continue;
        let tujuan; try { tujuan = path.resolve(path.dirname(x.p), decodeURIComponent(m[1])); } catch { tujuan = path.resolve(path.dirname(x.p), m[1]); }
        if (!fs.existsSync(tujuan)) rusak.push(`${x.rel} → ${m[1]}`);
      }
    }
    const unik = [...new Set(rusak)];
    return unik.length ? h('Peringatan', `${unik.length} tautan menunjuk halaman yang tidak ada (termasuk yang ditandai "belum dibuat").`, daftarRinci(unik)) : h('OK', 'Semua tautan antarhalaman wiki sah.');
  },
  async B5(k) {
    const isi = await fsp.readFile(path.join(VAULT, 'state.md'), 'utf8');
    const m = isi.match(/^updated:\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/m);
    if (!m) return h('Masalah', 'state.md tidak punya stempel updated:.');
    const stempel = new Date(`${m[1]}T${m[2] || '23:59'}:00+07:00`).getTime();
    const baru = (await k.wiki()).filter((x) => !/^_audit\//.test(x.rel) && x.ubah > stempel + 36e5).sort((a, b) => b.ubah - a.ubah);
    const d = Math.floor(hari(stempel));
    if (baru.length) return h('Peringatan', `${baru.length} halaman wiki berubah sesudah state.md (${m[1]}) — state.md perlu diperbarui.`, daftarRinci(baru.map((x) => `${tglLokal(x.ubah)} — ${x.rel}`)));
    return h(d <= 14 ? 'OK' : 'Peringatan', `state.md diperbarui ${m[1]} (${d} hari lalu); tidak ada perubahan wiki sesudahnya.`);
  },
  async B6(k) {
    const hal = await k.wiki(), log = hal.find((x) => x.rel === 'log.md');
    if (!log) return h('Masalah', 'wiki/log.md tidak ditemukan.');
    const baru = hal.filter((x) => !/^(log|index)\.md$|^_audit\//.test(x.rel) && x.ubah > log.ubah + 6e5).sort((a, b) => b.ubah - a.ubah);
    return baru.length
      ? h('Peringatan', `${baru.length} halaman berubah sesudah entri log.md terakhir (${tglLokal(log.ubah)}).`, daftarRinci(baru.map((x) => `${tglLokal(x.ubah)} — ${x.rel}`)))
      : h('OK', `Tidak ada perubahan halaman sesudah log.md (${tglLokal(log.ubah)}).`);
  },
  async B7(k) {
    const masalah = [], ragu = [];
    for (const x of await k.wiki()) {
      if (x.ukuran === 0) { masalah.push(`${x.rel}: kosong (0 byte)`); continue; }
      const isi = await k.isiWiki(x);
      if (/^---\r?\n/.test(isi) && !/^---\r?\n[\s\S]*?\r?\n---\s*(\r?\n|$)/.test(isi)) masalah.push(`${x.rel}: frontmatter tidak ditutup`);
      if (isi.includes('\uFFFD')) ragu.push(`${x.rel}: ada karakter rusak (�)`);
      if (isi.includes('\u0000')) masalah.push(`${x.rel}: ada byte NUL (berkas biner/terpotong)`);
    }
    if (masalah.length) return h('Masalah', `${masalah.length} halaman rusak.`, daftarRinci([...masalah, ...ragu]));
    if (ragu.length) return h('Peringatan', `${ragu.length} halaman memuat karakter rusak.`, daftarRinci(ragu));
    return h('OK', 'Semua halaman wiki utuh.');
  },
  async B8() {
    const pola = /\(\d+\)\.[^.\\/]+$| [2-9]\.(md|docx|pptx|xlsx|json)$|\.fuse_hidden|conflict|konflik/i; // " 2.md" = salinan Drive; bukan angka tahun
    const temu = [];
    for (const dasar of ['wiki', '_staging']) {
      for (const n of await fsp.readdir(path.join(VAULT, dasar), { recursive: true })) if (pola.test(path.basename(n))) temu.push(`${dasar}/${n.split(path.sep).join('/')}`);
    }
    return temu.length ? h('Peringatan', `${temu.length} berkas tampak seperti salinan konflik/duplikat.`, daftarRinci(temu)) : h('OK', 'Tidak ada berkas konflik di wiki/_staging.');
  },

  async C1(k) {
    const { layanan } = await k.penjaga();
    const st = await Promise.all(layanan.map(async (l) => ({ ...l, hidup: await cekPort(l.port) })));
    const mati = st.filter((l) => !l.hidup);
    return h(mati.length ? 'Masalah' : 'OK', mati.length ? `${mati.length} dari ${st.length} layanan tidak menjawab.` : `Semua ${st.length} layanan menjawab.`,
      st.map((l) => `${l.hidup ? '✓' : '✗'} ${l.port} ${l.nama}`).join('\n'));
  },
  async C2() {
    const batas = Date.now() - 864e5, hitung = {};
    for (const baris of fs.readFileSync(PENJAGA_LOG, 'utf8').split(/\r?\n/)) {
      const m = baris.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s+layanan '(.+)' mati/);
      if (!m || new Date(`${m[1]}T${m[2]}+07:00`).getTime() < batas) continue;
      if (/Audit Management Checker/.test(m[3])) continue; // checker sengaja keluar sendiri setelah memperbarui kodenya
      hitung[m[3]] = (hitung[m[3]] || 0) + 1;
    }
    const daftar = Object.entries(hitung).sort((a, b) => b[1] - a[1]);
    const maks = daftar[0]?.[1] || 0;
    return h(maks >= 10 ? 'Masalah' : maks >= 3 ? 'Peringatan' : 'OK',
      daftar.length ? `${daftar.length} layanan dinyalakan ulang penjaga dalam 24 jam; terbanyak ${maks}×.` : 'Tidak ada layanan yang mati dalam 24 jam.',
      daftar.map(([n, c]) => `${c}× ${n}`).join('\n'));
  },
  async C3() {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "@(Get-CimInstance Win32_Process -Filter \"Name='pwsh.exe' OR Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'dsh-penjaga' }).Count"], { timeout: 15000, windowsHide: true });
    const n = parseInt(stdout.trim(), 10) || 0;
    return n ? h('OK', `Penjaga berjalan (${n} proses).`) : h('Masalah', 'Proses penjaga (dsh-penjaga) tidak ditemukan — layanan yang mati tidak akan dinyalakan ulang.');
  },
  async C4() {
    try {
      const s = await (await fetch('http://127.0.0.1:3458/api/status', { signal: AbortSignal.timeout(3000) })).json();
      return s.koneksi === 'tersambung' ? h('OK', `Tersambung sebagai ${s.nama || s.nomor}.`) : h('Masalah', `Konsol WhatsApp: ${s.koneksi}.`);
    } catch (e) { return h('Masalah', 'Konsol WhatsApp (3458) tidak menjawab.', e.message); }
  },
  async C5(k) {
    let s; try { s = await k.sinkron(); } catch (e) { return h('Masalah', 'Sinkron laporan guru (3463) tidak menjawab.', e.message); }
    const menit = s.berhasil ? Math.round((Date.now() - Date.parse(s.berhasil)) / 6e4) : Infinity;
    const st = s.galat ? 'Masalah' : menit <= 35 ? 'OK' : menit <= 24 * 60 ? 'Peringatan' : 'Masalah';
    return h(st, `Berhasil terakhir ${Number.isFinite(menit) ? menit + ' menit lalu' : 'tidak pernah'}; ${s.laporan} laporan.`, s.galat ? 'Galat: ' + s.galat : '');
  },
  async C6() {
    const hasil = await Promise.all(SITUS.map(async (u) => {
      try { const r = await fetch(u, { signal: AbortSignal.timeout(8000), redirect: 'follow' }); return { u, ok: r.status < 400, ket: r.status }; }
      catch (e) { return { u, ok: false, ket: e.name === 'TimeoutError' ? 'waktu habis' : e.message }; }
    }));
    const gagal = hasil.filter((x) => !x.ok);
    return h(gagal.length ? 'Masalah' : 'OK', gagal.length ? `${gagal.length} dari ${hasil.length} situs tidak bisa dibuka.` : `Semua ${hasil.length} situs bisa dibuka.`,
      hasil.map((x) => `${x.ok ? '✓' : '✗'} ${x.u} (${x.ket})`).join('\n'));
  },
  async C7() {
    let s; try { s = await (await fetch('http://127.0.0.1:3467/status', { signal: AbortSignal.timeout(5000) })).json(); }
    catch (e) { return h('Masalah', 'Router model lokal (3467) tidak menjawab — semua aplikasi yang lewat router tidak bisa memanggil model.', e.message); }
    const masalah = [], peringatan = [], rinci = [];
    if (s.galatConfig) masalah.push('router.json rusak (versi sah terakhir dipakai): ' + s.galatConfig);
    for (const [t, x] of Object.entries(s.config.tingkat)) {
      const ada = s.terpasang.includes(x.model), cad = !x.cadangan || s.terpasang.includes(x.cadangan);
      rinci.push(`${ada ? '✓' : '✗'} ${t}: ${x.model}${x.cadangan ? ` (cadangan ${x.cadangan}${cad ? '' : ' ✗'})` : ''}`);
      if (!ada) masalah.push(`model tingkat ${t} (${x.model}) tidak terpasang di Ollama`);
      if (!cad) peringatan.push(`cadangan tingkat ${t} (${x.cadangan}) tidak terpasang`);
    }
    // Aplikasi wajib menunjuk router (keputusan pengguna 12 Okt 2026: semua lewat router).
    const ROUTER = '127.0.0.1:3467';
    const isi = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
    const PENGHUBUNG = 'C:\\Users\\suluh\\Documents\\Codex\\2026-09-14\\co\\outputs\\yspi-supabase';
    const APP = [
      ['Penghubung laporan guru', isi(path.join(PENGHUBUNG, 'jalan.cmd')).includes('OLLAMA_URL=http://' + ROUTER) && /OLLAMA_URL:process\.env\.OLLAMA_URL/.test(isi(path.join(PENGHUBUNG, 'setup.mjs')))],
      ['Pemantauan HT', isi(path.join(KERJA, 'pemantauan-ht', 'jalan.cmd')).includes('HT_OLLAMA=http://' + ROUTER)],
      ['Keuangan', bacaJson(path.join(KERJA, 'keuangan-web', 'config.json'), {}).ollama === 'http://' + ROUTER],
      ['Laporan pagi & kewajiban (lokal-lengkap)', isi('C:\\Users\\suluh\\wa-konsol\\pengingat\\lokal-lengkap.mjs').includes(`OLLAMA_URL||'http://${ROUTER}'`)],
    ];
    for (const [n, ok] of APP) { rinci.push(`${ok ? '✓' : '✗'} ${n} lewat router`); if (!ok) masalah.push(`${n} belum diarahkan ke router`); }
    // Panggilan 24 jam terakhir: gagal atau terpaksa memakai cadangan.
    let gagal = 0, cadangan = 0, total = 0;
    try {
      const batas = Date.now() - 864e5;
      for (const b of fs.readFileSync(path.join(KERJA, 'llm-router', 'data', 'router.log'), 'utf8').split('\n')) {
        if (!b) continue; let r; try { r = JSON.parse(b); } catch { continue; }
        if (Date.parse(r.waktu) < batas) continue;
        total++; if (!r.ok) gagal++; if (r.cadangan) cadangan++;
      }
    } catch {}
    rinci.push(`ℹ 24 jam: ${total} panggilan, ${gagal} gagal, ${cadangan} memakai cadangan`);
    if (gagal) peringatan.push(`${gagal} panggilan model gagal dalam 24 jam`);
    if (cadangan) peringatan.push(`${cadangan} panggilan terpaksa memakai model cadangan (model utama gagal dimuat?)`);
    if (masalah.length) return h('Masalah', masalah.join('; ') + '.', rinci.join('\n'));
    if (peringatan.length) return h('Peringatan', peringatan.join('; ') + '.', rinci.join('\n'));
    return h('OK', `Router sehat; ${APP.length} aplikasi lewat router; ${total} panggilan 24 jam tanpa gagal.`, rinci.join('\n'));
  },
  async C8() {
    let s; try { s = await (await fetch('http://127.0.0.1:3468/status', { signal: AbortSignal.timeout(8000) })).json(); }
    catch (e) { return h('Masalah', 'Pintu laporan guru (3468) tidak menjawab.', e.message); }
    const isi = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
    const MCP = 'laporan-guru/pintu/mcp.mjs';
    const klien = [
      ['Claude Code (.mcp.json)', !!bacaJson(path.join(KERJA, '.mcp.json'), {}).mcpServers?.['laporan-guru']],
      ['Claude Desktop', !!bacaJson(path.join(process.env.APPDATA || 'C:\\Users\\suluh\\AppData\\Roaming', 'Claude', 'claude_desktop_config.json'), {}).mcpServers?.['laporan-guru']],
      ['DSH', isi('C:\\Users\\suluh\\.dsh\\profiles\\web\\cordis.patch.yml').includes(MCP)],
      ['Codex', isi('C:\\Users\\suluh\\.codex\\config.toml').includes('[mcp_servers.laporan-guru]')],
    ];
    const rinci = [`${s.supabase === 'ok' ? '✓' : '✗'} Supabase: ${s.supabase}`, `ℹ ${s.panggilan} panggilan, ${s.ubahan} ubahan sejak ${tglLokal(Date.parse(s.mulai))}`,
      ...klien.map(([n, ok]) => `${ok ? '✓' : '✗'} MCP terdaftar di ${n}`)];
    if (s.supabase !== 'ok') return h('Masalah', 'Pintu laporan guru hidup tapi gagal membaca Supabase.', rinci.join('\n'));
    const belum = klien.filter(([, ok]) => !ok).map(([n]) => n);
    return belum.length ? h('Peringatan', `MCP laporan-guru belum terdaftar di: ${belum.join(', ')}.`, rinci.join('\n')) : h('OK', 'Pintu hidup, Supabase terbaca, MCP terdaftar di 4 klien.', rinci.join('\n'));
  },

  async D1(k) {
    const s = await k.sumber();
    const rusak = s.filter((x) => x.galat), hilang = s.filter((x) => !x.ada);
    const rinci = s.map((x) => `${x.galat ? '✗' : x.ada ? '✓' : '?'} ${x.nama}: ${x.galat || (x.ada ? `${x.ukuran} byte${x.jumlah != null ? `, ${x.jumlah} rekaman` : ''}` : 'tidak ada')}`);
    if (rusak.length) return h('Masalah', `${rusak.length} berkas data rusak/tidak terbaca.`, rinci.join('\n'));
    if (hilang.length) return h('Peringatan', `${hilang.length} berkas data tidak ditemukan.`, rinci.join('\n'));
    return h('OK', `Semua ${s.length} berkas data terbaca.`, rinci.join('\n'));
  },
  async D2(k) {
    const s = await k.sumber(), berkasJejak = path.join(AUDIT_DATA, 'jejak-data.json');
    const jejak = bacaJson(berkasJejak, {}), batas = Date.now() - 7 * 864e5, catat = [], peringatan = [], masalah = [];
    for (const x of s) {
      const lalu = (jejak[x.berkas] || []).filter((j) => j.t >= batas);
      const pernahAda = lalu.some((j) => j.ada);
      if (!x.ada) { if (pernahAda) masalah.push(`${x.nama}: berkas HILANG (terakhir terlihat ${tglLokal(Math.max(...lalu.filter((j) => j.ada).map((j) => j.t)))})`); }
      else {
        const maksJml = Math.max(-1, ...lalu.filter((j) => j.jumlah != null).map((j) => j.jumlah));
        const maksUk = Math.max(0, ...lalu.map((j) => j.ukuran || 0));
        if (x.jumlah != null && maksJml - x.jumlah >= 2 && x.jumlah < maksJml * 0.8) peringatan.push(`${x.nama}: rekaman turun ${maksJml} → ${x.jumlah} dalam 7 hari`);
        else if (maksUk > 1024 && x.ukuran < maksUk * 0.5) peringatan.push(`${x.nama}: ukuran turun ${maksUk} → ${x.ukuran} byte dalam 7 hari`);
      }
      catat.push([x.berkas, [...lalu, { t: Date.now(), ada: x.ada, ukuran: x.ukuran, jumlah: x.jumlah }].slice(-200)]);
    }
    if (!k.uji) { fs.mkdirSync(AUDIT_DATA, { recursive: true }); fs.writeFileSync(berkasJejak + '.tmp', JSON.stringify(Object.fromEntries(catat))); fs.renameSync(berkasJejak + '.tmp', berkasJejak); }
    const putaran = Math.max(0, ...Object.values(jejak).map((a) => a.length));
    if (masalah.length) return h('Masalah', `${masalah.length} berkas data hilang.`, [...masalah, ...peringatan].join('\n'));
    if (peringatan.length) return h('Peringatan', `${peringatan.length} berkas data menyusut tajam — cek apakah disengaja.`, peringatan.join('\n'));
    return h('OK', putaran ? `Tidak ada data hilang/menyusut dibanding 7 hari terakhir (${putaran} catatan per berkas).` : 'Jejak awal dicatat; perbandingan mulai putaran berikutnya.');
  },
  async D3(k) {
    let s; try { s = await k.sinkron(); } catch { return h('Peringatan', 'Status sinkron tidak terbaca; konsistensi tidak bisa dicek.'); }
    const masalah = [];
    const lap = (await k.sumber()).find((x) => x.nama.startsWith('Laporan guru'));
    const rek = (await k.sumber()).find((x) => x.nama === 'Rekap laporan guru');
    // Salinan Drive tidak pernah menghapus; Supabase bisa (tombol Hapus admin).
    if (lap?.jumlah != null && lap.jumlah < s.laporan) masalah.push(`Salinan Drive tertinggal: ${lap.jumlah} laporan, Supabase ${s.laporan}`);
    if (lap?.jumlah != null && lap.jumlah > s.laporan) masalah.push(`${lap.jumlah - s.laporan} laporan sudah tidak ada di Supabase (dihapus di website) tapi masih tersimpan di salinan Drive — pastikan penghapusannya disengaja (mis. data uji)`);
    if (lap?.ubah && rek?.ubah && lap.ubah > rek.ubah + 30 * 6e4) masalah.push(`rekap XLSX lebih tua dari laporan.json (${tglLokal(rek.ubah)} < ${tglLokal(lap.ubah)})`);
    let foto = 0;
    try { for (const n of await fsp.readdir(path.join(LAPORAN_GURU, 'Foto'), { recursive: true })) if (/\.(jpe?g|png|webp|heic|gif|mp4)$/i.test(n)) foto++; } catch {}
    if (typeof s.media === 'number' && foto < s.media) masalah.push(`foto di Drive ${foto}, menurut sinkron ${s.media} — ada foto hilang`);
    if (!masalah.length) return h('OK', `${s.laporan} laporan, ${foto} foto, rekap mutakhir — cocok.`);
    // Penghapusan di Supabase tidak bisa "diperbaiki" dengan sinkron ulang → jangan tawarkan tombol.
    const bisaSinkron = masalah.some((m) => !m.includes('dihapus di website'));
    return { ...h('Peringatan', `${masalah.length} ketidakcocokan laporan guru.`, masalah.join('\n')), ...(bisaSinkron ? {} : { perbaikan: false }) };
  },
  async D4() {
    const temu = (await cariTmp()).map((x) => `${x.p} (${tglLokal(x.t)})`);
    return temu.length ? h('Peringatan', `${temu.length} sisa tulis terputus.`, daftarRinci(temu)) : h('OK', 'Tidak ada sisa tulis terputus.');
  },
  async D5(k) {
    const cad = cadanganWaTerakhir();
    const aman = (x) => DI_DRIVE(x.berkas) || (x.berkas === WA_DB && cad && hari(cad.t) <= 26 / 24);
    const tanpa = (await k.sumber()).filter((x) => x.ada && !aman(x));
    const rinci = (await k.sumber()).filter((x) => x.ada).map((x) => `${DI_DRIVE(x.berkas) ? '✓ Drive (riwayat versi)'
      : x.berkas === WA_DB ? (cad ? `${aman(x) ? '✓' : '✗'} cadangan harian terakhir ${tglLokal(cad.t)} (${cad.f})` : '✗ TANPA cadangan') : '✗ TANPA cadangan'} — ${x.nama}`);
    rinci.push('ℹ Database Supabase & Firestore: cadangannya tidak bisa dicek dari PC ini.');
    return tanpa.length ? h('Peringatan', `${tanpa.length} data penting tanpa cadangan yang baru (≤ 1 hari).`, rinci.join('\n')) : h('OK', 'Semua data yang dijaga punya cadangan (Drive / cadangan harian).', rinci.join('\n'));
  },
  async D6() {
    const kotor = (await git('status', '--porcelain', '--untracked-files=normal')).split('\n').filter((l) => l && !/ audit-manajemen\//.test(l));
    let depan = [];
    try { depan = (await git('log', '--oneline', 'origin/main..HEAD')).split('\n').filter(Boolean); } catch {}
    if (!kotor.length && !depan.length) return h('OK', 'Semua kode aplikasi di repo sudah di-commit dan di-push.');
    return h('Peringatan', `${kotor.length} berkas aplikasi belum di-commit, ${depan.length} commit belum di-push.`, daftarRinci([...kotor, ...depan.map((d) => 'belum di-push: ' + d)]));
  },
  async D7() {
    const s = await fsp.statfs('C:\\');
    const sisa = s.bavail / s.blocks, gb = (s.bavail * s.bsize) / 1e9;
    return h(sisa < 0.1 ? 'Masalah' : sisa < 0.2 ? 'Peringatan' : 'OK', `Sisa ${gb.toFixed(1)} GB (${Math.round(sisa * 100)}%).`);
  },
};

// ---------- jalankan semua ----------
export async function jalankanSemua({ uji = false } = {}) {
  const k = buatKonteks({ uji }), mulai = Date.now();
  const hasil = {};
  await Promise.all(semuaButir().map(async (b) => {
    const t0 = Date.now(); let r;
    try {
      if (!CEK[b.id]) throw new Error('pemeriksaan belum diimplementasikan');
      r = await Promise.race([CEK[b.id](k), new Promise((_, gagal) => setTimeout(() => gagal(new Error('waktu habis (20 detik)')), 20000))]);
    } catch (e) { r = h('Masalah', `Cek error: ${e.message}`, 'Ini galat di checker sendiri — perlu diperbaiki.'); r.errorChecker = true; }
    hasil[b.id] = { ...r, ms: Date.now() - t0 };
  }));
  const keluaran = { waktu: new Date().toISOString(), durasiMs: Date.now() - mulai, hasil };
  if (!uji) {
    fs.mkdirSync(AUDIT_DATA, { recursive: true });
    const f = path.join(AUDIT_DATA, 'hasil-terakhir.json');
    fs.writeFileSync(f + '.tmp', JSON.stringify(keluaran, null, 1)); fs.renameSync(f + '.tmp', f);
  }
  return keluaran;
}
export const idCek = () => Object.keys(CEK);
