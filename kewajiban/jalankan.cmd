@echo off
REM Satu putaran Pengingat Kewajiban Finansial YSPI. Dipanggil Penjadwal Tugas
REM lewat jalankan-diam.vbs. Tambah --uji untuk tidak mengirim.
REM
REM Jalur node ditulis penuh: PATH di sesi Penjadwal Tugas belum tentu sama
REM dengan PATH di jendela perintah biasa.
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "C:\Users\suluh\My Drive\SPI-Kerja\kewajiban\kewajiban.mjs" %*
