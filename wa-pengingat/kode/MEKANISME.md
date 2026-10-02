# Pengingat YSPI melalui model lokal

Sumber aturan: `Data Migration/Scheduled Tasks/yspi-followup-reminder.md` pada vault SPI dan pesan grup YSPI team. Penyesuaian pengguna: tracker + obrolan grup hari kerja sebelumnya (sejak 18 Sep 2026; sebelumnya hanya tracker), tujuan Daniel <nomor-pengurus>, seluruh item aktif ditampilkan tanpa `+N lagi` atau pemotongan. Tidak ada batas jumlah item maupun jumlah pesan — angka lama "14 item / 25 pesan" sudah tidak berlaku.

## Ritme

- Senin–Jumat: selalu per orang — 👤 PIC, lalu tiap item `[Fxx] topik: isi — status, deadline`, lalu `↳ kabar terbaru`. Tidak ada selang-seling lagi (per topik dihapus 18 Sep 2026 atas permintaan pengguna; mode `pertopik` masih bisa dipaksa untuk uji lewat `--mode=pertopik`, tapi tidak boleh dikirim).
- Sabtu: pesan Syukur Mingguan berisi capaian atau tonggak nyata tujuh hari terakhir; refleksi, doa, ayat terverifikasi bila tersedia, lalu penutup istirahat. Biasanya 3–7 butir, tetapi seluruh pokok pada contoh aktual dipertahankan (contoh 12 September memuat 8 butir). Pekerjaan yang belum terjadi tidak boleh menjadi capaian. Tidak menagih outstanding.
- Minggu: satu topik wiki yang dirotasi, refleksi dan doa, tanpa penagihan. Hindari topik pesan grup tiga minggu terakhir.
- Sore: tidak mengirim.

## Pelaksanaan lokal

Task Windows yang sudah ada memanggil `jalankan-diam.vbs pagi`, lalu `jalankan.mjs`. Tidak membutuhkan Codex untuk setiap run. Task pagi: 07.30 WIB, dengan pemicu susulan 10.00 dan 13.00 (sejak 19 Sep 2026: komputer baru menyala 09.25 dan `StartWhenAvailable` tidak menjalankan putaran yang terlewat, sehingga Syukur Mingguan hari itu tidak terkirim). Susulan aman karena penjaga duplikat per hari: kalau pagi sudah terkirim/diantrikan, susulan berhenti sendiri; kalau pagi gagal, susulan mencoba lagi. Instance ganda: IgnoreNew. Task sore nonaktif.

1. Python membuka Excel `rb` dan openpyxl `read_only=True`, tanpa save. Baris 5 dst, kolom A–L tetap posisinya meskipun sel kosong. Pembacaan gagal berarti batal, tanpa fallback ke cermin lama.
2. Model `qwen3:8b` melalui Ollama loopback membaca data. Untuk menentukan item aktif, model menerima kolom ID dan Status seluruh baris; riwayat lama tidak ikut menentukan status. Model tidak memiliki tool filesystem, shell, atau konektor penulisan Excel.
3. Pada hari kerja, model menghasilkan pilihan ID aktif terstruktur. Runtime memeriksa bahwa pilihan itu sama persis dengan SEMUA Outstanding/Kandidat Close, tanpa duplikat/Closed. Judul, PIC, deadline, dan entri K terbaru ditampilkan penuh dari sel asli. Ini sengaja bukan pengetikan ulang seluruh teks oleh model: format dan fakta dijaga program, pilihan dibaca/dihasilkan local model.
   - **Obrolan grup (sejak 18 Sep 2026):** runtime membaca SEMUA pesan orang di grup YSPI team dari `wa-konsol/data/wa.db` (read-only) sejak awal hari kerja sebelumnya sampai awal hari ini, WIB — Selasa–Jumat = kemarin, Senin = Jumat s.d. Minggu. Tanpa batas jumlah; hari ramai dipecah jadi beberapa panggilan model, bukan dipotong. Pesan nomor agen sendiri dan voice note tanpa transkrip tidak ikut.
   - Model menulis satu kalimat kabar untuk item yang benar-benar dibicarakan dan menunjuk nomor pesan dasarnya. Tanggal dan nama pengirim di baris `↳ (17 Sep) … — Robby/Budiman W` diambil **program** dari pesan yang ditunjuk, bukan ditulis model. Kabar ini menggantikan entri K terbaru untuk hari itu; item yang tidak dibicarakan tetap memakai entri K.
   - Penjaga `saringKabar()` membuang per entri: ID bukan item hidup, nomor pesan tidak sah atau di luar kelompok yang diperlihatkan, kalimat < 8 atau > 320 huruf.
   - **Tidak boleh menyimpulkan sendiri** (aturan pengguna 18 Sep 2026): kata disepakati/setuju/diputuskan/dikonfirmasi/dipastikan/final/fix/estimasi hanya boleh dipakai bila akar katanya tertulis di pesan yang ditunjuk (`kesimpulanSendiri()`); kalau tidak, kabar dibuang dan item memakai baris ↳ tracker. Dua orang bilang "ok aja" bukan "disepakati"; angka "contoh aja" bukan "estimasi". Kasus asalnya F109 & F110 dari uji 17 Sep.
   - Langkah ini tambahan, bukan syarat: bila model gagal atau habis waktu, log mencatat "Kabar dari obrolan DILEWATI" dan laporan tetap dikirim dengan baris ↳ dari tracker. Waktu tambahan di CPU (27B): ±30 menit untuk hari seramai 17 Sep (85 pesan).
4. Pada akhir pekan, model menulis pembuka, capaian/refleksi dan doa berdasarkan tracker, wiki, dan contoh pesan grup. Contoh tanggal lama hanya acuan format; laporan grup hari yang sama boleh mendukung fakta tambahan. Setiap capaian wajib mempunyai ID sumber. Ayat opsional hanya ditambahkan setelah verifikasi PDF TB 1974 (teks, rujukan, halaman dan SHA-256 disimpan).
5. Hasil dan audit disimpan di `WA-Lokal/pengingat`. SHA-256 Excel dibandingkan sebelum/sesudah. Jika berbeda, kiriman dibatalkan untuk dibaca ulang. Tidak ada pemotongan 5.000 karakter atau batas jumlah item.
6. Runtime menulis antrean `WA-Lokal/antrian` ke nomor Daniel; daemon WhatsApp Console mengirim dan membuat hasil outbox. Antrean saja bukan bukti terkirim. Pengiriman ulang tidak otomatis dilakukan bila status meragukan.

Footer mengikuti contoh asli. Aturan penutupan/auto-close dalam footer adalah mekanisme agen pengelola tracker yang lama. Pengingat lokal tidak menerapkan tag, mengubah status, menyimpan Excel, menulis papan topik, atau melakukan auto-close.

Uji tanpa mengirim: `node jalankan.mjs pagi --uji --mode=perorang` (juga pertopik/syukur/istirahat). Uji data dan kelengkapan: `node lokal-lengkap.test.mjs`.

Pengiriman wajib sesuai mode tanggal WIB. `--paksa` hanya melewati pencegahan duplikat, tidak boleh melewati aturan hari. Jadi Sabtu tidak bisa mengirim format per orang/per topik, dan Minggu hanya format istirahat. Mode hari lain hanya boleh untuk uji tanpa kirim.

## Renungan akhir pekan (12 Sep 2026)

Sabtu dan Minggu adalah renungan, bukan laporan tugas. Sabtu memuat 4–6 butir
pendek berisi pekerjaan pekan itu — satu kalimat, paling banyak 20 kata, ditulis
ulang oleh model, bukan salinan judul Excel. Minggu tidak memuat butir sama
sekali, hanya satu topik dari `wiki/` ditambah refleksi dan doa.

Status di tracker mengikat isi kalimat:

| Status | Boleh ditulis |
| --- | --- |
| Closed | selesai |
| Kandidat Close | selesai, dan program menambahkan "(menunggu konfirmasi)" |
| Outstanding | hanya kemajuan; klaim selesai menggagalkan pesan |

Peristiwa yang benar terjadi (rapat berlangsung, kunjungan dilakukan) boleh
ditulis apa adanya meski baris trackernya tetap Outstanding — F99 "kosongkan
jadwal Rabu minggu ke-2" adalah kesepakatan tetap yang memang tak pernah
ditutup, sementara rapatnya sungguh terjadi.

Bila penjaga menolak, model diberi tahu alasannya dan menulis ulang sekali;
kegagalan kedua baru dilaporkan sebagai galat, supaya putaran terjadwal pukul
10.00 tidak berakhir tanpa pesan.

Seluruh penjaga ada di `periksaAkhirPekan()` dan diuji oleh `uji-penjaga.mjs`
(`node uji-penjaga.mjs`, dua detik, tanpa model). Uji itu lahir karena tambalan
12 Sep sempat menulis `\b` di dalam template literal sehingga menjadi karakter
backspace: penjaganya tampak ada di berkas, tetapi tidak pernah cocok. Setiap
penjaga baru wajib punya kasus uji di sana.
