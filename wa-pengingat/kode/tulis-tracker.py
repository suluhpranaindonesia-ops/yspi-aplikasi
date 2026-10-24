"""Menulis perubahan ke tracker (salinan kerja ATAU tracker Drive sungguhan -
jalurnya ditentukan pemanggil).

Dipanggil terapkan-usulan.mjs (salinan kerja) dan kelola-tracker.mjs (Drive
sungguhan, sejak 23 Sep 2026 - lihat MEKANISME.md). Berkas ini sendiri tidak
tahu dan tidak peduli jalur mana yang diberikan; penjaga jalur ada di pemanggil.

Jenis perubahan (semua opsional, default list kosong):
- tutup:  Outstanding -> Kandidat Close. Redundan (sudah Kandidat Close/Closed)
          dilewati tanpa menyentuh sel.
- buka:   Kandidat Close/Closed -> Outstanding (reopen). Kosongkan H, dan I
          bila sebelumnya Closed. Redundan (sudah Outstanding) dilewati.
- tutupOtomatis: Kandidat Close -> Closed (auto-close 5 hari). Menulis I.
          Item yang bukan Kandidat Close lagi dilewati (sudah ditangani
          manusia di antara pembacaan dan penulisan).
- isiTanggalKandidat: Kandidat Close dengan H kosong -> isi H hari ini, status
          tidak berubah (mulai hitung mundur auto-close).
- baru:   item baru. Terima field topik opsional untuk kolom L.
- kabar:  tambah satu entri K (RIWAYAT) ke item yang SUDAH ADA, tanpa ubah
          status - dipakai saat #log ternyata menunjuk item lama secara
          eksplisit (mis. "#log tambahan F66 ...").

Kolom K (RIWAYAT) selalu di-trim ke maksimal 6 entri terbaru pada setiap
perubahan yang menyentuhnya (entri terlama dibuang) - lihat trim_riwayat().

Pakai: python tulis-tracker.py <workbook> <perubahan.json>
"""
import sys, json, re, datetime, hashlib
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
buku_jalur, ubah_jalur = sys.argv[1], sys.argv[2]
with open(ubah_jalur, encoding='utf-8') as f:
    ubah = json.load(f)

with open(buku_jalur, 'rb') as f:
    sebelum = hashlib.sha256(f.read()).hexdigest()

book = openpyxl.load_workbook(buku_jalur)
sheet = book['Follow Up']
AWAL = 5                      # baris data pertama
ID, JUDUL, PIC, DIBUAT, TARGET, STATUS, BUKTI, KANDIDAT = 1, 2, 3, 4, 5, 6, 7, 8
DITUTUP, SUMBER, RIWAYAT, TOPIK = 9, 10, 11, 12
MAKS_RIWAYAT = 6

baris_per_id, terakhir, nomor_tertinggi = {}, AWAL - 1, 0
for r in range(AWAL, sheet.max_row + 1):
    nilai = sheet.cell(r, ID).value
    kode = str(nilai).strip() if nilai is not None else ''
    if kode.startswith('F') and kode[1:].isdigit():
        baris_per_id[kode] = r
        terakhir = r
        nomor_tertinggi = max(nomor_tertinggi, int(kode[1:]))

hari_ini = datetime.date.today()
stempel = f"({hari_ini.day} {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][hari_ini.month-1]})"
catatan_perubahan = []

def trim_riwayat(teks):
    entri = re.split(r'\n(?=\s*\(\d{1,2}\s)', teks.strip())
    return '\n'.join(entri[:MAKS_RIWAYAT])

def prepend_riwayat(r, catatan):
    lama = str(sheet.cell(r, RIWAYAT).value or '').strip()
    baru = f"{stempel} {catatan}"
    sheet.cell(r, RIWAYAT).value = trim_riwayat(f'{baru}\n{lama}' if lama else baru)

def ambil_id(item, kamus):
    kode = item['id']
    if kode not in kamus:
        raise SystemExit(f'ID {kode} tidak ada di tracker; tidak ada yang ditulis.')
    return kamus[kode]

for item in ubah.get('tutup', []):
    kode = item['id']
    r = ambil_id(item, baris_per_id)
    status_lama = str(sheet.cell(r, STATUS).value or '').strip()
    if status_lama == 'Closed':
        catatan_perubahan.append(f'{kode}: sudah Closed, dilewati')
        continue
    if status_lama == 'Kandidat Close':
        # #close pada item yang sudah Kandidat Close itu redundan - jangan
        # reset H, karena itu akan menunda jam auto-close tanpa alasan.
        catatan_perubahan.append(f'{kode}: sudah Kandidat Close, redundan (H tidak diubah)')
        continue
    sheet.cell(r, STATUS).value = 'Kandidat Close'
    sheet.cell(r, KANDIDAT).value = hari_ini.isoformat()
    prepend_riwayat(r, item['catatan'])
    catatan_perubahan.append(f'{kode}: {status_lama} -> Kandidat Close')

for item in ubah.get('buka', []):
    kode = item['id']
    r = ambil_id(item, baris_per_id)
    status_lama = str(sheet.cell(r, STATUS).value or '').strip()
    if status_lama == 'Outstanding':
        catatan_perubahan.append(f'{kode}: sudah Outstanding, redundan')
        continue
    sheet.cell(r, STATUS).value = 'Outstanding'
    sheet.cell(r, KANDIDAT).value = None
    if status_lama == 'Closed':
        sheet.cell(r, DITUTUP).value = None
    prepend_riwayat(r, item['catatan'])
    catatan_perubahan.append(f'{kode}: {status_lama} -> Outstanding (dibuka lagi)')

for item in ubah.get('tutupOtomatis', []):
    kode = item['id']
    r = ambil_id(item, baris_per_id)
    status_lama = str(sheet.cell(r, STATUS).value or '').strip()
    if status_lama != 'Kandidat Close':
        # Sudah ditangani manusia (ditutup/dibuka) di antara pembacaan dan
        # penulisan - jangan menimpa keputusan itu.
        catatan_perubahan.append(f'{kode}: status sudah {status_lama} (bukan Kandidat Close), auto-close dilewati')
        continue
    sheet.cell(r, STATUS).value = 'Closed'
    sheet.cell(r, DITUTUP).value = item['ditutup']
    prepend_riwayat(r, item['catatan'])
    catatan_perubahan.append(f'{kode}: Kandidat Close -> Closed (auto-close)')

for item in ubah.get('isiTanggalKandidat', []):
    kode = item['id']
    r = ambil_id(item, baris_per_id)
    if str(sheet.cell(r, STATUS).value or '').strip() != 'Kandidat Close':
        catatan_perubahan.append(f'{kode}: bukan/bukan lagi Kandidat Close, dilewati')
        continue
    if str(sheet.cell(r, KANDIDAT).value or '').strip():
        catatan_perubahan.append(f'{kode}: H sudah terisi, dilewati')
        continue
    sheet.cell(r, KANDIDAT).value = hari_ini.isoformat()
    catatan_perubahan.append(f'{kode}: H kosong, diisi {hari_ini.isoformat()} (mulai hitung mundur auto-close)')

for item in ubah.get('kabar', []):
    kode = item['id']
    r = ambil_id(item, baris_per_id)
    prepend_riwayat(r, item['catatan'])
    catatan_perubahan.append(f'{kode}: kabar ditambahkan (status tidak berubah)')

for item in ubah.get('baru', []):
    nomor_tertinggi += 1
    terakhir += 1
    kode = f'F{nomor_tertinggi}'
    sheet.cell(terakhir, ID).value = kode
    sheet.cell(terakhir, JUDUL).value = item['judul']
    sheet.cell(terakhir, PIC).value = item.get('pic', '')
    sheet.cell(terakhir, DIBUAT).value = hari_ini.isoformat()
    sheet.cell(terakhir, TARGET).value = item.get('target', '')
    sheet.cell(terakhir, STATUS).value = 'Outstanding'
    sheet.cell(terakhir, SUMBER).value = item.get('sumber') or 'WhatsApp grup YSPI team'
    sheet.cell(terakhir, RIWAYAT).value = trim_riwayat(f"{stempel} {item['catatan']}")
    sheet.cell(terakhir, TOPIK).value = item.get('topik', '')
    catatan_perubahan.append(f"{kode} baru: {item['judul'][:60]}")

for item in ubah.get('topik', []):
    # Isi kolom L untuk item lama yang sudah ada tapi Topik-nya kosong,
    # tanpa menyentuh sel lain.
    kode = item['id']
    r = ambil_id(item, baris_per_id)
    sheet.cell(r, TOPIK).value = item['topik']
    catatan_perubahan.append(f"{kode}: Topik diisi {item['topik']}")

# riwayat (opsional, dikirim kelola-tracker.mjs): catat putaran ini sebagai satu
# baris di sheet "Riwayat Agen", dalam simpanan yang sama dengan perubahannya.
if ubah.get('riwayat'):
    import riwayat_agen
    rw = ubah['riwayat']
    riwayat_agen.tambah(book, rw.get('proses', 'kelola-tracker'), rw.get('mode', ''),
                        rw.get('hasil', 'tracker diubah'), rw.get('ringkasan', ''), '\n'.join(catatan_perubahan))

book.save(buku_jalur)
book.close()

with open(buku_jalur, 'rb') as f:
    sesudah = hashlib.sha256(f.read()).hexdigest()

print(json.dumps({
    'berkas': buku_jalur,
    'sha256_sebelum': sebelum,
    'sha256_sesudah': sesudah,
    'berubah': sebelum != sesudah,
    'perubahan': catatan_perubahan,
}, ensure_ascii=False, indent=2))
