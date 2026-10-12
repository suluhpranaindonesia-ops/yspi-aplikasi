// Pemantau otomatis Audit Management Checker (berjalan di dalam server.mjs).
//
// - Kode audit-manajemen/ berubah (git status, dicek tiap 1 menit, tunggu stabil 1 putaran):
//   uji sintaks → bangun md/xlsx → server uji di port 3476 → bila lolos: commit + push,
//   lalu server keluar supaya penjaga menyalakannya ulang dengan kode baru.
// - Wiki vault berubah (dicek tiap 5 menit, tunggu stabil 1 putaran):
//   cek sistem + rujukan wiki dijalankan ulang, hasilnya masuk sesi "Audit otomatis".
// Riwayat: data\otomatis.json. Tidak pernah push bila ada commit lain di luar
// audit-manajemen/ yang belum di-push (push yspi-vercel/ = deploy website).

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cekSistem, VAULT } from './cek.mjs';
import { semuaButir } from './butir.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const DATA = path.join(DIR, 'data');
const RIWAYAT = path.join(DATA, 'otomatis.json');
const SESI = path.join(DATA, 'audit-otomatis.json');
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

// ---------- penyimpanan ----------
function tulisJson(berkas, isi) { fs.writeFileSync(berkas + '.tmp', JSON.stringify(isi, null, 1)); fs.renameSync(berkas + '.tmp', berkas); }
function bacaRiwayat() { try { return JSON.parse(fs.readFileSync(RIWAYAT, 'utf8')).riwayat || []; } catch { return []; } }
export function riwayat() { return { aktif: true, jalan: st.jalan, riwayat: bacaRiwayat().slice(0, 30) }; }

function simpanSesiOtomatis(hasil) {
  let s;
  try { s = JSON.parse(fs.readFileSync(SESI, 'utf8')); }
  catch { s = { id: 'otomatis', judul: 'Audit otomatis (diperbarui sendiri)', pemeriksa: 'Pemantau audit-manajemen', periode: 'berjalan', jawaban: {} }; }
  const cap = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  for (const b of semuaButir()) {
    if (b.cek && hasil[b.cek]) s.jawaban[b.id] = { ...(s.jawaban[b.id] || {}), status: hasil[b.cek].status, buktiDilihat: `[Otomatis ${cap}]\n${hasil[b.cek].bukti}` };
  }
  s.diubah = new Date().toISOString();
  tulisJson(SESI, s);
}

// ---------- uji kode ----------
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
async function ujiKode(langkah) {
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'))) {
    try { await exec(process.execPath, ['--check', f], { cwd: DIR, timeout: 30000, windowsHide: true }); }
    catch (e) { langkah('Sintaks ' + f, false, (e.stderr || e.message).slice(0, 600)); return false; }
  }
  langkah('Sintaks semua .mjs', true);
  try { await exec(process.execPath, ['bangun.mjs'], { cwd: DIR, timeout: 60000, windowsHide: true }); langkah('Bangun md/xlsx', true); }
  catch (e) { langkah('Bangun md/xlsx', false, (e.stderr || e.message).slice(0, 600)); return false; }

  const anak = spawn(process.execPath, ['server.mjs'], { cwd: DIR, env: { ...process.env, AUDIT_PORT: String(PORT_UJI), AUDIT_UJI: '1' }, windowsHide: true, stdio: 'ignore' });
  const dasar = `http://127.0.0.1:${PORT_UJI}`;
  try {
    let hidup = false;
    for (let i = 0; i < 20 && !hidup; i++) { await tunggu(500); hidup = await fetch(dasar + '/api/butir').then((r) => r.ok, () => false); }
    if (!hidup) { langkah('Server uji', false, `Port ${PORT_UJI} tidak menjawab dalam 10 detik`); return false; }
    const halaman = await (await fetch(dasar + '/')).text();
    if (!halaman.includes('<title>Audit Management Checker</title>')) { langkah('Halaman web', false, 'Judul halaman tidak ditemukan'); return false; }
    const { butir } = await (await fetch(dasar + '/api/butir')).json();
    const { hasil } = await (await fetch(dasar + '/api/cek')).json();
    const masalah = [];
    if (!butir.length) masalah.push('daftar butir kosong');
    const id = butir.map((b) => b.id);
    if (new Set(id).size !== id.length) masalah.push('ID butir ganda');
    for (const b of butir) {
      if (!b.kriteria) masalah.push(`${b.id} tanpa kriteria`);
      if (!['vault', 'umum'].includes(b.dasar)) masalah.push(`${b.id} dasar "${b.dasar}" tidak sah`);
      if (b.cek && !hasil?.[b.cek]) masalah.push(`${b.id} memakai cek "${b.cek}" yang tidak ada`);
    }
    if (masalah.length) { langkah('Isi butir', false, masalah.slice(0, 10).join('; ')); return false; }
    langkah('Server uji (halaman, butir, cek)', true, `${butir.length} butir`);
    return true;
  } catch (e) { langkah('Server uji', false, e.message); return false; }
  finally { anak.kill(); }
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
  await git('commit', '-q', '-m', `audit-manajemen: pembaruan otomatis (lolos uji)\n\nBerkas: ${berkas.join(', ')}\nDibuat pemantau audit-manajemen setelah uji sintaks, bangun md/xlsx, dan server uji.`, '--', 'audit-manajemen');
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
    const { hasil } = await cekSistem();
    simpanSesiOtomatis(hasil);
    langkah('Cek sistem → sesi "Audit otomatis"', true, Object.entries(hasil).map(([k, v]) => `${k}: ${v.status}`).join(' · '));
    if (hasil.rujukan?.status !== 'Memenuhi') { langkah('Rujukan wiki', false, hasil.rujukan?.bukti || ''); catatan.hasil = 'PERINGATAN'; }

    const tanda = await tandaKode();
    if (tanda) {
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
    } else {
      const p = await cobaPush();
      if (p) catatan.push = p;
    }
  } catch (e) { catatan.hasil = 'GAGAL'; langkah('Galat', false, e.message); }

  const r = bacaRiwayat(); r.unshift(catatan); tulisJson(RIWAYAT, { riwayat: r.slice(0, 100) });
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
  if (!t) { st.kode.calon = null; return; }
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
  log('pemantau aktif: kode tiap 1 menit, wiki tiap 5 menit');
}
