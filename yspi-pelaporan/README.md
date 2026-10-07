# Website Pelaporan Guru YSPI

Website pengurus untuk cerita & pencapaian guru: https://yspi-pelaporan.danielwilliamputratheo.workers.dev

- **Data & login:** Supabase proyek `qpqpvktvezdqzdcpueve` (akun GitHub `suluhpranaindonesia-ops`).
  Pengurus login email + password; akses data dijaga RLS (`yspi_members`).
- **Hosting:** Cloudflare Worker `yspi-pelaporan`.
- **Deploy:** otomatis lewat **Cloudflare Workers Builds** yang tersambung ke repo ini (aplikasi
  GitHub "Cloudflare Workers and Pages", hanya untuk repo `yspi-aplikasi`). Setiap push ke `main`:
  root `/yspi-pelaporan`, build `npm run build`, deploy
  `npx wrangler deploy --config wrangler.production.json`. Variabel Supabase tersimpan sebagai
  secret di Worker, bukan di repo.
- **Cek build di GitHub:** `.github/workflows/deploy-pelaporan.yml` ikut membangun setiap perubahan
  folder ini; langkah deploy-nya dilewati karena repo tidak menyimpan token Cloudflare.
- **Isi laporan** datang dari bot WhatsApp + AI lokal (qwen3:8b) di PC kantor, bukan dari website ini.

Folder ini adalah sumber resmi kodenya. Salinan lama di folder Codex tidak dipakai untuk deploy lagi.

## Kerja lokal

```
npm ci
npm run dev      # pratinjau di http://localhost:5173 (butuh .dev.vars, tidak ikut repo)
npm run build
```

`.dev.vars` berisi `YSPI_AUTH_MODE=supabase`, `SUPABASE_URL`, dan `SUPABASE_PUBLISHABLE_KEY`
(hanya kunci publishable, tidak pernah secret key).

Berkas `app/chatgpt-auth.ts` dan rute lama di `lib/server.ts` adalah sisa versi ChatGPT Sites;
tidak dipakai selama `YSPI_AUTH_MODE=supabase`.
