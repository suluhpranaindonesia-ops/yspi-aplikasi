// Pengingat Kewajiban Finansial YSPI — salinan Node dari pengingat_kewajiban()
// di DRAFT/ops/paket-harness-windows/jadwal_tools.py, tanpa Python.
//
// Pola sama dengan pengingat pagi (wa-konsol/pengingat): PROGRAM menyusun isi
// pesan dari Excel (angka & tanggal tidak pernah ditulis model), lalu MODEL
// LOKAL yang memutuskan mengirim dengan memanggil alat kirim_whatsapp. Program
// hanya mengantrikan teks yang sudah jadi, ke grup YSPI Financial saja.
//
//   node kewajiban.mjs                  -> jalankan terjadwal (kirim bila ada isi)
//   node kewajiban.mjs --uji            -> susun & simpan draf, tidak mengirim
//   node kewajiban.mjs --uji --tanggal=2026-09-28   -> simulasi tanggal lain
//   node kewajiban.mjs --uji --ringkasan            -> paksa rangkuman 30 hari
//   node kewajiban.mjs --uji --uji-kirim            -> uji panggilan alat oleh model, tanpa antre
//   node kewajiban.mjs --tanpa-kalender  -> lewati sinkron Google Calendar (lihat kalender.mjs)
//   node kewajiban.mjs --paksa        -> lewati pencegah dobel hari ini
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bacaWorkbook, keTanggal } from './baca-xlsx.mjs';
import { ambilAcara, bandingkan, susunPengumuman, saringBelumDiumumkan } from './kalender.mjs';
import { mintaModelKirim } from '../../../wa-konsol/pengingat/lokal-lengkap.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const VAULT = 'C:/Users/suluh/Vault-SPI';
const BRIDGE = path.join(VAULT, 'WA-Lokal');
const WORKBOOK = path.join(VAULT, 'DRAFT', 'ops', 'YSPI-Jadwal-Rutin-dan-Kegiatan-2026-2027.xlsx');
const GRUP_FINANSIAL = JSON.parse(fs.readFileSync(path.join(DIR, 'lokal.json'), 'utf8')).grupFinansial; // ID grup tidak ditulis di kode
const LOG = 'C:/Users/suluh/.dsh/pengingat.log';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const SELESAI = ['Selesai', 'Ditransfer', 'Dibatalkan'];

// --- tanggal (string 'YYYY-MM-DD', dihitung di UTC supaya bebas zona waktu) ---
const hariIniWIB = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
const ms = d => Date.parse(d + 'T00:00:00Z');
const selisih = (a, b) => Math.round((ms(a) - ms(b)) / 86400000);
const geser = (d, n) => new Date(ms(d) + n * 86400000).toISOString().slice(0, 10);
const hariMinggu = d => new Date(ms(d)).getUTCDay(); // 0 = Minggu, 1 = Senin
const fmt = d => d ? `${+d.slice(8)} ${BULAN[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '-';
const rp = v => { const n = Number(v); return v === null || v === undefined || v === '' || isNaN(n) ? '-' : 'Rp' + Math.round(n).toLocaleString('de-DE'); };
function mundurHariKerja(d, n) { while (n > 0) { d = geser(d, -1); const w = hariMinggu(d); if (w !== 0 && w !== 6) n--; } return d; }

// --- nilai sel: pakai nilai tersimpan; kalau kosong, hitung rumus yang dipakai
//     pengingat (sama dengan _eval_cadangan versi Python) ---
function nilaiJadwalRutin(jr, ref, dalam = 0) {
  const c = jr.cell(ref);
  if (c.v !== null && c.v !== undefined) return c.v;
  if (!c.f || dalam > 5) return null;
  const refs = [...c.f.matchAll(/\$?([A-Z])\$?(\d+)/g)].map(m => Number(nilaiJadwalRutin(jr, m[1] + m[2], dalam + 1)) || 0);
  if (c.f.includes('*') && refs.length === 2) return refs[0] * refs[1];
  return refs.length ? refs[0] : null;
}
function nominalRutin(wb, pr, r) {
  const c = pr.cell('G' + r);
  if (typeof c.v === 'number') return c.v;
  if (!c.f) return c.v;
  const jr = wb.sheet('Jadwal Rutin');
  const ref = c.f.match(/'Jadwal Rutin'!\$([A-Z])\$(\d+)\s*$/);
  if (!ref) return null;
  const dasar = Number(nilaiJadwalRutin(jr, ref[1] + ref[2])) || 0;
  if (!c.f.includes('DATE(')) return dasar;
  const per = keTanggal(pr.cell('A' + r).v);
  if (!per) return null;
  const pasangan = [...c.f.matchAll(/>=DATE\((\d+),(\d+),(\d+)\)\)\*\(A\d+<=DATE\((\d+),(\d+),(\d+)\)/g)];
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return pasangan.filter(p => iso(p[1], p[2], p[3]) <= per && per <= iso(p[4], p[5], p[6])).length * dasar;
}
function totalKegiatan(k) {
  const c = k.cell('G36');
  if (typeof c.v === 'number') return c.v;
  let tot = 0;
  for (let r = 20; r < 35; r++) { const d = k.cell('D' + r).v, f = k.cell('F' + r).v; if (typeof d === 'number' && typeof f === 'number') tot += d * f; }
  const put = typeof k.cell('B11').v === 'number' ? k.cell('B11').v : 1;
  return tot * put;
}

export function kumpul(file = WORKBOOK, today = hariIniWIB()) {
  const wb = bacaWorkbook(file);
  const jr = wb.sheet('Jadwal Rutin');
  const pemilik = {};
  for (let r = 6; r < 16; r++) { const k = jr.cell('A' + r).v; if (k) pemilik[k] = jr.cell('D' + r).v; }
  const pr = wb.sheet('Pembayaran Rutin');
  const rutin = [];
  for (let r = 5; r <= pr.maxRow; r++) {
    const kode = pr.cell('B' + r).v;
    if (!kode) continue;
    const due = keTanggal(pr.cell('D' + r).v);
    rutin.push({
      kode, nama: pr.cell('C' + r).v, due,
      voucher: keTanggal(pr.cell('E' + r).v) || (due ? mundurHariKerja(due, 3) : null),
      nominal: nominalRutin(wb, pr, r),
      status: pr.cell('H' + r).v || 'Belum diajukan',
      noVoucher: String(pr.cell('I' + r).v || '').trim(),
      pemilik: pemilik[kode] || '-',
    });
  }
  const tb = bacaTambahan();
  terapkanArahan(rutin, tb);
  // Kewajiban yang belum masuk workbook (tambahan.json): bulanan (tanggal; "setiapBulan" n untuk
  // tiap n bulan), mingguan (hariMinggu 0=Minggu…6=Sabtu), atau sekali (tanggal di bulan "mulai").
  for (const t of tb.kewajiban) {
    const isi = { kode: t.kode, nama: t.nama, nominal: t.nominal, status: 'Belum diajukan', noVoucher: '', pemilik: t.pemilik || '-',
      tambahan: true, irama: t.irama, akun: t.akun, nominalMaks: !!t.nominalMaks, hariPengingat: t.hariPengingat, catatan: t.catatan };
    if (t.irama === 'mingguan') {
      let d = `${t.mulai}`;
      while (hariMinggu(d) !== t.hariMinggu) d = geser(d, 1);
      for (; d <= t.sampai; d = geser(d, 7)) rutin.push({ ...isi, due: d, voucher: d });
      continue;
    }
    let [y, m] = t.mulai.split('-').map(Number);
    const [ys, ms_] = (t.sampai || t.mulai).split('-').map(Number);
    while (y < ys || (y === ys && m <= ms_)) {
      const hariAkhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const due = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(t.tanggal, hariAkhir)).padStart(2, '0')}`;
      rutin.push({ ...isi, due, voucher: mundurHariKerja(due, 3) });
      if (t.irama !== 'bulanan') break;
      m += t.setiapBulan || 1;
      while (m > 12) { m -= 12; y++; }
    }
  }
  cocokkanRegister(rutin);
  // Arahan Daniel 20 Okt 2026: kas kecil mingguan yang minggunya lewat tanpa voucher berarti
  // memang tidak perlu diisi — dibuang, bukan ditumpuk sebagai "lewat jatuh tempo".
  for (let i = rutin.length - 1; i >= 0; i--) {
    const x = rutin[i];
    if (x.irama === 'mingguan' && x.due < today && !sudahAdaVoucher(x)) rutin.splice(i, 1);
  }
  const keg = wb.names.filter(n => /^K\d+\b/.test(n)).map(n => {
    const k = wb.sheet(n);
    return {
      lembar: n, nama: k.cell('B5').v, pic: k.cell('B6').v || '(PIC belum diisi)',
      mulai: keTanggal(k.cell('B7').v), selesai: keTanggal(k.cell('B8').v),
      total: totalKegiatan(k), kirim: k.cell('B51').v, lpj: k.cell('B58').v, status: k.cell('B16').v || '',
    };
  });
  return { rutin, keg };
}

// Lembar Pembayaran Rutin sering tertinggal dari register voucher (28 Sep: VCH-0019 Batam &
// VCH-0021 Daniel sudah terbit, lembar masih "Belum diajukan"). Baris yang belum bernomor
// voucher dicocokkan ke register: nominal SAMA PERSIS dan tanggal diajukan antara 25 hari
// sebelum s.d. 10 hari sesudah jatuh tempo. Satu voucher hanya dipakai untuk satu baris.
const REGISTER = path.join(VAULT, 'Operation', 'ops', 'keuangan', 'Sistem-Akuntansi-YSPI.xlsx');
function cocokkanRegister(rutin) {
  let v;
  try { v = bacaWorkbook(REGISTER).sheet('Voucher'); } catch { return; }
  const daftar = [];
  for (let r = 5; r <= v.maxRow; r++) {
    const no = v.cell('A' + r).v;
    if (!/^VCH-/.test(no || '')) continue;
    const status = String(v.cell('R' + r).v || '');
    if (/DIBATALKAN|KEDALUWARSA|DITOLAK/i.test(status)) continue;
    daftar.push({ no, tgl: keTanggal(v.cell('B' + r).v), nominal: Number(v.cell('I' + r).v) || 0, akun: String(v.cell('O' + r).v || ''), status });
  }
  const terpakai = new Set(rutin.map((x) => x.noVoucher).filter(Boolean).flatMap((s) => s.match(/VCH-\d{4}-\d{4}/g) || []));
  // Kas kecil mingguan nominalnya berubah-ubah (s.d. Rp500 rb): cocok bila akunnya sama,
  // nominal tidak melebihi plafon, dan diajukan di minggu yang sama (5 hari sebelum s.d. 1 hari
  // sesudah jadwal) — voucher Sabtu lalu milik minggu lalu, bukan minggu ini.
  const cocok = (d, x) => x.nominalMaks
    ? d.akun === x.akun && d.nominal <= Number(x.nominal) && selisih(d.tgl, x.due) >= -5 && selisih(d.tgl, x.due) <= 1
    : d.nominal === Number(x.nominal) && selisih(d.tgl, x.due) >= -25 && selisih(d.tgl, x.due) <= 10;
  for (const x of rutin.filter((x) => x.due && !x.noVoucher && !SELESAI.includes(x.status)).sort((a, b) => a.due.localeCompare(b.due))) {
    const c = daftar.find((d) => !terpakai.has(d.no) && d.tgl && cocok(d, x));
    if (c) { terpakai.add(c.no); x.noVoucher = c.no; x.status = `Voucher ${c.status} (register)`; }
  }
}

// Arahan pengurus yang menimpa baris workbook. Dipakai juga oleh dasbor keuangan-web (tabel
// "Jatuh tempo pembayaran rutin") supaya keduanya sama. Baris: { kode, due, voucher, nama,
// nominal, status, noVoucher }.
//  - ganti: nama/nominal baru, tanggal jatuh tempo di bulan yang sama, atau baris dihapus
//    (diganti kewajiban mingguan). Nomor voucher lama tidak diwariskan bila nominalnya diganti.
//  - tutup: periode (YYYY-MM) yang sudah dibayar → status Selesai dengan voucher yang benar
//    (mis. workbook menulis voucher yang salah, atau nominal voucher beda dari jadwal).
export function terapkanArahan(rutin, tb = bacaTambahan()) {
  for (const g of tb.ganti || []) {
    for (let i = rutin.length - 1; i >= 0; i--) {
      const x = rutin[i];
      if (x.kode !== g.kode || SELESAI.includes(x.status)) continue;
      if (g.hapus) { rutin.splice(i, 1); continue; }
      if (g.tanggal && x.due) {
        const [y, m] = x.due.split('-').map(Number);
        x.due = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(g.tanggal, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, '0')}`;
        x.voucher = mundurHariKerja(x.due, 3);
      }
      if (g.nama) x.nama = g.nama;
      if (g.nominal && g.nominal !== x.nominal) { x.diganti = `${rp(x.nominal)} di workbook`; x.nominal = g.nominal; x.noVoucher = ''; x.status = 'Belum diajukan'; }
    }
  }
  for (const t of tb.tutup || []) {
    for (const x of rutin) {
      // R06 (dana LBC) tidak bertanggal di workbook ("saat dana masuk"): pakai kolom periode.
      if (x.kode !== t.kode || (x.due || x.periode || '').slice(0, 7) !== t.periode) continue;
      x.noVoucher = t.noVoucher || ''; x.status = 'Selesai';
      if (t.nominal) x.nominal = t.nominal;
    }
  }
  return rutin;
}

export function bacaTambahan() {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, 'tambahan.json'), 'utf8')); }
  catch { return { kewajiban: [], hariPengingat: [30, 15, 7, 3, 1] }; }
}

// Kewajiban yang sudah punya voucher (nomor terisi, atau status sudah melewati "Belum
// diajukan") tidak diingatkan lagi — arahan Daniel 25 Sep 2026: ingatkan hanya yang
// belum ada voucher, pada H-30, H-15, H-7, H-3, H-1 dan hari-H.
export const sudahAdaVoucher = (x) => SELESAI.includes(x.status) || !!x.noVoucher || !/^belum/i.test(x.status || 'Belum diajukan');

// Susun pesan. Mengembalikan null bila hari ini tidak ada yang perlu diingatkan.
export function susunPesan({ rutin, keg }, today, paksaRingkasan = false) {
  const hariIni = [], mingguIni = [], terlambat = [];
  const hariPengingat = bacaTambahan().hariPengingat || [30, 15, 7, 3, 1];
  const segera = [];
  for (const x of rutin) {
    if (sudahAdaVoucher(x) || !x.due) continue;
    const d = selisih(x.due, today);
    const hp = x.hariPengingat || hariPengingat;
    const nominal = x.nominalMaks ? 's.d. ' + rp(x.nominal) : rp(x.nominal);
    const baris = `${x.kode} ${x.nama} — ${nominal} · jatuh tempo ${fmt(x.due)} · pengaju ${x.pemilik} · belum ada voucher`;
    // Hari-H hanya diingatkan bila 0 ada di daftar hari pengingat (arahan 1 Okt: cukup
    // H-15, H-7, H-3, H-1 untuk kewajiban; H-1 saja untuk kas kecil mingguan).
    if (d === 0 && hp.includes(0)) hariIni.push('⏰ Jatuh tempo HARI INI: ' + baris);
    else if (d === 0) continue;
    else if (hp.includes(d) && d <= 3) segera.push(`🔔 H-${d}: ` + baris);
    else if (hp.includes(d)) mingguIni.push(`🗓️ H-${d}: ` + baris);
    // Kas kecil mingguan yang terlewat tidak ditumpuk: minggu berikutnya sudah mengingatkan lagi.
    else if (d < 0 && d >= -30 && x.irama !== 'mingguan') terlambat.push('⚠️ Lewat jatuh tempo: ' + baris);
  }
  hariIni.push(...segera);
  for (const k of keg) {
    if (['Batal', 'Ditunda'].includes(k.status)) continue;
    if (k.mulai && !k.kirim && k.mulai >= today) {
      const batas = geser(k.mulai, -14), d = selisih(batas, today);
      const b = `${k.lembar} (${fmt(k.mulai)}) · PIC ${k.pic} · anggaran ${rp(k.total)}`;
      if (d === 0) hariIni.push('📤 Hari ini batas kirim file pengeluaran: ' + b);
      else if (d === 7) mingguIni.push('📤 7 hari lagi batas kirim file pengeluaran: ' + b);
      else if (d < 0) terlambat.push(`📤 File pengeluaran belum dikirim (batas ${fmt(batas)}): ` + b);
    }
    if (k.selesai && !k.lpj && ['Berjalan', 'Selesai - menunggu LPJ', 'Uang muka ditransfer'].includes(k.status)) {
      const batas = geser(k.selesai, 7);
      if (batas === today) hariIni.push(`🧾 Hari ini batas LPJ: ${k.lembar} · PIC ${k.pic}`);
      else if (batas < today) terlambat.push(`🧾 LPJ lewat batas (${fmt(batas)}): ${k.lembar} · PIC ${k.pic}`);
    }
  }
  const ringkasan = hariMinggu(today) === 1 || paksaRingkasan;
  const blok = [];
  if (ringkasan) {
    const until = geser(today, 30);
    const items = rutin.filter(x => x.due && today <= x.due && x.due <= until && !sudahAdaVoucher(x)).sort((a, b) => a.due.localeCompare(b.due))
      .filter((x, i, a) => x.irama !== 'mingguan' || a.findIndex(y => y.kode === x.kode) === i);
    blok.push(`📅 *Kewajiban 30 hari ke depan yang belum ada voucher* (${fmt(today)} – ${fmt(until)})`);
    for (const x of items) blok.push(`• ${fmt(x.due)} · ${x.kode} ${x.nama} — ${x.nominalMaks ? 's.d. ' : ''}${rp(x.nominal)} · pengaju ${x.pemilik} · ${x.irama === 'mingguan' ? 'tiap minggu' : x.status}`);
    blok.push(`Total: ${rp(items.reduce((s, x) => s + (Number(x.nominal) || 0), 0))}`);
    const kk = keg.filter(k => k.mulai && today <= k.mulai && k.mulai <= until && !['Batal', 'Ditunda'].includes(k.status)).sort((a, b) => a.mulai.localeCompare(b.mulai));
    if (kk.length) {
      blok.push('', '🗓️ *Kegiatan 30 hari ke depan*');
      for (const k of kk) {
        const st = k.kirim ? 'file pengeluaran sudah dikirim' : `file pengeluaran paling lambat ${fmt(geser(k.mulai, -14))}`;
        blok.push(`• ${fmt(k.mulai)} · ${k.lembar} — ${rp(k.total)} · PIC ${k.pic} · ${st}`);
      }
    }
  }
  const bagian = [];
  const tambah = (judul, isi) => { if (!isi.length) return; if (bagian.length) bagian.push(''); bagian.push(judul, ...isi.map(h => '• ' + h)); };
  tambah('*Hari ini*', hariIni);
  tambah('*Mendatang*', mingguIni);
  if (ringkasan) tambah('*Perlu ditindaklanjuti*', terlambat); // keterlambatan hanya dirangkum hari Senin
  if (blok.length) { if (bagian.length) bagian.push(''); bagian.push(...blok); }
  if (!bagian.length) return null;
  return [`🔔 *Pengingat Kewajiban Finansial YSPI* — ${fmt(today)}`, '', ...bagian, '',
    'Voucher diajukan lewat alur voucher di grup ini. Setelah transfer, status diperbarui di lembar Pembayaran Rutin.',
    'File: DRAFT/ops/YSPI-Jadwal-Rutin-dan-Kegiatan-2026-2027.xlsx'].join('\n')
    .replace(/#/g, ''); // grup ini dipantau agen pencatat voucher: jangan ada tanda pagar
}

async function utama() {
  const argv = process.argv.slice(2);
  const uji = argv.includes('--uji');
  const today = argv.find(a => a.startsWith('--tanggal='))?.split('=')[1] || hariIniWIB();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw Error('Format --tanggal harus YYYY-MM-DD.');
  if (!uji && today !== hariIniWIB()) throw Error('--tanggal hanya untuk uji (--uji); kiriman sungguhan selalu memakai tanggal hari ini.');
  const log = m => {
    const jam = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    const line = `${hariIniWIB()} ${jam}  [kewajiban] ${m}`;
    console.log(line);
    if (!uji) fs.appendFileSync(LOG, line + '\n');
  };
  const config = JSON.parse(fs.readFileSync(path.join(BRIDGE, 'pengingat.json'), 'utf8'));
  const model = config.model || 'qwen3:8b';
  const dirs = [path.join(BRIDGE, 'antrian'), path.join(BRIDGE, 'outbox')];
  // Sinkron Google Calendar dulu. Kegagalannya TIDAK membatalkan pengingat.
  if (!argv.includes('--tanpa-kalender')) {
    try { await sinkronKalender({ today, uji, argv, config, model, dirs, log }); }
    catch (e) { log(`Sinkron kalender GAGAL (pengingat tetap lanjut): ${e.message}`); }
  }
  const key = `kewajiban-${today}`;
  const sudah = dirs.flatMap(d => fs.existsSync(d) ? fs.readdirSync(d) : []).some(f => f.startsWith(key));
  if (!uji && sudah && !argv.includes('--paksa')) { log('Sudah ada kiriman/antrian hari ini; tidak mengirim duplikat.'); return; }

  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(WORKBOOK)).digest('hex');
  const sebelum = hash();
  const data = kumpul(WORKBOOK, today);
  log(`Membaca Excel jadwal: ${data.rutin.length} baris pembayaran rutin, ${data.keg.length} lembar kegiatan; tanggal ${today}.`);
  const text = susunPesan(data, today, argv.includes('--ringkasan'));
  if (hash() !== sebelum) throw Error('Workbook berubah selama dibaca; tidak dikirim, coba lagi di putaran berikutnya.');
  if (!text) { log(`${fmt(today)}: tidak ada jatuh tempo, batas voucher, atau batas file pengeluaran hari ini — tidak ada pesan.`); return; }

  const keluaran = path.join(DIR, 'hasil'); fs.mkdirSync(keluaran, { recursive: true });
  const stem = `kewajiban-${today}${uji ? '-uji' : ''}`;
  fs.writeFileSync(path.join(keluaran, stem + '.md'), text);
  log(`Pesan tersusun: ${text.length} huruf, ${text.split('\n').filter(l => l.startsWith('• ')).length} butir. Draf ${stem}.md`);
  if (uji) {
    console.log('\n' + text + '\n');
    // --uji-kirim menguji panggilan alat oleh model tanpa mengantrikan apa pun.
    if (argv.includes('--uji-kirim')) {
      const coba = await mintaModelKirim({ model, text, tujuan: GRUP_FINANSIAL, log });
      log(`Uji alat: model memanggil kirim_whatsapp ke ${coba.argumen.tujuan}, tetapi mode uji tidak mengantrikan apa pun.`);
    }
    log('Mode uji: tidak dikirim.'); return;
  }
  if (!config.aktif || !config.kirim) { log('Pengiriman pengingat dimatikan di pengingat.json; tidak dikirim.'); return; }

  const status = fs.readFileSync(path.join(BRIDGE, 'status.md'), 'utf8');
  if (!/keadaan: \*\*tersambung\*\*/.test(status)) throw Error('WhatsApp belum tersambung; draf disimpan, belum diantrikan.');
  // Model lokal sendiri yang memutuskan mengirim; teks & tujuan dijaga program.
  const kirim = await mintaModelKirim({ model, text, tujuan: GRUP_FINANSIAL, log });
  fs.writeFileSync(path.join(dirs[0], key + (sudah ? '-' + Date.now() : '') + '.json'), JSON.stringify({ to: GRUP_FINANSIAL, text }, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(keluaran, stem + '.kirim.json'), JSON.stringify({ alat: 'kirim_whatsapp', ...kirim, waktu: new Date().toISOString() }, null, 2));
  log(`DIANTRIKAN ${key}.json → grup YSPI Financial ${GRUP_FINANSIAL} atas panggilan alat oleh model; menunggu bukti outbox, belum mengklaim terkirim.`);
}

async function sinkronKalender({ today, uji, argv, config, model, dirs, log }) {
  const key = `kalender-${today}`;
  const sudah = dirs.flatMap(d => fs.existsSync(d) ? fs.readdirSync(d) : []).some(f => f.startsWith(key));
  if (!uji && sudah && !argv.includes('--paksa')) { log('Pengumuman kalender hari ini sudah diantrikan; dilewati.'); return; }
  const { acara } = await ambilAcara(log);
  const hasil = saringBelumDiumumkan(bandingkan(acara, WORKBOOK, today));
  log(`Kalender vs workbook: ${hasil.acaraBaru.length} acara belum tercatat di lembar "Google Calendar"; ${hasil.kegiatanBaru.length} kegiatan baru & ${hasil.tanggalBerubah.length} perubahan tanggal belum diumumkan.`);
  const text = susunPengumuman(hasil);
  if (!text) { log('Tidak ada kegiatan baru atau perubahan tanggal — tidak ada pengumuman kalender.'); return; }
  const keluaran = path.join(DIR, 'hasil'); fs.mkdirSync(keluaran, { recursive: true });
  const stem = `kalender-${today}${uji ? '-uji' : ''}`;
  fs.writeFileSync(path.join(keluaran, stem + '.md'), text);
  if (uji) { console.log('\n' + text + '\n'); log('Mode uji: pengumuman kalender tidak dikirim.'); return; }
  if (!config.aktif || !config.kirim) { log('Pengiriman dimatikan di pengingat.json; pengumuman kalender tidak dikirim.'); return; }
  const status = fs.readFileSync(path.join(BRIDGE, 'status.md'), 'utf8');
  if (!/keadaan: \*\*tersambung\*\*/.test(status)) throw Error('WhatsApp belum tersambung; pengumuman kalender disimpan, belum diantrikan.');
  const kirim = await mintaModelKirim({ model, text, tujuan: GRUP_FINANSIAL, log });
  fs.writeFileSync(path.join(dirs[0], key + (sudah ? '-' + Date.now() : '') + '.json'), JSON.stringify({ to: GRUP_FINANSIAL, text }, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(keluaran, stem + '.kirim.json'), JSON.stringify({ alat: 'kirim_whatsapp', ...kirim, waktu: new Date().toISOString() }, null, 2));
  hasil.catat(new Date().toISOString());
  log(`DIANTRIKAN ${key}.json (pengumuman kalender) → grup YSPI Financial atas panggilan alat oleh model; menunggu bukti outbox.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  utama().catch(e => {
    const line = `${hariIniWIB()} [kewajiban] GAGAL: ${e.message}`;
    console.error(line);
    if (!process.argv.includes('--uji')) try { fs.appendFileSync(LOG, line + '\n'); } catch {}
    process.exitCode = 1;
  });
}
