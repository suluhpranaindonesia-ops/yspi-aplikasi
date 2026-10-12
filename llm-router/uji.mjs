// Uji router tanpa Ollama sungguhan: hulu palsu di port acak.
// Pakai: node uji.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AKAR = path.dirname(fileURLToPath(import.meta.url));
const diterima = [];
const hulu = http.createServer((req, res) => {
  let b = ''; req.on('data', (x) => (b += x)); req.on('end', () => {
    if (req.url === '/api/tags') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ models: [{ name: 'kecil:1b' }, { name: 'besar:20b' }, { name: 'cadang:2b' }] })); }
    const j = JSON.parse(b); diterima.push(j);
    if (j.model === 'rusak:1b') { res.writeHead(500); return res.end('{"error":"out of memory"}'); }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: j.model, message: { content: 'ok' }, prompt_eval_count: 10, eval_count: 2 }));
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => hulu.once('listening', r));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-uji-'));
const cfgPath = path.join(dir, 'router.json');
const cfg = {
  ollama: `http://127.0.0.1:${hulu.address().port}`,
  tingkat: { ringan: { model: 'kecil:1b' }, sedang: { model: 'kecil:1b' }, berat: { model: 'rusak:1b', cadangan: 'cadang:2b', opsi: { num_gpu: 99 }, keep_alive: '1m' } },
  tugas: { 'a.ekstrak': { tingkat: 'ringan', cocok: 'Anda mengekstrak' }, 'a.mikir': { tingkat: 'berat', cocok: 'Anda Steward' } },
  bawaan: 'sedang',
};
fs.writeFileSync(cfgPath, JSON.stringify(cfg));
const port = 34000 + Math.floor(Math.random() * 1000);
const anak = spawn(process.execPath, [path.join(AKAR, 'server.mjs')], { env: { ...process.env, ROUTER_PORT: String(port), ROUTER_CONFIG: cfgPath, ROUTER_DATA: path.join(dir, 'data') }, stdio: 'pipe' });
await new Promise((r) => anak.stdout.once('data', r));
const url = `http://127.0.0.1:${port}`;
const chat = (body) => fetch(url + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stream: false, ...body }) });

try {
  // 1. Dikenali dari prompt sistem -> model tingkat ringan.
  let r = await chat({ model: 'qwen3:8b', messages: [{ role: 'system', content: 'Anda mengekstrak laporan' }, { role: 'user', content: 'x' }] });
  assert.equal(r.status, 200); assert.equal(diterima.at(-1).model, 'kecil:1b'); assert.equal(r.headers.get('x-router-tugas'), 'a.ekstrak');

  // 2. Tak dikenali -> model asli apa adanya.
  r = await chat({ model: 'qwen3:8b', messages: [{ role: 'user', content: 'halo' }] });
  assert.equal(diterima.at(-1).model, 'qwen3:8b');

  // 3. Berat: model utama gagal -> cadangan; opsi tingkat ditimpa, opsi aplikasi dipertahankan.
  r = await chat({ model: 'qwen3:8b', options: { num_ctx: 8192 }, messages: [{ role: 'system', content: 'Anda Steward, analis' }] });
  assert.equal(r.status, 200); assert.equal(diterima.at(-1).model, 'cadang:2b');
  assert.deepEqual(diterima.at(-1).options, { num_ctx: 8192, num_gpu: 99 });
  assert.equal(diterima.at(-1).keep_alive, '1m');

  // 4. tugas:/tingkat: eksplisit.
  await chat({ model: 'tugas:a.ekstrak', messages: [] }); assert.equal(diterima.at(-1).model, 'kecil:1b');
  await chat({ model: 'tingkat:sedang', messages: [] }); assert.equal(diterima.at(-1).model, 'kecil:1b');

  // 5. Model cloud ditolak.
  r = await chat({ model: 'gpt-oss:120b-cloud', messages: [] }); assert.equal(r.status, 400);

  // 6. Host asing ditolak.
  r = await new Promise((ok) => http.get({ host: '127.0.0.1', port, path: '/status', agent: false, headers: { host: 'jahat.example' } }, ok));
  assert.equal(r.statusCode, 403); r.resume();

  // 7. Ubah model lewat API: tersimpan, cadangan dibuat; model tak terpasang ditolak.
  r = await fetch(url + '/router/atur', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tingkat: 'sedang', model: 'besar:20b' }) });
  assert.equal(r.status, 200); assert.equal(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).tingkat.sedang.model, 'besar:20b');
  r = await fetch(url + '/router/atur', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tingkat: 'sedang', model: 'tidak-ada:9b' }) });
  assert.equal(r.status, 400);
  r = await fetch(url + '/router/atur', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tingkat: 'berat', model: 'x:cloud' }) });
  assert.equal(r.status, 400);

  // 8. Config rusak -> versi sah terakhir tetap dipakai dan galat dilaporkan.
  await new Promise((r) => setTimeout(r, 20));
  fs.writeFileSync(cfgPath, '{rusak');
  r = await chat({ model: 'tingkat:sedang', messages: [] }); assert.equal(diterima.at(-1).model, 'besar:20b');
  const s = await (await fetch(url + '/status')).json(); assert.ok(s.galatConfig);

  // 8b. Mode aliran (stream) diteruskan utuh, termasuk lewat /api/generate dengan field system.
  r = await fetch(url + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'x', stream: true, system: 'Anda mengekstrak sesuatu', prompt: 'p' }) });
  assert.equal(r.status, 200); assert.equal((await r.json()).model, 'kecil:1b');

  // 9. Passthrough /api/tags.
  const t = await (await fetch(url + '/api/tags')).json(); assert.equal(t.models.length, 3);
  console.log('Semua uji router LULUS (9 kelompok).');
} finally {
  anak.kill(); hulu.close(); fs.rmSync(dir, { recursive: true, force: true });
}
