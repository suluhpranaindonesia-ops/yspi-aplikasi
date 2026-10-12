// Pemantau otomatis Audit Management Checker (berjalan di dalam server.mjs).
//
// Pemicu audit ulang:
// - Kode audit-manajemen/ berubah (git status, tiap 1 menit, tunggu stabil 1 putaran):
//   uji sintaks → bangun laporan → server uji di port 3476 (semua cek harus jalan tanpa error)
//   → bila lolos: commit + push, lalu server keluar supaya penjaga menyalakannya ulang.
// - Wiki vault berubah (tiap 5 menit, tunggu stabil 1 putaran).
// - Terjadwal tiap 1 jam, dan tombol "Audit ulang sekarang" di web.
// Berkas data\jeda = jangan commit/push otomatis (untuk menyunting berlama-lama).
// Tidak pernah push bila ada commit lain di luar audit-manajemen/ yang belum di-push
// (push yspi-vercel/ = deploy website). Riwayat: data\otomatis.json.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jalankanSemua, VAULT } from './cek.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const DATA = path.join(DIR, 'data');
const RIWAYAT = path.join(DATA, 'otomatis.json');
const JEDA = path.join(DATA, 'jeda');
const PORT_UJI = 3476;
const BERKAS_SERVER = ['server.mjs', 'cek.mjs', 'otomatis.mjs', 'butir.mjs']; // perubahan di sini perlu mulai ulang

const exec = promisify(execFile);
const git = async (...a) => (await exec('git', ['-C', ROOT, ...a], { maxBuffer: 20e6, windowsHide: true })).stdout;
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');
const log = (...a) => console.log(new Date().toISOString(), '[otomatis]', ...a);

const st = { kode: { calon: null, gagal: null }, wiki: { tanda: null, calon: null }, jalan: false, antre: null };

// ---------- tanda perubahan ----------
async function tandaKode() {
  const out = await git('status', '--porcelain', '--untracked-files=all', '--', 'audit-manajemen');
  const baris = out.split('\n').filter(Boolean);
  if (!baris.length) return '';
  return hash(baris.map((l) => {
    let m = '';
    try { m = fs.statSync(path.join(ROOT, l.slice(3).replace(/^"|"$/g, ''))).mtimeMs; } catch {}
    return `${l}|${m}`;
  }).join('\n'));
}
async function tandaWiki() {
  const akar = path.join(VAULT, 'wiki');
  const nama = (await fsp.readdir(akar, { recursive: true })).sort();
  const bag = [];
  for (const n of nama) {
    try { const s = await fsp.stat(path.join(akar, n)); if (s.isFile()) bag.push(`${n}|${s.mtimeMs}|${s.size}`); } catch {}
  }
  return hash(bag.join('\n'));
}

// ---------- riwayat ----------
function tulisJson(berkas, isi) { fs.writeFileSync(berkas + '.tmp', JSON.stringify(isi, null, 1)); fs.renameSync(berkas + '.tmp', berkas); }
function bacaRiwayat() { try { return JSON.parse(fs.readFileSync(RIWAYAT, 'utf8')).riwayat || []; } catch { return []; } }
export function riwayat() { return { aktif: true, jalan: st.jalan, jeda: fs.existsSync(JEDA), riwayat: bacaRiwayat().slice(0, 30) }; }

// ---------- uji kode ----------
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
async function ujiKode(langkah) {
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'))) {
    try { await exec(process.execPath, ['--check', f], { cwd: DIR, timeout: 30000, windowsHide: true }); }
    catch (e) { langkah('Sintaks ' + f, false, (e.stderr || e.message).slice(0, 600)); return false; }
  }
  langkah('Sintaks semua .mjs', true);

  const anak = spawn(process.execPath, ['server.mjs'], { cwd: DIR, env: { ...process.env, AUDIT_PORT: String(PORT_UJI), AUDIT_UJI: '1' }, windowsHide: true, stdio: 'ignore' });
  const dasar = `http://127.0.0.1:${PORT_UJI}`;
  try {
    let hidup = false;
    for (let i = 0; i < 20 && !hidup; i++) { await tunggu(500); hidup = await fetch(dasar + '/api/butir').then((r) => r.ok, () => false); }
    if (!hidup) { langkah('Server uji', false, `Port ${PORT_UJI} tidak menjawab dalam 10 detik`); return false; }
    const halaman = await (await fetch(dasar + '/')).text();
    if (!halaman.includes('<title>Audit Management Checker</title>')) { langkah('Halaman web', false, 'Judul halaman tidak ditemukan'); return false; }
    const { butir, status } = await (await fetch(dasar + '/api/butir')).json();
    const { hasil } = await (await fetch(dasar + '/api/cek', { signal: AbortSignal.timeout(60000) })).json();
    const masalah = [];
    if (!butir.length) masalah.push('daftar pemeriksaan kosong');
    if (new Set(butir.map((b) => b.id)).size !== butir.length) masalah.push('ID pemeriksaan ganda');
    for (const b of butir) {
      const r = hasil?.[b.id];
      if (!r) masalah.push(`${b.id} tidak menghasilkan apa pun`);
      else if (r.errorChecker) masalah.push(`${b.id} error: ${r.ringkas}`);
      else if (!status.includes(r.status)) masalah.push(`${b.id} status tidak sah "${r.status}"`);
    }
    if (masalah.length) { langkah('Semua pemeriksaan berjalan', false, masalah.slice(0, 10).join('; ')); return false; }
    langkah('Server uji (halaman + semua pemeriksaan)', true, `${butir.length} pemeriksaan berjalan tanpa error`);
  } catch (e) { langkah('Server uji', false, e.message); return false; }
  finally { anak.kill(); }

  try { await exec(process.execPath, ['bangun.mjs'], { cwd: DIR, timeout: 60000, windowsHide: true }); langkah('Bangun laporan md/xlsx', true); }
  catch (e) { langkah('Bangun laporan md/xlsx', false, (e.stderr || e.message).slice(0, 600)); return false; }
  return true;
}

// ---------- git ----------
const POLA_RAHASIA = [
  [/[\w.+-]+@(?!users\.noreply\.github\.com)[\w-]+\.[a-z]{2,}/i, 'alamat email'],
  [/\b(\+?62|08)\d{8,12}\b/, 'nomor HP'],
  [/Rp\s?\d/i, 'angka rupiah'],
  [/(password|sandi|token|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{6,}/i, 'sandi/token'],
];

async function commitKode(langkah) {
  if ((await git('rev-parse', '--abbrev-ref', 'HEAD')).trim() !== 'main') { langkah('Commit', false, 'Cabang aktif bukan main'); return false; }
  await git('add', '--', 'audit-manajemen');
  const tambah = (await git('diff', '--cached', '-U0', '--', 'audit-manajemen')).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  for (const [pola, nama] of POLA_RAHASIA) {
    const kena = tambah.find((l) => pola.test(l));
    if (kena) { await git('reset', '-q', '--', 'audit-manajemen'); langkah('Pemeriksaan isi', false, `Ada ${nama} di perubahan — tidak di-commit: ${kena.slice(0, 120)}`); return false; }
  }
  const berkas = (await git('diff', '--cached', '--name-only', '--', 'audit-manajemen')).trim().split('\n').filter(Boolean);
  if (!berkas.length) return true;
  await git('commit', '-q', '-m', `audit-manajemen: pembaruan otomatis (lolos uji)\n\nBerkas: ${berkas.join(', ')}\nDibuat pemantau audit-manajemen setelah uji sintaks, server uji, dan bangun laporan.`, '--', 'audit-manajemen');
  langkah('Commit', true, (await git('log', '--oneline', '-1')).trim());
  return berkas;
}

async function cobaPush() {
  const depan = (await git('rev-list', 'origin/main..HEAD')).split('\n').filter(Boolean);
  if (!depan.length) return '';
  for (const c of depan) {
    const luar = (await git('diff-tree', '--no-commit-id', '--name-only', '-r', c)).split('\n').filter((f) => f && !f.startsWith('audit-manajemen/'));
    if (luar.length) return `Tidak di-push: commit ${c.slice(0, 7)} menyentuh ${luar.slice(0, 3).join(', ')} — push manual`;
  }
  try { await git('push', 'origin', 'main'); return `Di-push ${depan.length} commit ke GitHub`; }
  catch (e) { return `Push gagal (dicoba lagi nanti): ${(e.stderr || e.message).trim().split('\n').pop()}`; }
}

// ---------- satu putaran audit ----------
async function audit(pemicu) {
  const catatan = { waktu: new Date().toISOString(), pemicu, hasil: 'OK', push: '-', langkah: [] };
  const langkah = (nama, ok, ket = '') => catatan.langkah.push({ nama, ok, ket });
  let mulaiUlang = false;
  try {
    const tanda = await tandaKode();
    if (tanda && fs.existsSync(JEDA)) langkah('Uji & push kode', true, 'Dilewati: data\\jeda ada (penyuntingan sedang berlangsung)');
    else if (tanda) {
      const lolos = await ujiKode(langkah);
      if (!lolos) { catatan.hasil = 'GAGAL'; catatan.push = 'Tidak di-push: uji gagal'; st.kode.gagal = tanda; }
      else {
        const berkas = await commitKode(langkah);
        if (!berkas) { catatan.hasil = 'GAGAL'; catatan.push = 'Tidak di-push'; st.kode.gagal = tanda; }
        else {
          catatan.push = (await cobaPush()) || 'Tidak ada yang perlu di-push';
          mulaiUlang = Array.isArray(berkas) && berkas.some((b) => BERKAS_SERVER.includes(path.basename(b)));
        }
      }
    } else if (!fs.existsSync(JEDA)) {
      const p = await cobaPush();
      if (p) catatan.push = p;
    }

    // Catat dulu hasil tahap kode supaya pemeriksaan A1 melihat putaran ini (ditandai sedang berjalan)
    tulisJson(RIWAYAT, { riwayat: [{ ...catatan, sedang: true }, ...bacaRiwayat()].slice(0, 200) });
    const { hasil } = await jalankanSemua();
    const hitung = { OK: 0, Peringatan: 0, Masalah: 0 };
    for (const r of Object.values(hasil)) hitung[r.status]++;
    const error = Object.entries(hasil).filter(([, r]) => r.errorChecker).map(([id]) => id);
    langkah('Pemeriksaan', !error.length, `${hitung.OK} OK · ${hitung.Peringatan} Peringatan · ${hitung.Masalah} Masalah${error.length ? ` · cek error: ${error.join(', ')}` : ''}`);
    catatan.hitung = hitung;
    try {
      await exec(process.execPath, ['bangun.mjs', '--ke-vault'], { cwd: DIR, timeout: 60000, windowsHide: true });
      langkah('Laporan md/xlsx diperbarui', true, 'DRAFT\\Audit Management Checker\\Laporan-Audit-Teknis-YSPI.md / .xlsx');
    } catch (e) { langkah('Laporan md/xlsx diperbarui', false, (e.stderr || e.message).slice(0, 400)); }
    if (catatan.hasil !== 'GAGAL') catatan.hasil = hitung.Masalah ? 'ADA MASALAH' : hitung.Peringatan ? 'PERINGATAN' : 'OK';
  } catch (e) { catatan.hasil = 'GAGAL'; langkah('Galat', false, e.message); }

  const r = bacaRiwayat().filter((x) => !(x.sedang && x.waktu === catatan.waktu));
  r.unshift(catatan); tulisJson(RIWAYAT, { riwayat: r.slice(0, 200) });
  log(pemicu, catatan.hasil, catatan.push);
  if (mulaiUlang) { log('kode server berubah — keluar agar penjaga menyalakan ulang'); setTimeout(() => process.exit(0), 1500); }
}

export async function jalankan(pemicu) {
  if (st.jalan) { st.antre = pemicu; return; }
  st.jalan = true;
  try { await audit(pemicu); } finally { st.jalan = false; }
  if (st.antre) { const p = st.antre; st.antre = null; jalankan(p); }
}

async function putarKode() {
  const t = await tandaKode();
  if (!t || fs.existsSync(JEDA)) { st.kode.calon = null; return; }
  if (t === st.kode.gagal) return;            // isi sama dengan yang sudah gagal; tunggu suntingan berikutnya
  if (t !== st.kode.calon) { st.kode.calon = t; return; } // tunggu stabil satu putaran
  st.kode.calon = null;
  jalankan('kode berubah');
}
async function putarWiki() {
  const t = await tandaWiki();
  if (st.wiki.tanda === null) { st.wiki.tanda = t; return; }
  if (t === st.wiki.tanda) { st.wiki.calon = null; return; }
  if (t !== st.wiki.calon) { st.wiki.calon = t; return; }
  st.wiki.tanda = t; st.wiki.calon = null;
  jalankan('wiki berubah');
}

export function mulai() {
  fs.mkdirSync(DATA, { recursive: true });
  const aman = (f) => () => f().catch((e) => log('galat putaran:', e.message));
  setTimeout(() => jalankan('server mulai'), 60_000);
  setInterval(aman(putarKode), 60_000);
  aman(putarWiki)();
  setInterval(aman(putarWiki), 5 * 60_000);
  setInterval(() => jalankan('terjadwal (tiap jam)'), 60 * 60_000);
  log('pemantau aktif: kode tiap 1 menit, wiki tiap 5 menit, audit penuh tiap jam');
}
