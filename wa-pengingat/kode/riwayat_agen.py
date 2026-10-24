"""Sheet "Riwayat Agen" di tracker: satu baris per putaran agen.

Kenapa ada (24 Okt 2026, permintaan pengguna): dulu setiap putaran membuat
berkas baru (pesan-/bahan-/audit-/kirim- per hari di WA-Lokal/pengingat,
cadangan-/perubahan-drive-* per tulisan di tracker-kerja) sampai ratusan
berkas menumpuk. Sekarang catatannya jadi baris di workbook yang sama, dan
berkas pendukung memakai nama tetap yang ditimpa.

Sheet "Follow Up" tidak pernah disentuh berkas ini. Sheet baru selalu
ditaruh di belakang, jadi "Follow Up" tetap sheet pertama dan sheet aktif.
Baris terbaru di atas (baris 2); yang terlama dibuang lewat MAKS_BARIS.

Dua cara pakai:
- modul: tulis-tracker.py memanggil tambah(book, ...) sebelum book.save(),
  supaya perubahan item dan catatannya tersimpan dalam satu kali simpan;
- CLI : python riwayat_agen.py <workbook>  dengan JSON
        {"proses","mode","hasil","ringkasan","rincian"} di stdin.
"""
import sys, json, datetime
import openpyxl
from openpyxl.styles import Alignment, Font

NAMA = 'Riwayat Agen'
KOLOM = ['Waktu (WIB)', 'Proses', 'Mode', 'Hasil', 'Ringkasan', 'Rincian']
LEBAR = [18, 16, 12, 28, 60, 90]
MAKS_BARIS = 730          # +- setahun pada dua putaran sehari
MAKS_SEL = 32000          # batas Excel 32.767 huruf per sel

def _sheet(book):
    if NAMA in book.sheetnames:
        return book[NAMA]
    ws = book.create_sheet(NAMA)
    ws.append(KOLOM)
    for i, lebar in enumerate(LEBAR, start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = lebar
        ws.cell(1, i).font = Font(bold=True)
    ws.freeze_panes = 'A2'
    return ws

def _potong(teks):
    teks = '' if teks is None else str(teks)
    return teks if len(teks) <= MAKS_SEL else teks[:MAKS_SEL] + '\n... (dipotong: melebihi batas sel Excel)'

def tambah(book, proses, mode='', hasil='', ringkasan='', rincian=''):
    ws = _sheet(book)
    ws.insert_rows(2)
    waktu = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime('%Y-%m-%d %H:%M')
    for i, nilai in enumerate([waktu, proses, mode, hasil, ringkasan, rincian], start=1):
        sel = ws.cell(2, i)
        sel.value = _potong(nilai)
        sel.alignment = Alignment(wrap_text=True, vertical='top')
    if ws.max_row > MAKS_BARIS + 1:
        ws.delete_rows(MAKS_BARIS + 2, ws.max_row - MAKS_BARIS - 1)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stdin.reconfigure(encoding='utf-8')
    jalur = sys.argv[1]
    data = json.load(sys.stdin)
    book = openpyxl.load_workbook(jalur)
    tambah(book, data.get('proses', ''), data.get('mode', ''), data.get('hasil', ''), data.get('ringkasan', ''), data.get('rincian', ''))
    book.save(jalur)
    book.close()
    print(json.dumps({'berkas': jalur, 'sheet': NAMA}, ensure_ascii=False))
