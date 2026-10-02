@echo off
REM Satu putaran pengingat YSPI. Dipanggil Penjadwal Tugas Windows.
REM Argumen: pagi | sore   (tambah --uji untuk tidak mengirim)
REM
REM Jalur node ditulis penuh: PATH di sesi Penjadwal Tugas belum tentu sama
REM dengan PATH di jendela perintah biasa.
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "C:\Users\suluh\wa-konsol\pengingat\jalankan.mjs" %*
