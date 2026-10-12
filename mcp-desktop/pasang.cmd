@echo off
title Pasang MCP ke Claude Desktop
echo Berkas ini akan MENUTUP Claude Desktop, memasang jembatan-claude dan laporan-guru,
echo lalu MEMBUKA Claude lagi. Percakapan Claude tidak hilang.
echo.
echo Jangan tutup jendela ini sampai muncul tulisan BERHASIL (sekitar 3 menit).
echo.
pause
cd /d "C:\Users\suluh\My Drive\SPI-Kerja\mcp-desktop"
node pasang.mjs
echo.
pause
