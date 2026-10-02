// Kirim SATU pertanyaan ke grup YSPI Financial lewat model lokal — pola sama dengan
// kewajiban.mjs: teks & tujuan dijaga program, model lokal yang memanggil kirim_whatsapp,
// program mengantrikan ke WA-Lokal/antrian. Dijalankan manual atas persetujuan Daniel.
//   node tanya-grup.mjs <berkas-teks.txt> <kunci> [tujuan, mis. 62812xxx@s.whatsapp.net]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mintaModelKirim } from '../../../wa-konsol/pengingat/lokal-lengkap.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = 'C:/Users/suluh/Vault-SPI/WA-Lokal';
const GRUP_FINANSIAL = JSON.parse(fs.readFileSync(path.join(DIR, 'lokal.json'), 'utf8')).grupFinansial; // ID grup tidak ditulis di kode
const LOG = 'C:/Users/suluh/.dsh/pengingat.log';

const [berkas, kunci, tujuanArg] = process.argv.slice(2);
const TUJUAN = tujuanArg || GRUP_FINANSIAL;
if (!/^\d+@(s\.whatsapp\.net|g\.us)$/.test(TUJUAN)) throw Error('Tujuan tidak sah: ' + TUJUAN);
if (!berkas || !/^[a-z0-9-]+$/.test(kunci || '')) throw Error('Pakai: node tanya-grup.mjs <berkas-teks.txt> <kunci-huruf-kecil>');
const text = fs.readFileSync(berkas, 'utf8').trim();
if (text.includes('#')) throw Error('Teks memuat tanda pagar — akan memicu watchdog voucher. Dibatalkan.');
const log = (m) => { const l = `${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })}  [tanya-grup] ${m}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };

const status = fs.readFileSync(path.join(BRIDGE, 'status.md'), 'utf8');
if (!/keadaan: \*\*tersambung\*\*/.test(status)) throw Error('WhatsApp belum tersambung; tidak dikirim.');
const antrian = path.join(BRIDGE, 'antrian');
const nama = `${kunci}.json`;
if ([antrian, path.join(BRIDGE, 'outbox')].some((d) => fs.readdirSync(d).some((f) => f.startsWith(kunci)))) throw Error(`Sudah pernah diantrikan (${kunci}); tidak mengirim dobel.`);

const model = JSON.parse(fs.readFileSync(path.join(BRIDGE, 'pengingat.json'), 'utf8')).model || 'qwen3:8b';
const kirim = await mintaModelKirim({ model, text, tujuan: TUJUAN, log });
fs.writeFileSync(path.join(antrian, nama), JSON.stringify({ to: TUJUAN, text }, null, 2), { flag: 'wx' });
fs.mkdirSync(path.join(DIR, 'hasil'), { recursive: true });
fs.writeFileSync(path.join(DIR, 'hasil', `${kunci}.md`), text);
fs.writeFileSync(path.join(DIR, 'hasil', `${kunci}.kirim.json`), JSON.stringify({ alat: 'kirim_whatsapp', ...kirim, model, waktu: new Date().toISOString() }, null, 2));
log(`DIANTRIKAN ${nama} → ${TUJUAN} atas panggilan alat oleh model ${model}; menunggu bukti outbox.`);
