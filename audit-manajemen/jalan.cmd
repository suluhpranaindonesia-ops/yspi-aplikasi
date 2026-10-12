@echo off
REM Audit Management Checker YSPI, port 3466 (hanya 127.0.0.1). Dijalankan penjaga.
REM node LANGSUNG (bukan lewat start) supaya cmd.exe tetap hidup sebagai induk.
title Audit Management Checker YSPI
cd /d "C:\Users\suluh\My Drive\SPI-Kerja\audit-manajemen"
node server.mjs
