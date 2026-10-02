' Menjalankan satu putaran Pengingat Kewajiban TANPA jendela konsol - alasan
' sama dengan wa-konsol\pengingat\jalankan-diam.vbs: jendela konsol yang
' tertutup orang mematikan putaran di tengah jalan.
'
' Pakai: wscript.exe jalankan-diam.vbs [--uji]

Option Explicit

Dim shell, uji, perintah, kode, i
Set shell = CreateObject("WScript.Shell")

uji = ""
For i = 0 To WScript.Arguments.Count - 1
  If LCase(Trim(WScript.Arguments(i))) = "--uji" Then uji = " --uji"
Next

perintah = """C:\Users\suluh\My Drive\SPI-Kerja\kewajiban\jalankan.cmd""" & uji
kode = shell.Run(perintah, 0, True)

WScript.Quit kode
