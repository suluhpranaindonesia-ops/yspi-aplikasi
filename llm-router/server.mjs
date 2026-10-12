// Router model lokal YSPI (port 3467).
//
// Meniru API Ollama, jadi aplikasi cukup diarahkan ke http://127.0.0.1:3467 alih-alih
// :11434 tanpa mengubah kodenya. Untuk /api/chat dan /api/generate router menentukan
// TUGAS-nya, lalu memilih model sesuai TINGKAT tugas itu (ringan/sedang/berat) di
// router.json. Jalur lain (/api/tags, /api/ps, ...) diteruskan apa adanya.
//
// Cara tugas dikenali, berurutan:
//   1. model "tugas:<nama>"   -> tugas itu
//   2. model "tingkat:<nama>" -> langsung tingkat itu
//   3. teks prompt sistem memuat "cocok" salah satu tugas di router.json
//   4. selain itu model asli dipakai apa adanya (aplikasi lama tidak berubah perilaku)
//
// Keputusan pengguna 12 Okt 2026: hanya model lokal. Model bernama "cloud" ditolak dan
// Ollama hulu wajib di 127.0.0.1. Isi prompt TIDAK dicatat; log hanya tugas, model, waktu, token.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ROUTER_PORT || 3467);
const BERKAS_CFG = process.env.ROUTER_CONFIG || path.join(AKAR, 'router.json');
const DATA = process.env.ROUTER_DATA || path.join(AKAR, 'data');
const LOG = path.join(DATA, 'router.log');
fs.mkdirSync(DATA, { recursive: true });

const TINGKAT = ['ringan', 'sedang', 'berat'];
const lokal = (m) => typeof m === 'string' && m.trim() !== '' && !/cloud/i.test(m);

// ---------- konfigurasi (dibaca ulang bila berkas berubah) ----------
let cfg = null, cfgMtime = 0, galatCfg = '';
export function periksaConfig(c) {
  if (!c || typeof c !== 'object') throw Error('router.json bukan objek');
  const u = new URL(c.ollama || 'http://127.0.0.1:11434');
  if (!['127.0.0.1', 'localhost'].includes(u.hostname)) throw Error('Ollama hulu wajib di 127.0.0.1');
  for (const t of TINGKAT) {
    const x = c.tingkat?.[t];
    if (!x || !lokal(x.model)) throw Error(`Tingkat "${t}" wajib punya model lokal`);
    if (x.cadangan != null && !lokal(x.cadangan)) throw Error(`Cadangan tingkat "${t}" bukan model lokal`);
  }
  for (const [nama, x] of Object.entries(c.tugas || {})) {
    if (!TINGKAT.includes(x.tingkat)) throw Error(`Tugas "${nama}" memakai tingkat tak dikenal`);
    if (x.model != null && !lokal(x.model)) throw Error(`Model tugas "${nama}" bukan model lokal`);
  }
  if (c.bawaan != null && !TINGKAT.includes(c.bawaan)) throw Error('"bawaan" harus ringan/sedang/berat');
  return c;
}
function muatConfig() {
  try {
    const st = fs.statSync(BERKAS_CFG);
    if (cfg && st.mtimeMs === cfgMtime) return cfg;
    cfg = periksaConfig(JSON.parse(fs.readFileSync(BERKAS_CFG, 'utf8')));
    cfgMtime = st.mtimeMs; galatCfg = '';
  } catch (e) {
    // Config rusak: tetap pakai versi sah terakhir, laporkan di /status.
    galatCfg = e.message;
    if (!cfg) throw e;
  }
  return cfg;
}

// ---------- penentuan tugas ----------
function teksSistem(body) {
  if (typeof body.system === 'string') return body.system;
  return (body.messages || []).filter((m) => m.role === 'system').map((m) => String(m.content || '')).join('\n');
}
export function tentukan(c, body) {
  const asli = String(body.model || '');
  let tugas = null, tingkat = null;
  if (asli.startsWith('tugas:')) {
    tugas = asli.slice(6);
    tingkat = c.tugas?.[tugas]?.tingkat || c.bawaan || 'sedang';
  } else if (asli.startsWith('tingkat:')) {
    tingkat = asli.slice(8);
    if (!TINGKAT.includes(tingkat)) throw Error(`Tingkat "${tingkat}" tidak dikenal`);
  } else {
    const sis = teksSistem(body);
    for (const [nama, x] of Object.entries(c.tugas || {})) {
      if (x.cocok && sis.includes(x.cocok)) { tugas = nama; tingkat = x.tingkat; break; }
    }
  }
  if (!tingkat) return { tugas: null, tingkat: null, model: asli, cadangan: null, asli };
  const t = c.tingkat[tingkat];
  const model = c.tugas?.[tugas]?.model || t.model;
  return { tugas, tingkat, model, cadangan: t.cadangan && t.cadangan !== model ? t.cadangan : null, opsi: t.opsi || {}, think: t.think, keepAlive: t.keep_alive, asli };
}

// ---------- statistik & log ----------
const mulai = new Date().toISOString();
const stat = {};
function catat(rek) {
  fs.appendFile(LOG, JSON.stringify(rek) + '\n', () => {});
  const k = rek.tugas || (rek.tingkat ? 'tingkat:' + rek.tingkat : 'langsung:' + rek.model);
  const s = (stat[k] ||= { panggilan: 0, gagal: 0, totalDetik: 0, model: '', terakhir: '' });
  s.panggilan++; if (!rek.ok) s.gagal++;
  s.totalDetik += rek.detik; s.model = rek.model; s.terakhir = rek.waktu;
}

// ---------- penerusan ke Ollama ----------
// http bawaan, BUKAN fetch: fetch memutus bila header jawaban belum datang dalam 5 menit,
// sedangkan model berat di CPU bisa lebih lama membaca prompt panjang sebelum menjawab
// (pelajaran yang sama dengan ollamaStream di wa-konsol/pengingat/lokal-lengkap.mjs).
const BATAS_HULU = 60 * 60_000;
function hulu(c, jalur, method, bodyTeks, klien) {
  return new Promise((ok, gagal) => {
    const req = http.request(new URL(jalur, c.ollama), { method, headers: { 'content-type': 'application/json' } }, (r) => {
      clearTimeout(timer);
      ok({ ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode, tipe: r.headers['content-type'], body: r,
        text: () => new Promise((t, g) => { let s = ''; r.setEncoding('utf8'); r.on('data', (x) => (s += x)); r.on('end', () => t(s)); r.on('error', g); }) });
    });
    const timer = setTimeout(() => req.destroy(Error('Ollama melewati batas waktu 60 menit')), BATAS_HULU);
    req.on('error', (e) => { clearTimeout(timer); gagal(e); });
    // Aplikasi menyerah (batas waktunya sendiri habis): hentikan juga pekerjaan di Ollama.
    klien?.on('close', () => { if (!klien.writableFinished) req.destroy(); });
    req.end(bodyTeks);
  });
}

async function teruskan(c, req, res, jalur, bodyTeks) {
  const r = await hulu(c, jalur, req.method, ['GET', 'HEAD'].includes(req.method) ? undefined : bodyTeks, res);
  res.writeHead(r.status, { 'content-type': r.tipe || 'application/json' });
  for await (const potong of r.body) res.write(potong);
  res.end();
}

async function panggilModel(c, jalur, body, model, res) {
  const r = await hulu(c, jalur, 'POST', JSON.stringify({ ...body, model }), res);
  return r;
}

async function inferensi(c, req, res, jalur, bodyTeks) {
  let body;
  try { body = JSON.parse(bodyTeks); } catch { return kirimJson(res, 400, { error: 'body bukan JSON' }); }
  const p = tentukan(c, body);
  if (!lokal(p.model)) return kirimJson(res, 400, { error: 'Model cloud tidak diizinkan router YSPI.' });
  if (p.tingkat) {
    // Opsi tingkat (mis. num_gpu) menimpa; opsi milik aplikasi (num_ctx, suhu) tetap.
    body.options = { ...(body.options || {}), ...p.opsi };
    if (p.think !== undefined) body.think = p.think;
    // Model besar (mis. 18 GB di CPU) dilepas cepat supaya RAM kembali untuk Whisper & model lain.
    if (p.keepAlive !== undefined) body.keep_alive = p.keepAlive;
  }
  const t0 = Date.now();
  let model = p.model, r = await panggilModel(c, jalur, body, model, res).catch((e) => ({ ok: false, status: 502, galat: e }));
  let pakaiCadangan = false;
  if (!r.ok && p.cadangan) {
    // Model utama gagal sebelum menjawab (tidak terpasang, RAM kurang, dst): coba cadangan sekali.
    r.body?.resume();
    model = p.cadangan; pakaiCadangan = true;
    r = await panggilModel(c, jalur, body, model, res).catch((e) => ({ ok: false, status: 502, galat: e }));
  }
  const rek = { waktu: new Date().toISOString(), tugas: p.tugas, tingkat: p.tingkat, model, cadangan: pakaiCadangan, ok: !!r.ok, status: r.status };
  if (!r.body) {
    rek.detik = (Date.now() - t0) / 1000; rek.galat = String(r.galat?.message || 'hulu tidak menjawab'); catat(rek);
    return kirimJson(res, 502, { error: 'Ollama tidak dapat dihubungi: ' + rek.galat });
  }
  res.writeHead(r.status, { 'content-type': r.tipe || 'application/json', 'x-router-tugas': p.tugas || '', 'x-router-model': model });
  if (body.stream === false) {
    const teks = await r.text();
    res.end(teks);
    try { const j = JSON.parse(teks); rek.tokenMasuk = j.prompt_eval_count; rek.tokenKeluar = j.eval_count; } catch {}
  } else {
    for await (const potong of r.body) res.write(potong);
    res.end();
  }
  rek.detik = Math.round((Date.now() - t0) / 100) / 10;
  catat(rek);
}

// ---------- halaman & API pengaturan ----------
function kirimJson(res, kode, data) {
  res.writeHead(kode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}
const bacaBody = (req) => new Promise((ok, gagal) => {
  let n = 0; const b = [];
  req.on('data', (x) => { n += x.length; if (n > 50 * 1024 * 1024) { gagal(Error('body terlalu besar')); req.destroy(); } else b.push(x); });
  req.on('end', () => ok(Buffer.concat(b).toString('utf8'))); req.on('error', gagal);
});

async function modelTerpasang(c) {
  try { const j = await (await fetch(new URL('/api/tags', c.ollama), { signal: AbortSignal.timeout(5000) })).json(); return (j.models || []).map((m) => m.name).filter(lokal).sort(); }
  catch { return []; }
}

// Ubah router.json dari halaman: cadangkan dulu, tulis lewat berkas sementara lalu rename.
function simpanConfig(baru) {
  periksaConfig(baru);
  const cad = path.join(DATA, 'cadangan');
  fs.mkdirSync(cad, { recursive: true });
  fs.copyFileSync(BERKAS_CFG, path.join(cad, 'router-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'));
  const sementara = BERKAS_CFG + '.tmp';
  fs.writeFileSync(sementara, JSON.stringify(baru, null, 2) + '\n');
  fs.renameSync(sementara, BERKAS_CFG);
}

const HALAMAN = fs.readFileSync(path.join(AKAR, 'halaman.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  try {
    // Hanya dari PC ini, dan Host harus 127.0.0.1/localhost (pelajaran CSRF wa-konsol 8 Okt).
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (!['127.0.0.1', 'localhost'].includes(host)) return kirimJson(res, 403, { error: 'Host tidak diizinkan' });
    const c = muatConfig();
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(HALAMAN); }
    if (req.method === 'GET' && u.pathname === '/status') {
      const rata = Object.fromEntries(Object.entries(stat).map(([k, s]) => [k, { ...s, rataDetik: Math.round(s.totalDetik / s.panggilan * 10) / 10 }]));
      return kirimJson(res, 200, { ok: !galatCfg, galatConfig: galatCfg || null, mulai, port: PORT, config: c, terpasang: await modelTerpasang(c), statistik: rata });
    }
    if (req.method === 'POST' && u.pathname === '/router/atur') {
      if (!/application\/json/.test(req.headers['content-type'] || '')) return kirimJson(res, 415, { error: 'Pakai JSON' });
      const a = JSON.parse(await bacaBody(req));
      const baru = structuredClone(c);
      if (a.tingkat && a.model) {
        if (!TINGKAT.includes(a.tingkat)) return kirimJson(res, 400, { error: 'tingkat tidak dikenal' });
        baru.tingkat[a.tingkat].model = a.model;
      } else if (a.tugas && a.ubahTingkat) {
        if (!baru.tugas[a.tugas]) return kirimJson(res, 404, { error: 'tugas tidak dikenal' });
        baru.tugas[a.tugas].tingkat = a.ubahTingkat;
      } else return kirimJson(res, 400, { error: 'Kirim {tingkat, model} atau {tugas, ubahTingkat}' });
      const ada = await modelTerpasang(c);
      if (a.model && ada.length && !ada.includes(a.model)) return kirimJson(res, 400, { error: `Model ${a.model} belum terpasang di Ollama` });
      try { simpanConfig(baru); } catch (e) { return kirimJson(res, 400, { error: e.message }); }
      return kirimJson(res, 200, { ok: true, config: muatConfig() });
    }
    const bodyTeks = ['GET', 'HEAD'].includes(req.method) ? undefined : await bacaBody(req);
    if (req.method === 'POST' && ['/api/chat', '/api/generate'].includes(u.pathname)) return await inferensi(c, req, res, u.pathname, bodyTeks);
    if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/')) return await teruskan(c, req, res, u.pathname + u.search, bodyTeks);
    kirimJson(res, 404, { error: 'tidak ada' });
  } catch (e) {
    if (!res.headersSent) kirimJson(res, 500, { error: e.message }); else res.end();
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  muatConfig();
  server.listen(PORT, '127.0.0.1', () => console.log(`Router model lokal YSPI di http://127.0.0.1:${PORT}`));
}
