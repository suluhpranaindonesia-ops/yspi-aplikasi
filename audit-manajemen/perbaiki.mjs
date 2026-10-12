// Perbaikan sekali klik untuk temuan web, layanan & data (bukan wiki — keputusan pengguna 12 Okt 2026).
// Tiap perbaikan: { label, jalankan: async () => ({ ok, pesan, rinci? }) }. Klik pengguna = persetujuan.
// Tidak ada yang DIHAPUS: berkas .tmp dipindah ke karantina, cadangan tidak dirotasi.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { KERJA, WA_DB, CADANGAN_WA, POLA_RAHASIA, cekPort, cariTmp } from './cek.mjs';
import { semuaButir } from './butir.mjs';

const exec = promisify(execFile);
const git = async (...a) => (await exec('git', ['-C', KERJA, ...a], { maxBuffer: 20e6, windowsHide: true })).stdout;
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const KARANTINA = path.join(KERJA, 'audit-manajemen', 'data', 'karantina');
const PENJAGA_LOG = 'C:\\Users\\suluh\\.dsh\\penjaga.log';
const stempel = () => new Date(Date.now() + 7 * 36e5).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // WIB

async function penjagaHidup() {
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "@(Get-CimInstance Win32_Process -Filter \"Name='pwsh.exe' OR Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'dsh-penjaga' }).Count"], { timeout: 15000, windowsHide: true });
  return (parseInt(stdout.trim(), 10) || 0) > 0;
}
async function sinkronUlang() {
  const dasar = 'http://127.0.0.1:3463';
  const awal = await (await fetch(dasar + '/status', { signal: AbortSignal.timeout(3000) })).json();
  await fetch(dasar + '/sinkron', { method: 'POST', signal: AbortSignal.timeout(3000) });
  for (let i = 0; i < 40; i++) {
    await tunggu(3000);
    const s = await (await fetch(dasar + '/status', { signal: AbortSignal.timeout(3000) })).json();
    if (!s.jalan && s.terakhir !== awal.terakhir) {
      return s.galat ? { ok: false, pesan: `Sinkron berjalan tapi galat: ${s.galat}` }
        : { ok: true, pesan: `Sinkron ulang selesai: ${s.laporan} laporan, ${s.media} media (${s.baru} baru, ${s.diubah} diubah, ${s.mediaBaru} media baru).` };
    }
  }
  return { ok: false, pesan: 'Sinkron belum selesai setelah 2 menit — lihat laporan-guru\\data\\sinkron.log.' };
}

export async function cadangkanWa() {
  fs.mkdirSync(CADANGAN_WA, { recursive: true });
  const nama = `wa-${stempel()}.db`, tujuan = path.join(CADANGAN_WA, nama);
  const db = new DatabaseSync(WA_DB, { readOnly: true });
  try { await backup(db, tujuan + '.tmp'); } finally { db.close(); }
  const uji = new DatabaseSync(tujuan + '.tmp', { readOnly: true });
  let cek; try { cek = uji.prepare('PRAGMA quick_check').get(); } finally { uji.close(); }
  const hasil = Object.values(cek)[0];
  if (hasil !== 'ok') return { ok: false, pesan: `Salinan wa.db tidak lolos pemeriksaan (${hasil}); tidak dipakai sebagai cadangan.` };
  fs.renameSync(tujuan + '.tmp', tujuan);
  return { ok: true, pesan: `Cadangan dibuat & diperiksa utuh: cadangan\\wa-konsol\\${nama} (${(fs.statSync(tujuan).size / 1e6).toFixed(1)} MB).` };
}

export const PERBAIKI = {
  A2: { label: 'Jalankan audit sekarang', jalankan: async () => ({ ok: true, pesan: 'Audit dijalankan ulang.' }) },
  A3: { label: 'Uji & push kode checker', jalankan: async () => ({ ok: true, pesan: 'Pemantau menguji dan mem-push kode checker pada audit berikut.' }) },

  C1: {
    label: 'Nyalakan layanan yang mati',
    async jalankan() {
      const { layanan } = JSON.parse(fs.readFileSync(path.join(KERJA, 'penjaga.json'), 'utf8'));
      let mati = [];
      for (const l of layanan) if (!(await cekPort(l.port))) mati.push(l);
      if (!mati.length) return { ok: true, pesan: 'Semua layanan sudah hidup.' };
      // Bila penjaga hidup, biarkan ia yang menyalakan (menyalakan sendiri bisa membuat dua salinan,
      // mis. dua penghubung #laporan = balasan ganda). Bila penjaga mati, nyalakan peluncurnya langsung.
      const adaPenjaga = await penjagaHidup();
      if (!adaPenjaga) for (const l of mati) spawn('cmd.exe', ['/c', `start "" /min "${l.peluncur}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
      for (let i = 0; i < 15 && mati.length; i++) { await tunggu(3000); const sisa = []; for (const l of mati) if (!(await cekPort(l.port))) sisa.push(l); mati = sisa; }
      if (!mati.length) return { ok: true, pesan: `Semua layanan hidup kembali${adaPenjaga ? ' (dinyalakan penjaga)' : ' (dinyalakan langsung karena penjaga mati)'}.` };
      let log = ''; try { log = fs.readFileSync(PENJAGA_LOG, 'utf8').split(/\r?\n/).filter((b) => mati.some((l) => b.includes(l.nama))).slice(-6).join('\n'); } catch {}
      return { ok: false, pesan: `${mati.length} layanan tetap mati setelah 45 detik: ${mati.map((l) => `${l.port} ${l.nama}`).join(', ')}. Jalankan peluncurnya manual untuk melihat galatnya.`, rinci: log };
    },
  },

  C4: {
    label: 'Nyalakan ulang Konsol WhatsApp',
    async jalankan() {
      // Sama dengan alat konsol_mulai_ulang: periksa sintaks dulu, hentikan peluncur, penjaga menyalakan ulang.
      const folder = 'C:\\Users\\suluh\\wa-konsol';
      for (const n of fs.readdirSync(folder).filter((n) => n.endsWith('.mjs'))) {
        try { await exec(process.execPath, ['--check', path.join(folder, n)], { windowsHide: true }); }
        catch (e) { return { ok: false, pesan: `Dibatalkan: ${n} tidak lolos pemeriksaan sintaks — konsol tidak disentuh.`, rinci: String(e.stderr || e.message).slice(0, 1500) }; }
      }
      const ps = "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*wa-konsol\\jalan.cmd*' } | ForEach-Object { $_.ProcessId }";
      const pid = (await exec('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true })).stdout.split(/\s+/).filter(Boolean);
      if (!pid.length) return { ok: false, pesan: 'Peluncur Konsol WhatsApp tidak ditemukan; penjaga mungkin sedang menyalakannya — coba lagi sebentar.' };
      for (const p of pid) await exec('taskkill', ['/PID', p, '/T', '/F'], { windowsHide: true }).catch(() => {});
      const mulai = Date.now(); await tunggu(5000);
      while (Date.now() - mulai < 150000) {
        try {
          const s = await (await fetch('http://127.0.0.1:3458/api/status', { signal: AbortSignal.timeout(3000) })).json();
          if (s.koneksi === 'tersambung') return { ok: true, pesan: `Konsol WhatsApp tersambung lagi dalam ${Math.round((Date.now() - mulai) / 1000)} detik.` };
        } catch {}
        await tunggu(3000);
      }
      return { ok: false, pesan: 'Konsol belum tersambung setelah 150 detik — mungkin perlu memindai QR di http://127.0.0.1:3458.' };
    },
  },

  C5: { label: 'Sinkron ulang sekarang', jalankan: sinkronUlang },
  D3: { label: 'Sinkron ulang laporan guru', jalankan: sinkronUlang },

  D4: {
    label: 'Pindahkan sisa .tmp ke karantina',
    async jalankan() {
      const temu = await cariTmp();
      if (!temu.length) return { ok: true, pesan: 'Tidak ada sisa tulis terputus.' };
      const ke = path.join(KARANTINA, stempel()); fs.mkdirSync(ke, { recursive: true });
      const pindah = [];
      for (const { p } of temu) {
        const tujuan = path.join(ke, p.replace(/^[A-Za-z]:\\/, '').replace(/[\\/]/g, '__'));
        try { fs.renameSync(p, tujuan); } catch { fs.copyFileSync(p, tujuan); fs.unlinkSync(p); }
        pindah.push(`${p} → ${tujuan}`);
      }
      return { ok: true, pesan: `${pindah.length} berkas dipindah ke karantina (tidak dihapus).`, rinci: pindah.join('\n') };
    },
  },

  D5: { label: 'Buat cadangan wa.db sekarang', jalankan: cadangkanWa },

  D6: {
    label: 'Commit & push kode aplikasi',
    async jalankan() {
      if ((await git('rev-parse', '--abbrev-ref', 'HEAD')).trim() !== 'main') return { ok: false, pesan: 'Cabang aktif bukan main — tidak di-commit.' };
      await git('add', '-A');
      const berkas = (await git('diff', '--cached', '--name-only')).trim().split('\n').filter(Boolean);
      if (berkas.length) {
        const tambah = (await git('diff', '--cached', '-U0')).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
        for (const [pola, nama] of POLA_RAHASIA) {
          const kena = tambah.find((l) => pola.test(l));
          if (kena) { await git('reset', '-q'); return { ok: false, pesan: `Dibatalkan: ada ${nama} di perubahan — tidak di-commit. Periksa dulu berkasnya.`, rinci: kena.slice(0, 200) }; }
        }
        const app = [...new Set(berkas.map((b) => b.split('/')[0]))];
        await git('commit', '-q', '-m', `${app.join(', ')}: simpan perubahan (perbaikan sekali klik)\n\nBerkas: ${berkas.join(', ')}\nDi-commit dari tombol Perbaiki di Audit Management Checker.`);
      }
      const depan = (await git('rev-list', 'origin/main..HEAD')).split('\n').filter(Boolean);
      if (!depan.length) return { ok: true, pesan: 'Tidak ada yang perlu di-commit atau di-push.' };
      try { await git('push', 'origin', 'main'); }
      catch (e) { return { ok: false, pesan: 'Commit dibuat tapi push gagal — dicoba lagi pada klik berikutnya.', rinci: (e.stderr || e.message).trim() }; }
      const vercel = berkas.some((b) => b.startsWith('yspi-vercel/'));
      return { ok: true, pesan: `${berkas.length} berkas di-commit, ${depan.length} commit di-push ke GitHub.${vercel ? ' yspi-vercel ikut → Vercel men-deploy website pelaporan.' : ''}`, rinci: berkas.join('\n') };
    },
  },
};

// Kunci perbaikan harus cocok dengan ID pemeriksaan (gagal = server tidak mau jalan = uji kode gagal).
const id = new Set(semuaButir().map((b) => b.id));
for (const k of Object.keys(PERBAIKI)) if (!id.has(k)) throw new Error(`perbaiki.mjs: ID ${k} tidak ada di butir.mjs`);
