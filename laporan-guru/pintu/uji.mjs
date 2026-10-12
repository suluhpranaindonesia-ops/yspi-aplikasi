// Uji pintu laporan guru tanpa menyentuh Supabase: data palsu disuntikkan.
// Pakai: node uji.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pintu-uji-'));
process.env.PINTU_LOG_UBAH = path.join(dir, 'ubah.jsonl');
const i = await import('./inti.mjs');

const rows = [
  { id: 'a', name: 'Bu Rina', phone: 'HP-RAHASIA-A', school: 'SD Lentera', region: 'Bogor', date: '2026-10-01', students: 12, activity: 'Membaca nyaring', impact: 'Anak berani bercerita', challenge: '', raw: '#cerita ...', status: 'review', issue_status: null, jenis: 'cerita', created_at: '2026-10-01T01:00:00Z', funds_received: 100000, funds_used: 50000 },
  { id: 'b', name: 'Pak Budi', phone: 'HP-RAHASIA-B', school: 'SMP Kasih', region: 'Depok', date: '2026-09-20', students: null, activity: 'Latihan pecahan', impact: '', challenge: 'Listrik padam', raw: '#jejak ...', status: 'approved', issue_status: 'open', jenis: 'jejak', created_at: '2026-09-20T01:00:00Z' },
];
const media = [{ id: 'm1', report_id: 'a' }];
const ambil = async (t) => structuredClone(t === 'yspi_media' ? media : rows);

// Baca
const d = await i.daftar({}, { segar: true, ambil });
assert.equal(d.jumlah, 2); assert.equal(d.laporan[0].id, 'a', 'terbaru dulu');
assert.ok(!JSON.stringify(d).includes('HP-RAHASIA'), 'nomor HP tidak boleh keluar');
assert.ok(!('pesan_asli' in d.laporan[0]), 'raw hanya bila mentah');
assert.equal(d.laporan[0].jumlah_foto, 1);
assert.equal((await i.daftar({ jenis: 'jejak' }, { segar: true, ambil })).jumlah, 1);
assert.equal((await i.daftar({ cari: 'listrik' }, { segar: true, ambil })).laporan[0].id, 'b');
assert.equal((await i.daftar({ sekolah: 'lentera' }, { segar: true, ambil })).jumlah, 1);
assert.equal((await i.daftar({ sejak: '2026-09-25' }, { segar: true, ambil })).jumlah, 1);
assert.equal((await i.satu('a', { mentah: true, segar: true, ambil })).pesan_asli, '#cerita ...');
const r = await i.ringkasan({ segar: true, ambil });
assert.equal(r.total_laporan, 2); assert.equal(r.kendala_terbuka, 1); assert.equal(r.total_siswa_disebut, 12); assert.equal(r.per_status_periksa.Disetujui, 1);

// Ubah
let ditulis = null;
const tulis = async (id, kolom) => { ditulis = { id, kolom }; return [{ ...rows.find((x) => x.id === id), ...kolom }]; };
const h = await i.ubah('a', { dampak: 'Anak berani bercerita di depan kelas', siswa: 14 }, { oleh: 'uji', alasan: 'koreksi', tulis, ambil });
assert.equal(h.ok, true); assert.deepEqual(ditulis.kolom, { impact: 'Anak berani bercerita di depan kelas', students: 14 });
const log = fs.readFileSync(process.env.PINTU_LOG_UBAH, 'utf8').trim().split('\n').map(JSON.parse);
assert.equal(log.length, 1); assert.equal(log[0].sebelum.students, 12); assert.equal(log[0].oleh, 'uji');

await assert.rejects(i.ubah('b', { dampak: 'x' }, { oleh: 'uji', tulis, ambil }), /Disetujui/);
await assert.rejects(i.ubah('a', { status: 'approved' }, { oleh: 'uji', tulis, ambil }), /tidak boleh/);
await assert.rejects(i.ubah('a', { phone: 'HP-BARU' }, { oleh: 'uji', tulis, ambil }), /tidak boleh/);
await assert.rejects(i.ubah('a', { dampak: 'x' }, { tulis, ambil }), /oleh/);
await assert.rejects(i.ubah('a', { siswa: -3 }, { oleh: 'uji', tulis, ambil }), /angka/);
await assert.rejects(i.ubah('a', { tanggal: '1 Okt' }, { oleh: 'uji', tulis, ambil }), /YYYY/);
await assert.rejects(i.ubah('zzz', { dampak: 'x' }, { oleh: 'uji', tulis, ambil }), /tidak ditemukan/);
await assert.rejects(i.ubah('a', { dampak: 'x' }, { oleh: 'uji', tulis: async () => [], ambil }), /Tidak ada baris/);

// MCP: initialize + tools/list lewat stdio sungguhan.
const AKAR = path.dirname(fileURLToPath(import.meta.url));
const mcp = spawn(process.execPath, [path.join(AKAR, 'mcp.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });
const jawaban = [];
mcp.stdout.on('data', (x) => jawaban.push(...String(x).trim().split('\n').map(JSON.parse)));
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) + '\n');
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ubah_laporan', arguments: { id: 'a', perubahan: { status: 'x' }, oleh: 'uji', alasan: 'x' } } }) + '\n');
for (let n = 0; n < 50 && jawaban.length < 3; n++) await new Promise((r) => setTimeout(r, 100));
mcp.kill();
assert.equal(jawaban.find((j) => j.id === 1).result.serverInfo.name, 'laporan-guru');
assert.deepEqual(jawaban.find((j) => j.id === 2).result.tools.map((t) => t.name), ['daftar_laporan', 'lihat_laporan', 'ringkasan_laporan', 'ubah_laporan']);
assert.equal(jawaban.find((j) => j.id === 3).result.isError, true);

fs.rmSync(dir, { recursive: true, force: true });
console.log('Semua uji pintu laporan guru LULUS.');
