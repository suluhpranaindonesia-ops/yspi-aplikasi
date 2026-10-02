@echo off
REM Sinkron satu arah Supabase -> Drive DRAFT\Laporan Guru, port 3463. Dijalankan penjaga.
REM node LANGSUNG (bukan lewat start) supaya cmd.exe tetap hidup sebagai induk.
title Sinkron Laporan Guru YSPI
cd /d "C:\Users\suluh\My Drive\SPI-Kerja\laporan-guru"
node sinkron.mjs
