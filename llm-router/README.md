# Router model lokal YSPI

Port **3467** (hanya 127.0.0.1), dijaga penjaga (`penjaga.json`). Halaman pengaturan:
http://127.0.0.1:3467

Router ini meniru API Ollama. Aplikasi cukup diarahkan ke `http://127.0.0.1:3467`,
bukan ke `:11434`, lalu router memilih model sesuai **tingkat** pekerjaannya:

| Tingkat | Untuk |
|---|---|
| ringan | sarikan pesan jadi JSON, isi kolom, panggil satu alat |
| sedang | merangkai kalimat, mengobrol dengan konteks yang dibatasi program |
| berat | menimbang konteks panjang, menulis bebas dengan aturan ketat, salahnya berisiko |

## Cara mengganti model

- Lewat halaman http://127.0.0.1:3467: pilih model di kolom tingkat. Yang muncul hanya
  model yang sudah terpasang di Ollama.
- Atau sunting `router.json` langsung. Berlaku pada panggilan berikutnya tanpa restart;
  kalau JSON-nya rusak, versi sah terakhir tetap dipakai dan galatnya tampil di `/status`.
- Setiap perubahan lewat halaman mencadangkan `router.json` ke `data/cadangan/`.

## Cara tugas dikenali

1. Model bernama `tugas:<nama>` → tugas itu (untuk kode baru).
2. Model bernama `tingkat:ringan|sedang|berat` → tingkat itu langsung.
3. Prompt sistem memuat teks `cocok` milik salah satu tugas di `router.json` → tugas itu.
   Dengan cara ini aplikasi lama tidak perlu diubah kodenya.
4. Tidak cocok apa pun → model asli dipakai apa adanya.

Kalau model utama gagal sebelum menjawab (belum terpasang, RAM kurang), router mencoba
`cadangan` tingkat itu sekali.

## Aturan

- Hanya model lokal (keputusan pengguna 12 Okt 2026). Nama model berisi `cloud` ditolak,
  dan Ollama hulu wajib di 127.0.0.1.
- Isi prompt tidak dicatat. `data/router.log` hanya berisi waktu, tugas, tingkat, model,
  lama, dan jumlah token.

## Aplikasi yang sudah lewat router

| Aplikasi | Sejak | Caranya |
|---|---|---|
| Penghubung laporan guru (8773) | 12 Okt 2026 | `set OLLAMA_URL=http://127.0.0.1:3467` di `jalan.cmd`-nya; `setup.mjs` meneruskannya ke bridge (dulu memaksa :11434) |

Belum: Pemantauan HT (3465), Keuangan (3462), Pengingat kewajiban, Laporan pagi.
Memindahkannya cukup mengganti alamat Ollama-nya ke 3467 dan menambah tugas di `router.json`.

## Uji

```
node uji.mjs
```
