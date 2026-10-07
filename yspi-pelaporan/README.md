# Website Pelaporan Guru YSPI

Website pengurus untuk cerita & pencapaian guru: https://yspi-pelaporan.danielwilliamputratheo.workers.dev

- **Data & login:** Supabase proyek `qpqpvktvezdqzdcpueve` (akun GitHub `suluhpranaindonesia-ops`).
  Pengurus login email + password; akses data dijaga RLS (`yspi_members`).
- **Hosting:** Cloudflare Worker `yspi-pelaporan`.
- **Deploy:** otomatis lewat GitHub Actions (`.github/workflows/deploy-pelaporan.yml`) setiap push
  ke `main` yang mengubah folder ini. Perlu secret repo `CLOUDFLARE_API_TOKEN` dan
  `CLOUDFLARE_ACCOUNT_ID`; tanpa itu workflow hanya build.
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
