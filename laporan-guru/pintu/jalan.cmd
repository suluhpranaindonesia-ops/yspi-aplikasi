@echo off
REM Pintu laporan guru (HTTP lokal), port 3468 (hanya 127.0.0.1). Dijalankan penjaga.
REM node LANGSUNG (bukan lewat start) supaya cmd.exe tetap hidup sebagai induk.
title Pintu Laporan Guru YSPI
cd /d "C:\Users\suluh\My Drive\SPI-Kerja\laporan-guru\pintu"
node server.mjs
