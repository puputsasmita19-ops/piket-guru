# R108 — Atomic Rate-Limiter Login Optimization (berdasarkan bukti R107)

## Masalah yang terukur pada Chrome Android

Hasil pengguna: PIN→sesi 6.283 ms; API+jaringan 4.257 ms; backend 3.901 ms; Firebase Sign-In 1.979 ms; kerangka dashboard 7.221 ms. Rincian backend: admission 1.209 ms; reset rate limit 1.436 ms; cari akun 235 ms; cek lock akun 475 ms; PIN 545 ms; token 3 ms.

**Catatan:** angka-angka subproses tidak selalu dijumlahkan karena sebagian dapat berjalan paralel. Ini adalah baseline perangkat produksi sebelum R108, bukan estimasi hasil sesudah patch.

## Akar masalah dan perbaikan

- Sebelumnya middleware login memeriksa record IP, akun utama, dan alias lewat beberapa transaksi, **baru kemudian** mengakuisisi lease in-flight melalui transaksi tersendiri.
- R108 menambahkan `FirestoreStoreDriver.acquireLoginAdmission()` yang memeriksa **blokir IP, blokir akun/alias, kapasitas lease per akun/IP, serta membuat lease dalam satu transaksi Firestore**. Pembacaan dokumen dilakukan bersamaan ketika aman; semua penulisan dilakukan setelah seluruh pembacaan.
- Sebelumnya reset sukses menghapus hingga beberapa alias melalui transaksi masing-masing dan memeriksa IP lagi sebelum menghapusnya. R108 menambahkan `FirestoreStoreDriver.resetLoginSuccess()` untuk membersihkan seluruh alias sekaligus, serta hanya menghapus bucket IP apabila **tidak terkunci**, dalam **satu transaksi atomik**.
- Driver lokal/simulator lama tetap memakai alur sebelumnya. Store yang gagal tetap menolak login (`503`, fail-closed).
- **Tidak** menghapus rate limit, mengurangi biaya scrypt, melewati validasi PIN/status akun, mengendurkan sesi Firebase, atau menghapus lease heartbeat.

## File berubah

1. `src/server/middleware/rateLimiter.ts` (backend saja)
2. `scripts/test_r108_atomic_rate_limiter_login.mjs` (pengujian)
3. `docs/R108_ATOMIC_RATE_LIMIT_LOGIN.md` (panduan)

Tidak ada perubahan pada `firestore.rules`, `vercel.json`, database/schema, API response login, atau UX guru.

## Penerapan

1. Ekstrak ZIP **ke root repository setelah R107**.
2. Jalankan `node scripts/test_r108_atomic_rate_limiter_login.mjs`.
3. Pada komputer dengan dependensi lengkap jalankan `npm run lint` dan `npm run build`.
4. Commit dan push GitHub Desktop. **Pastikan deployment Vercel serverless API `/api/auth/login`** sudah menggunakan commit R108, bukan hanya bundle front-end/PWA. Konfigurasi `vercel.json` saat ini menunjuk ke `api/index.ts` → `src/server/app.ts`, sehingga middleware server ikut dibundel pada deployment tersebut.
5. Uji 3–5 kali pada HP Android yang sama lewat `?login_diag=1`. Utamakan **median** pada jaringan 4G/Wi-Fi yang sama, dan ulangi dengan PIN salah serta akun terkunci pada lingkungan uji.

## Pengujian keamanan sebelum rilis seluruh guru

- PIN benar masuk dengan token Firebase valid; PIN salah menambah hitungan gagal.
- 5 kali PIN salah menimbulkan lockout sesuai kebijakan; blokir akun dan IP tetap dihormati.
- Dua permintaan serentak mematuhi kuota akun dan IP; lease dilepas saat request selesai.
- Gangguan Firestore menghasilkan penolakan aman 503, tidak membuka akses.
- Reset login tidak menghapus blokir IP yang masih aktif; dapat membersihkan alias akun pada PIN benar.
- Tes autentikasi manual ID/NIP tetap berjalan dan tidak mengabaikan kasus identitas ambigu.

## Tolok ukur hasil berikutnya

Ukur ulang: total, API, backend, gate, reset rate-limit, cek lock akun, Firebase Sign-In, dan dashboard. Perubahan ini secara khusus menargetkan **gate 1.209 ms** dan **reset 1.436 ms**, bukan Firebase Sign-In yang terukur **1.979 ms**. Tidak ada jaminan sub-3 detik sebelum benchmark Vercel/Firestore Android dilakukan. Jika kedua tahap sudah cepat tetapi login masih >3 detik, fokus berikutnya adalah latensi Firebase dan pembacaan lock akun terpisah (475 ms), serta waktu memuat dashboard.

## Verifikasi yang tersedia

`node scripts/test_r108_atomic_rate_limiter_login.mjs`: 21/21 PASS (transaksi, lockout, alias, batas paralel, fail-closed, reset). Regresi R106 26/26 PASS; R107 19/19 PASS. Belum menjalankan Firebase Emulator/live Vercel benchmark; unit tests tidak mengukur peningkatan waktu produksi.
