# Pintu laporan guru

Satu lapisan baca/ubah atas Supabase "Pelaporan Guru YSPI", supaya model apa pun
(model lokal, Claude, Codex) membaca laporan guru dalam bentuk yang sama, dengan
nama kolom Indonesia dan tanpa perlu tahu skema Supabase.

Dua pintu, logika yang sama (`inti.mjs`):

| Pintu | Untuk | Cara |
|---|---|---|
| HTTP lokal, port **3468** | program & model lokal | `server.mjs`, dijaga penjaga |
| MCP (stdio) | Claude Code, Claude Desktop, DSH, Codex | `mcp.mjs` |

## Alat

| Alat | HTTP | Isi |
|---|---|---|
| `daftar_laporan` | `GET /laporan?jenis=&sekolah=&guru=&wilayah=&status=&sejak=&sampai=&cari=&batas=&mentah=1` | daftar, terbaru dulu |
| `lihat_laporan` | `GET /laporan/<id>[?mentah=1]` | satu laporan |
| `ringkasan_laporan` | `GET /ringkasan` | angka per jenis/sekolah/wilayah/bulan/status, total siswa & dana (dihitung program) |
| `ubah_laporan` | `PATCH /laporan/<id>` `{"perubahan":{...},"oleh":"...","alasan":"..."}` | ubah kolom isi |

`GET /alat` memberi definisi alat dalam format tools Ollama/OpenAI, dan `POST /alat/<nama>`
menjalankannya, jadi model lokal bisa memakai alat yang sama dengan MCP.

## Aturan

- Nomor HP guru tidak pernah keluar. Pesan asli WhatsApp hanya bila diminta (`mentah`).
- Kolom yang boleh diubah: guru, sekolah, wilayah, tanggal, sesi, siswa, kegiatan, dampak,
  kendala, dana_diterima, dana_dipakai, catatan_dana. Status periksa/kendala, sumber, dan
  menghapus laporan tetap lewat website Pelaporan Guru.
- Laporan yang sudah **Disetujui** admin tidak bisa diubah lewat pintu ini (dicek dua kali:
  sebelum dan saat menulis).
- `oleh` wajib diisi. Setiap ubahan dicatat dengan nilai sebelum & sesudah di
  `laporan-guru/data/ubah-laporan.jsonl` (tidak ikut git), jadi bisa dibalik.
- Hanya dari PC ini: server mendengar di 127.0.0.1 dan menolak Host selain 127.0.0.1/localhost.
- Kunci Supabase dibuka dari konfigurasi penghubung (DPAPI), sama seperti `sinkron.mjs`.

## Terdaftar di

- Claude Code: `SPI-Kerja/.mcp.json`
- Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json`, dipasang lewat
  `SPI-Kerja\mcp-desktop\pasang.cmd` (Desktop menimpa suntingan dari luar selama masih terbuka)
- DSH: `~/.dsh/profiles/web/cordis.patch.yml` (berlaku di sesi DSH baru)
- Codex: `~/.codex/config.toml`

## Uji

```
node uji.mjs
```
