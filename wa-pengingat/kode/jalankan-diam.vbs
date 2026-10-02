' Menjalankan satu putaran pengingat TANPA jendela konsol.
'
' Kenapa perlu perantara ini: Penjadwal Tugas menjalankan aksinya di sesi
' pengguna yang sedang masuk - itu memang harus, karena vault ada di G:
' (Google Drive) yang hanya ada di sesi itu. Tapi menjalankan .cmd dari sana
' memunculkan jendela konsol hitam di layar. Sekali jendela itu ditutup orang,
' putarannya mati dengan kode 0xC000013A (Ctrl+C) di tengah jalan - persis yang
' terjadi 9 Sep 10.15, saat model sudah 1.600 token.
'
' WScript.Shell.Run dengan gaya jendela 0 menjalankannya benar-benar tersembunyi,
' jadi tidak ada jendela yang bisa tertutup. Argumen ketiga True membuat skrip ini
' menunggu sampai selesai, supaya durasi & kode hasil di Penjadwal Tugas tetap
' mencerminkan putaran yang sebenarnya.
'
' Pakai: wscript.exe jalankan-diam.vbs pagi

Option Explicit

Dim shell, sesi, uji, perintah, kode, i
Set shell = CreateObject("WScript.Shell")

sesi = "pagi"
uji = ""
For i = 0 To WScript.Arguments.Count - 1
  Dim a
  a = LCase(Trim(WScript.Arguments(i)))
  If a = "pagi" Or a = "sore" Then
    sesi = a
  ElseIf a = "--uji" Then
    ' Diteruskan apa adanya: tanpa ini putaran uji diam-diam berubah jadi
    ' putaran sungguhan dan pesannya benar-benar terkirim ke orang.
    uji = " --uji"
  End If
Next

perintah = """C:\Users\suluh\wa-konsol\pengingat\jalankan.cmd"" " & sesi & uji
kode = shell.Run(perintah, 0, True)

WScript.Quit kode
