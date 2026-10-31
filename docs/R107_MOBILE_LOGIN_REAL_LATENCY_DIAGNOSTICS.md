# R107 — Pengukuran bottleneck login di HP, bukan klaim login lebih cepat

## Mengapa setelah R106 masih sekitar 5 detik?

R106 sudah mengurangi pencarian akun dan beberapa operasi backend yang berurutan. Namun waktu total yang dirasakan masih mencakup **rate limiter, query user, scrypt, penandatanganan token Firebase (terkadang melibatkan IAM), transfer jaringan, signInWithCustomToken, dan pemuatan kerangka dashboard**. Tidak ada data durasi tahap dari HP produksi yang diterima pada saat R107 dibuat. Karena itu, **penyebab dominan dan penghematan waktu tidak boleh ditebak**.

## Pemakaian di Android tanpa DevTools

1. Terbitkan patch R107 ke aplikasi yang sudah menggunakan R106. Tidak perlu Firebase Rules.
2. Pada Chrome Android, buka `https://piket-guru-ashen.vercel.app/?login_diag=1` (gunakan alamat produksi yang sama jika berbeda).
3. Pilih nama akun dari daftar, masukkan PIN seperti biasa, lalu tekan **Masuk Sekarang**.
4. Setelah login, panel **Diagnostik Login** muncul di bagian kanan bawah. Tekan **Salin ringkasan waktu** atau tangkap screenshot **angka saja**. Jangan bagikan PIN, token, URL API berisi identitas, atau data guru.
5. Ulangi 3–5 login menggunakan HP dan 4G yang sama. Bandingkan median, bukan hanya satu kali pengujian.
6. Untuk kembali ke tampilan guru normal, buka alamat tanpa `?login_diag=1`.

## Makna angka

| Kolom | Makna |
|---|---|
| Total PIN → sesi | Sejak klik Masuk sampai autentikasi PIN + Firebase selesai / ditolak |
| API + jaringan | Waktu fetch login ke Vercel, respons JSON dan overhead transport |
| Backend | Angka `total` dari header `Server-Timing` yang diterbitkan backend R106 |
| Jaringan/API overhead | `max(0, API - Backend)`; mencakup jaringan, antrean edge, serta pembacaan respons, bukan ukuran ping murni |
| Firebase sign-in | Waktu SDK `signInWithCustomToken` pada HP |
| Kerangka dashboard tampil | Waktu dari klik Masuk sampai shell autentikasi terpasang; **bukan** waktu seluruh widget/data dashboard siap |
| Server: gate | pemeriksaan rate limit dan lease |
| Server: cari akun | pembacaan dokumen user |
| Server: cek PIN | scrypt + pembacaan credential store |
| Server: tanda tangan token | penandatanganan Firebase Admin custom token |
| Server: reset rate-limit | penghapusan status percobaan gagal setelah PIN sukses |

Catatan: tahapan `rateReset` dan `signer` berjalan bersamaan. Jangan menjumlahkan semua baris server karena akan menghitung waktu yang overlap dua kali.

## Tindak lanjut berbasis hasil

- Jika **Server: gate** dominan → audit lokasi/latensi rate-limit store, latency transaksi lease, dan transaksi ganda. **Jangan menonaktifkan pembatasan login.**
- Jika **Server: cek PIN** dominan → audit cold start dan parameter scrypt dengan benchmark lokal/server. **Jangan memperlemah parameter hash.**
- Jika **Server: tanda tangan token** dominan → audit Admin SDK / IAM signing dan kesiapan kredensial runtime Vercel.
- Jika **Jaringan/API overhead** dominan → audit Vercel cold start, edge, dan jarak jaringan klien-server.
- Jika **Firebase sign-in** dominan → audit konektivitas HP ke Firebase, Firebase Auth configuration, dan pengunduhan/pemrosesan SDK.
- Jika **Kerangka dashboard tampil** jauh lebih lama daripada `Total PIN → sesi` → audit ukuran bundle lazy dashboard atau pemuatan UI setelah autentikasi.

R107 hanya menambah panel diagnostik **opt-in** dan pencatatan angka ke `sessionStorage` tab aktif. Mode normal tidak menampilkan panel; tidak ada cache kredensial, bypass token, atau perubahan role, PIN, Firestore Rules, maupun konfigurasi Firebase.

## Uji setelah patch

```sh
node scripts/test_r107_mobile_login_diagnostics.mjs
node scripts/test_r106_login_latency.mjs
npm run lint
npm run build
```

Tes simulasi tidak mengukur produksi dan tidak menjamin login di bawah 3 detik. Build penuh memerlukan dependensi proyek.
