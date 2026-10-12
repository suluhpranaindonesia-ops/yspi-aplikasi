// Pintu laporan guru - server MCP (stdio) untuk Claude Desktop, Claude Code, DSH, dan Codex.
// Alatnya sama persis dengan HTTP lokal (inti.mjs): daftar_laporan, lihat_laporan,
// ringkasan_laporan, ubah_laporan.
//
// Tanpa SDK, mengikuti wa-mcp.mjs: protokol stdio MCP cuma JSON-RPC per baris, jadi server
// ini tidak ikut rusak bila SDK di klien berganti versi. stdout HANYA untuk JSON-RPC;
// catatan ke stderr.
import readline from 'node:readline';
import { ALAT, jalankanAlat } from './inti.mjs';
import { sensor } from '../supabase-baca.mjs';

const VERSI_PROTOKOL = '2025-06-18';
const balas = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
const galat = (id, code, message) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');

const baris = readline.createInterface({ input: process.stdin });
baris.on('line', async (teks) => {
  let m;
  try { m = JSON.parse(teks); } catch { return; }
  const { id, method, params = {} } = m;
  if (id === undefined) return; // notifikasi (mis. notifications/initialized)
  try {
    if (method === 'initialize') return balas(id, {
      protocolVersion: params.protocolVersion || VERSI_PROTOKOL,
      capabilities: { tools: {} },
      serverInfo: { name: 'laporan-guru', version: '1.0.0' },
      instructions: 'Laporan guru YSPI dari Supabase "Pelaporan Guru YSPI". Nomor HP tidak pernah ditampilkan. ubah_laporan hanya untuk laporan yang belum Disetujui; ubah hanya yang tertulis di sumber.',
    });
    if (method === 'ping') return balas(id, {});
    if (method === 'tools/list') return balas(id, {
      tools: ALAT.map((a) => ({ ...a, annotations: a.name === 'ubah_laporan' ? { readOnlyHint: false, destructiveHint: false } : { readOnlyHint: true } })),
    });
    if (method === 'tools/call') {
      try {
        const hasil = await jalankanAlat(params.name, params.arguments || {});
        return balas(id, { content: [{ type: 'text', text: JSON.stringify(hasil, null, 2) }] });
      } catch (e) {
        return balas(id, { content: [{ type: 'text', text: 'Gagal: ' + sensor(e.message) }], isError: true });
      }
    }
    galat(id, -32601, 'Metode tidak dikenal: ' + method);
  } catch (e) {
    galat(id, -32603, sensor(e.message));
  }
});
