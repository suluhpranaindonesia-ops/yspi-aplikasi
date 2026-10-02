// Sinkron Google Calendar YSPI -> pembanding workbook jadwal (tahap 1: BACA saja).
//
// Dua sumber, dipakai berurutan:
//   1. kalender/kalender-yspi.json — ditulis Apps Script (apps-script/Kode.gs)
//      di Google Drive, tersinkron ke PC. Dipakai kalau umurnya < 36 jam.
//   2. kalender.txt — alamat rahasia iCal (.ics). Diunduh & acara berulang
//      dijabarkan sendiri di sini.
//
// Hasilnya dibandingkan dengan lembar "Google Calendar" di workbook — logika
// sama dengan jadwal_sync_kalender() versi Python — tetapi workbook TIDAK
// ditulis. Kegiatan baru / tanggal berubah dicatat di kalender-state.json
// supaya diumumkan sekali saja, bukan setiap pagi sampai Excel diperbarui.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bacaWorkbook, keTanggal } from './baca-xlsx.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const BERKAS_JSON = process.env.KALENDER_JSON || path.join(DIR, 'kalender', 'kalender-yspi.json'); // env hanya untuk uji
export const BERKAS_URL = path.join(DIR, 'kalender.txt');
const STATE = path.join(DIR, 'kalender-state.json');
const JENDELA = ['2026-09-01', '2028-05-31'];
const UMUR_MAKS_JAM = 36;
const POLA_RUTIN = /rapat bulanan|minimba|deadline|batas waktu|tenggat|pengingat|reminder|ulang tahun|libur|rekonsiliasi|zoom persiapan|rapat zoom/i;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmt = d => d ? `${+d.slice(8)} ${BULAN[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '-';
const ms = d => Date.parse(d + 'T00:00:00Z');
const geser = (d, n) => new Date(ms(d) + n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Sumber 2: iCal
// ---------------------------------------------------------------------------
function unfold(txt) { return txt.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); }
const unesc = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function parseVevents(txt) {
  const out = [];
  for (const blok of unfold(txt).split('BEGIN:VEVENT').slice(1)) {
    const isi = blok.split('END:VEVENT')[0];
    const ev = {};
    for (const baris of isi.split('\n')) {
      const m = baris.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
      if (!m) continue;
      const [, nama, param, nilai] = m;
      const p = Object.fromEntries(param.split(';').filter(Boolean).map(x => x.split('=')));
      if (nama === 'EXDATE') (ev.EXDATE ||= []).push(...nilai.split(',').map(v => ({ v, p })));
      else ev[nama] = { v: nilai, p };
    }
    out.push(ev);
  }
  return out;
}

// Offset (menit) zona waktu tz pada saat utcMs, lewat Intl.
function offsetMenit(tz, utcMs) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const b = Object.fromEntries(f.formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return (Date.UTC(+b.year, b.month - 1, +b.day, +b.hour, +b.minute) - utcMs) / 60000;
}
// Nilai tanggal iCal -> { tanggal: 'YYYY-MM-DD', menit: menit-dari-tengah-malam WIB | null (sepanjang hari) }
function waktuWIB({ v, p }) {
  if (p.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { tanggal: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, menit: null };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  let utc = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (!m[7]) {
    const tz = p.TZID || 'Asia/Jakarta';
    try { utc -= offsetMenit(tz, utc) * 60000; } catch { utc -= 7 * 3600000; }
  }
  const w = new Date(utc + 7 * 3600000);
  return { tanggal: w.toISOString().slice(0, 10), menit: w.getUTCHours() * 60 + w.getUTCMinutes() };
}
const HARI = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Jabarkan RRULE (subset yang dipakai Google Calendar: DAILY/WEEKLY/MONTHLY/
// YEARLY, INTERVAL, COUNT, UNTIL, BYDAY dengan/ tanpa urutan, BYMONTHDAY, BYMONTH).
function jabarkan(awal, rrule, batas) {
  const r = Object.fromEntries(rrule.split(';').map(x => x.split('=')));
  const interval = +(r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : '9999-12-31';
  const byday = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return { n: m[1] ? +m[1] : null, h: HARI[m[2]] }; }) : null;
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const bymon = r.BYMONTH ? r.BYMONTH.split(',').map(Number) : null;
  const d0 = new Date(ms(awal));
  const hasil = [];
  const iso = d => d.toISOString().slice(0, 10);
  const hariDalamBulan = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  function tanggalBulan(y, m) { // kandidat dalam satu bulan (MONTHLY/YEARLY)
    const n = hariDalamBulan(y, m), c = [];
    if (byday) {
      for (const { n: urut, h } of byday) {
        const semua = [];
        for (let d = 1; d <= n; d++) if (new Date(Date.UTC(y, m, d)).getUTCDay() === h) semua.push(d);
        if (urut === null) c.push(...semua); else { const d = urut > 0 ? semua[urut - 1] : semua[semua.length + urut]; if (d) c.push(d); }
      }
    } else if (bymd) {
      for (const x of bymd) { const d = x > 0 ? x : n + x + 1; if (d >= 1 && d <= n) c.push(d); }
    } else if (d0.getUTCDate() <= n) c.push(d0.getUTCDate());
    return [...new Set(c)].sort((a, b) => a - b).map(d => iso(new Date(Date.UTC(y, m, d))));
  }
  let jumlah = 0;
  const tambah = t => {
    if (t < awal || jumlah >= count || t > until) return false;
    jumlah++;
    if (t <= batas) hasil.push(t);
    return true;
  };
  for (let i = 0; i < 5000 && jumlah < count; i++) {
    let kandidat = [];
    if (r.FREQ === 'DAILY') kandidat = [iso(new Date(ms(awal) + i * interval * 86400000))];
    else if (r.FREQ === 'WEEKLY') {
      const senin = ms(awal) - ((d0.getUTCDay() + 6) % 7) * 86400000 + i * interval * 7 * 86400000;
      const hari = byday ? byday.map(x => x.h) : [d0.getUTCDay()];
      kandidat = hari.map(h => iso(new Date(senin + ((h + 6) % 7) * 86400000))).sort();
    } else if (r.FREQ === 'MONTHLY') {
      const k = d0.getUTCMonth() + i * interval;
      kandidat = tanggalBulan(d0.getUTCFullYear() + Math.floor(k / 12), k % 12);
    } else if (r.FREQ === 'YEARLY') {
      const y = d0.getUTCFullYear() + i * interval;
      for (const m of bymon ? bymon.map(x => x - 1) : [d0.getUTCMonth()]) kandidat.push(...(byday || bymd ? tanggalBulan(y, m) : [iso(new Date(Date.UTC(y, m, d0.getUTCDate())))]));
    } else throw Error(`RRULE FREQ=${r.FREQ} belum didukung.`);
    const ujung = until < batas ? until : batas;
    if (kandidat.length && kandidat.every(t => t > ujung)) break;
    kandidat.forEach(tambah);
  }
  return hasil;
}

export function acaraDariIcs(txt) {
  const ves = parseVevents(txt);
  const ganti = new Map(); // uid|tanggal-asli -> VEVENT pengganti (RECURRENCE-ID)
  for (const ev of ves) if (ev['RECURRENCE-ID'] && ev.UID) ganti.set(ev.UID.v + '|' + waktuWIB(ev['RECURRENCE-ID']).tanggal, ev);
  const out = [];
  const rakit = (ev, tanggal, geserHari, dur, berulang, pola) => {
    const s = waktuWIB(ev.DTSTART);
    const allDay = s.menit === null;
    const end = allDay ? geser(tanggal, Math.max(0, dur - 1)) : geser(tanggal, dur);
    const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return {
      uid: ev.UID?.v || '', start: tanggal, end,
      waktu: allDay ? 'Sepanjang hari' : `${hhmm(s.menit)}–${hhmm(geserHari)}`,
      judul: unesc(ev.SUMMARY?.v || '(tanpa judul)').trim(),
      lokasi: unesc(ev.LOCATION?.v || '').trim() || null,
      berulang, pola,
    };
  };
  for (const ev of ves) {
    if (ev['RECURRENCE-ID'] || !ev.DTSTART) continue;
    if (ev.STATUS?.v === 'CANCELLED') continue;
    const s = waktuWIB(ev.DTSTART), e = ev.DTEND ? waktuWIB(ev.DTEND) : s;
    if (!s) continue;
    const dur = Math.round((ms(e.tanggal) - ms(s.tanggal)) / 86400000); // selisih hari
    const menitAkhir = e.menit ?? s.menit;
    const tanggalList = ev.RRULE ? jabarkan(s.tanggal, ev.RRULE.v, JENDELA[1]) : [s.tanggal];
    const ex = new Set((ev.EXDATE || []).map(x => waktuWIB(x)?.tanggal));
    for (const t of tanggalList) {
      if (ex.has(t)) continue;
      const g = ganti.get(ev.UID?.v + '|' + t);
      if (g) {
        if (g.STATUS?.v === 'CANCELLED') continue;
        const gs = waktuWIB(g.DTSTART), ge = g.DTEND ? waktuWIB(g.DTEND) : gs;
        out.push(rakit(g, gs.tanggal, ge.menit ?? gs.menit, Math.round((ms(ge.tanggal) - ms(gs.tanggal)) / 86400000), true, ev.RRULE.v));
        continue;
      }
      out.push(rakit(ev, t, menitAkhir, dur, !!ev.RRULE, ev.RRULE?.v || null));
    }
  }
  return out.filter(a => a.end >= JENDELA[0] && a.start <= JENDELA[1])
    .sort((a, b) => (a.start + a.judul).localeCompare(b.start + b.judul));
}

// ---------------------------------------------------------------------------
// Ambil acara dari sumber yang tersedia
// ---------------------------------------------------------------------------
export async function ambilAcara(log = () => {}) {
  const alasan = [];
  if (fs.existsSync(BERKAS_JSON)) {
    const j = JSON.parse(fs.readFileSync(BERKAS_JSON, 'utf8'));
    const umur = (Date.now() - Date.parse(j.dibuat)) / 3600000;
    if (umur <= UMUR_MAKS_JAM) {
      log(`Sumber kalender: Apps Script ("${j.kalender}", ${j.acara.length} acara, umur ${umur.toFixed(1)} jam).`);
      return { sumber: 'apps-script', acara: j.acara.map(a => ({ ...a, pola: a.berulang ? 'berulang' : null })) };
    }
    alasan.push(`berkas Apps Script sudah ${umur.toFixed(0)} jam tidak diperbarui`);
  } else alasan.push('berkas Apps Script belum ada');
  const url = fs.existsSync(BERKAS_URL) ? fs.readFileSync(BERKAS_URL, 'utf8').split(/\s+/).find(x => /^https:\/\/.+/.test(x)) : null;
  if (url) {
    const res = await fetch(url, { headers: { 'user-agent': 'YSPI-kewajiban' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw Error(`Unduh iCal gagal: HTTP ${res.status} (${alasan.join('; ')}).`);
    const acara = acaraDariIcs(await res.text());
    log(`Sumber kalender: alamat iCal (${acara.length} acara; ${alasan.join('; ')}).`);
    return { sumber: 'ical', acara };
  }
  alasan.push('kalender.txt belum berisi alamat iCal');
  throw Error('Tidak ada sumber Google Calendar: ' + alasan.join('; ') + '.');
}

// ---------------------------------------------------------------------------
// Bandingkan dengan workbook (tanpa menulis)
// ---------------------------------------------------------------------------
export function bandingkan(acara, workbook, today) {
  const wb = bacaWorkbook(workbook);
  const wc = wb.sheet('Google Calendar');
  const ada = new Set(), perUid = new Map();
  for (let r = 5; r <= wc.maxRow; r++) {
    const uid = wc.cell('H' + r).v; if (!uid) continue;
    const s = keTanggal(wc.cell('A' + r).v);
    ada.add(uid + '|' + s);
    if (!perUid.has(uid)) perUid.set(uid, []);
    perUid.get(uid).push({ start: s, kode: wc.cell('G' + r).v });
  }
  const acaraBaru = [], kegiatanBaru = [], tanggalBerubah = [];
  for (const ev of acara) {
    if (ada.has(ev.uid + '|' + ev.start)) continue;
    const lama = perUid.get(ev.uid) || [];
    if (!ev.berulang && lama.length === 1) {
      const kode = lama[0].kode && lama[0].kode !== '—' ? lama[0].kode : '-';
      tanggalBerubah.push({ kunci: `ubah|${ev.uid}|${ev.start}`, teks: `${kode} ${ev.judul}: ${fmt(lama[0].start)} → ${fmt(ev.start)}` });
      continue;
    }
    acaraBaru.push(ev);
    const terkait = lama.some(x => x.kode);
    if (!ev.berulang && !POLA_RUTIN.test(ev.judul) && ev.start >= today && !terkait) {
      kegiatanBaru.push({ kunci: `baru|${ev.uid}|${ev.start}`, judul: ev.judul, tanggal: fmt(ev.start), batas: fmt(geser(ev.start, -14)), lewat: geser(ev.start, -14) < today });
    }
  }
  return { acaraBaru, kegiatanBaru, tanggalBerubah };
}

// Pesan pengumuman — kata-kata mengikuti jadwal_proses() versi Python,
// disesuaikan: belum ada lembar Kxx karena workbook tidak ditulis otomatis.
export function susunPengumuman({ kegiatanBaru, tanggalBerubah }) {
  if (!kegiatanBaru.length && !tanggalBerubah.length) return null;
  const baris = ['Selamat pagi Bapak dan Ibu pengurus 🙏', '', 'Pembaruan otomatis dari Google Calendar YSPI:'];
  for (const k of kegiatanBaru) {
    baris.push(`• Kegiatan baru — ${k.judul}, ${k.tanggal}. ` + (k.lewat
      ? `Batas kirim file pengeluaran (H-14, ${k.batas}) sudah lewat — PIC mohon segera mengirim.`
      : `PIC mohon mengirim file pengeluaran paling lambat ${k.batas} (H-14).`));
  }
  for (const t of tanggalBerubah) baris.push(`• Tanggal berubah: ${t.teks}`);
  baris.push('', 'Mohon kegiatan baru dicatat di lembar kegiatan & Daftar Kegiatan pada file DRAFT/ops/YSPI-Jadwal-Rutin-dan-Kegiatan-2026-2027.xlsx, dan tanggal yang berubah diperbarui. Terima kasih 🙏');
  return baris.join('\n').replace(/#/g, '');
}

// Buang yang sudah pernah diumumkan; kembalikan juga fungsi untuk mencatatnya.
export function saringBelumDiumumkan(hasil) {
  let state = {};
  try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  const sudah = new Set(Object.keys(state.diumumkan || {}));
  const baru = {
    ...hasil,
    kegiatanBaru: hasil.kegiatanBaru.filter(k => !sudah.has(k.kunci)),
    tanggalBerubah: hasil.tanggalBerubah.filter(t => !sudah.has(t.kunci)),
  };
  const catat = waktu => {
    state.diumumkan ||= {};
    for (const x of [...baru.kegiatanBaru, ...baru.tanggalBerubah]) state.diumumkan[x.kunci] = waktu;
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  };
  return { ...baru, catat };
}
