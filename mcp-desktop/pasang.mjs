// Pasang server MCP lokal ke Claude Desktop SETELAH Desktop ditutup.
//
// Kenapa menunggu: Claude Desktop menulis ulang claude_desktop_config.json dari salinan di
// memorinya saat masih terbuka, sehingga suntingan dari luar hilang. Itu yang menghapus
// jembatan-claude (dipasang 10 Okt) dan laporan-guru (dipasang 12 Okt 15.19, hilang 15.20).
//
// Pakai: klik dua kali pasang.cmd, lalu keluar dari Claude Desktop sepenuhnya
// (termasuk ikon di tray). Setelah skrip bilang selesai, buka Desktop lagi.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CFG = path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
const SPI = 'C:/Users/suluh/My Drive/SPI-Kerja';
const SERVER = {
  'jembatan-claude': { command: 'node', args: [SPI + '/jembatan-claude/server.mjs'] },
  'laporan-guru': { command: 'node', args: [SPI + '/laporan-guru/pintu/mcp.mjs'] },
};

const desktopHidup = () => {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Claude.exe', '/NH'], { encoding: 'utf8' });
  return /Claude\.exe/i.test(out);
};

for (const [nama, s] of Object.entries(SERVER))
  if (!fs.existsSync(s.args[0])) { console.error(`Berkas server ${nama} tidak ada: ${s.args[0]}`); process.exit(1); }

if (desktopHidup()) {
  console.log('Menunggu Claude Desktop ditutup... (keluar juga dari ikon di tray)');
  while (desktopHidup()) await new Promise((r) => setTimeout(r, 2000));
  await new Promise((r) => setTimeout(r, 3000)); // beri waktu Desktop selesai menulis berkasnya
}

const asli = fs.readFileSync(CFG, 'utf8');
const c = JSON.parse(asli);
const cadangan = CFG + '.bak-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + '-pasang-mcp';
fs.writeFileSync(cadangan, asli);
c.mcpServers = { ...(c.mcpServers || {}), ...SERVER };
fs.writeFileSync(CFG + '.tmp', JSON.stringify(c, null, 2) + '\n');
fs.renameSync(CFG + '.tmp', CFG);

const cek = JSON.parse(fs.readFileSync(CFG, 'utf8'));
console.log('Terpasang:', Object.keys(cek.mcpServers).join(', '));
console.log('Cadangan :', cadangan);
console.log('Selesai. Silakan buka Claude Desktop lagi.');
