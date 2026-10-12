// Pasang server MCP lokal ke Claude Desktop: tutup Desktop, tulis pengaturan, buka lagi, periksa.
//
// Kenapa Desktop harus tertutup: selama terbuka, Claude Desktop menulis ulang
// claude_desktop_config.json dari salinan di memorinya, sehingga suntingan dari luar hilang.
// Itu yang menghapus jembatan-claude (10 Okt) dan laporan-guru (12 Okt 15.19 → hilang 15.20).
//
// Riwayat percobaan 12 Okt: (1) dijalankan dari dalam sesi Claude → ikut mati; (2) menunggu
// pengguna menutup Desktop → yang tertutup hanya jendelanya (Desktop tetap hidup di tray sejak
// 10 Okt), lalu proses node ini ikut di-End task karena tampil sebagai "Node.js". Maka sekarang
// skrip ini sendiri yang menutup dan membuka Desktop; pengguna cukup klik dua kali pasang.cmd.
//
// Yang dihitung "Desktop" hanya claude.exe di %LOCALAPPDATA%\AnthropicClaude\app-*; claude.exe
// lain (CLI Claude Code, Agent SDK jembatan) bukan Desktop.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CFG = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pasang.log');
const PELUNCUR = path.join(process.env.LOCALAPPDATA, 'AnthropicClaude', 'claude.exe');
const SPI = 'C:/Users/suluh/My Drive/SPI-Kerja';
const SERVER = {
  'jembatan-claude': { command: 'node', args: [SPI + '/jembatan-claude/server.mjs'] },
  'laporan-guru': { command: 'node', args: [SPI + '/laporan-guru/pintu/mcp.mjs'] },
};
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const catat = (s) => { const b = `${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })}  ${s}`; console.log(b); fs.appendFileSync(LOG, b + '\n'); };
const ps = (cmd) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', windowsHide: true }).trim();
// PID claude.exe milik Desktop yang paling atas (induknya bukan claude.exe Desktop).
const pidDesktop = () => ps(`$d = @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Where-Object { $_.ExecutablePath -like '*\\AnthropicClaude\\app-*' }); $ids = $d.ProcessId; @($d | Where-Object { $ids -notcontains $_.ParentProcessId }).ProcessId -join ','`).split(',').filter(Boolean).map(Number);
const terpasang = () => { try { const m = JSON.parse(fs.readFileSync(CFG, 'utf8')).mcpServers || {}; return Object.keys(SERVER).filter((k) => m[k]); } catch { return []; } };

try {
  catat(`mulai (pid ${process.pid})`);
  for (const [nama, s] of Object.entries(SERVER))
    if (!fs.existsSync(s.args[0])) { catat(`GAGAL: berkas server ${nama} tidak ada: ${s.args[0]}`); process.exit(1); }

  // 1. Tutup Desktop: minta tutup baik-baik dulu, paksa bila 20 detik belum tertutup.
  let pid = pidDesktop();
  if (pid.length) {
    catat(`menutup Claude Desktop (pid ${pid.join(', ')})`);
    for (const p of pid) try { execFileSync('taskkill', ['/PID', String(p), '/T'], { windowsHide: true, stdio: 'ignore' }); } catch {}
    for (let i = 0; i < 10 && pidDesktop().length; i++) await tidur(2000);
    pid = pidDesktop();
    if (pid.length) {
      catat('belum tertutup, dipaksa');
      for (const p of pid) try { execFileSync('taskkill', ['/PID', String(p), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
      for (let i = 0; i < 10 && pidDesktop().length; i++) await tidur(1000);
    }
    if (pidDesktop().length) { catat('GAGAL: Claude Desktop tidak bisa ditutup'); process.exit(1); }
    catat('Desktop tertutup');
    await tidur(3000); // beri waktu Desktop selesai menulis berkasnya
  }

  // 2. Tulis pengaturan (cadangan dulu).
  const asli = fs.readFileSync(CFG, 'utf8');
  const c = JSON.parse(asli);
  const cadangan = CFG + '.bak-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + '-pasang-mcp';
  fs.writeFileSync(cadangan, asli);
  c.mcpServers = { ...(c.mcpServers || {}), ...SERVER };
  fs.writeFileSync(CFG + '.tmp', JSON.stringify(c, null, 2) + '\n');
  fs.renameSync(CFG + '.tmp', CFG);
  catat(`ditulis: ${terpasang().join(', ')} (cadangan ${path.basename(cadangan)})`);

  // 3. Buka Desktop lagi.
  spawn(PELUNCUR, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  catat('Claude Desktop dibuka lagi');
  for (let i = 0; i < 30 && !pidDesktop().length; i++) await tidur(2000);

  // 4. Bukti: setelah 2 menit Desktop berjalan, pendaftaran harus masih ada.
  await tidur(120_000);
  const akhir = terpasang();
  catat(akhir.length === Object.keys(SERVER).length ? `BERHASIL: tetap terpasang setelah Desktop dibuka (${akhir.join(', ')})` : `DITIMPA Desktop: yang tersisa [${akhir.join(', ')}]`);
} catch (e) {
  catat('GAGAL: ' + e.message);
  process.exit(1);
}
