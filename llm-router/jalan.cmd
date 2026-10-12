@echo off
REM Router model lokal YSPI, port 3467 (hanya 127.0.0.1). Dijalankan penjaga.
REM node LANGSUNG (bukan lewat start) supaya cmd.exe tetap hidup sebagai induk.
title Router Model Lokal YSPI
cd /d "C:\Users\suluh\My Drive\SPI-Kerja\llm-router"
node server.mjs
