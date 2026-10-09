# YSPI — Cerita & Pencapaian Guru (website pelaporan, Vercel)

Website pelaporan guru yang sedang dipakai: https://yspi-cerita-pencapaian.vercel.app
(project Vercel `yspi-cerita-pencapaian`). Data dan login ada di Supabase
"Pelaporan Guru YSPI".

## Deploy

Sejak 9 Okt 2026 project Vercel tersambung ke repo ini dengan Root Directory
`yspi-vercel`. Setiap push ke `main` yang mengubah folder ini otomatis
dideploy ke produksi; push yang hanya mengubah folder lain dilewati.

Variabel lingkungan (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`YSPI_AUTH_MODE`) disimpan di pengaturan project Vercel, bukan di repo.

Folder kerja lama di `Documents\Codex\2026-09-14\co\outputs\yspi-vercel`
tidak dipakai lagi untuk deploy; ubah kode di sini.

`yspi-pelaporan/` di repo ini adalah versi lama untuk Cloudflare Workers yang
sudah dipensiunkan.
