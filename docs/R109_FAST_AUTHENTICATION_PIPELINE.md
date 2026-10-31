# R109 — Fast Authentication Pipeline (setelah R108)

## Sumber masalah yang terukur pada Android (3 percobaan)

| Tahap | Rata-rata setelah R108 |
|---|---:|
| Tombol PIN → sesi Firebase | 4.60 s |
| API + jaringan | 3.02 s |
| Backend | 2.69 s |
| Pengecekan rate limit awal | 0.72 s |
| Pemeriksaan **lock akun kedua** | 0.47 s |
| Reset pembatasan login | 0.72 s |
| Firebase sign-in | 1.54 s |
| Kerangka dashboard tampil | 5.71 s |

Angka di atas dari screenshot HP pengguna, **bukan** hasil benchmark patch R109. Durasi detail tertentu tumpang tindih dan tidak dapat dijumlahkan langsung.

## Apa yang berubah

1. **Penggunaan ulang hasil lock middleware secara aman** (`src/server/middleware/rateLimiter.ts`, `src/server/routes/authRoutes.ts`): middleware R108 sudah mengecek blokir IP, akun, dan alias serta menerbitkan lease melalui transaksi otoritatif. R109 menyimpan bukti admission server-side pada `WeakMap` per objek request. Jika dokumen pengguna yang ditemukan di route memiliki UID yang **persis sama** dengan UID yang diperiksa middleware, dan identifier awal juga sama, route tidak mengulang pembacaan lock Firestore. Kode diagnosa `lock` kini akan mendekati 0 ms untuk kondisi ini. **Jika ada perbedaan UID/alias, lease dibatalkan, atau bukti tidak tersedia, pemeriksaan akun Firestore tetap dilakukan seperti semula.** Bukti tidak bisa berasal dari JSON yang dikirim pengguna, tidak disimpan lintas request, dan dihapus pada akhir respons.
2. **Speculative shell preload setelah PIN terverifikasi** (`src/services/auth/authService.ts`): unduhan modul UI yang sama dengan dashboard dimulai ketika server telah mengembalikan token sukses dan profil aktif, sebelum `signInWithCustomToken` selesai. Ini dapat mengurangi *jeda menuju kerangka dashboard* dengan memanfaatkan waktu tunggu jaringan Firebase. Tidak melakukan mount UI, tidak membuka sesi atau meloloskan akun. Preload tidak dijalankan jika browser melaporkan `saveData` atau koneksi 2G/3G. Kegagalan unduhan tidak menyebabkan login gagal.

## Keamanan dan kompatibilitas

- Tidak mengubah batas percobaan PIN, pemblokiran IP/akun, masa berlaku lease, heartbeat, reset limiter, kekuatan `scrypt`, status akun, atau verifikasi token Firebase.
- Pemeriksaan UID dan identitas yang belum dipastikan tetap menggunakan pembacaan lock otoritatif. Masih ada batas maksimum permintaan serentak pada admission; pengujian ulang PIN salah simultan dan akun terkunci tetap wajib dilakukan pada emulator atau staging.
- Tetap menggunakan `firestore.rules` dan `vercel.json` yang sama. Tidak ada migrasi Firestore.
- Halaman login tidak menampilkan dashboard sebelum Firebase berhasil memverifikasi token dan UID cocok.

## Penerapan

1. Ekstrak ZIP di **root repository setelah R108**, timpa file yang sama.
2. Jalankan:
   ```bash
   node scripts/test_r109_fast_authentication_pipeline.mjs
   node scripts/test_r108_atomic_rate_limiter_login.mjs
   node scripts/test_r107_mobile_login_diagnostics.mjs
   npm run lint
   npm run build
   ```
3. Commit/push melalui GitHub Desktop. Pastikan **API serverless Vercel** serta bundle PWA ikut ter-deploy. Setelah update, lakukan refresh PWA agar kode JS terbaru terpakai.
4. Di lingkungan uji, verifikasi PIN salah, blokir 5 percobaan, akun nonaktif, akun dipilih dari nama, login manual ID/NIP, logout, dan refresh sesi.

## Uji waktu di Chrome Android

- Buka `https://piket-guru-ashen.vercel.app/?login_diag=1`, gunakan HP, akun, dan jenis jaringan yang sama dengan uji R108.
- Lakukan 3–5 pengujian login PIN yang benar (jangan mengulang PIN salah berkali-kali pada akun produksi). Catat median `Total PIN → sesi`, `API + jaringan`, `Backend`, `Server: lock akun`, `Firebase sign-in`, `Kerangka dashboard tampil`.
- Harapan utama: **waktu `lock` yang sebelumnya ~0.47 s menjadi mendekati nol** ketika UID yang dipilih dan identitas otoritatif cocok. Penurunan waktu total tidak dijamin 0.47 detik tepat karena jaringan, Firestore, dan kondisi HP bervariasi.
- Preloading shell berpotensi berebut bandwidth dengan Firebase pada 4G yang ramai. Perhatikan apakah `Firebase sign-in` justru bertambah; bila ya, perlu mengurangi atau menonaktifkan prefetch untuk profil jaringan tersebut.

## Faktor latensi berikutnya (jangan menebak region)

Berdasarkan R108, sekitar 1.44 s masih dipakai dua transaksi rate-limiter dan sekitar 1.54 s oleh Firebase sign-in. **Target konsisten di bawah 3 detik belum dapat dijanjikan melalui R109 saja.** Periksa lokasi database Firestore pada Firebase Console dan lokasi eksekusi Vercel Functions untuk menentukan apakah ada latensi antarkawasan. Jangan mengatur `vercel.json` ke region sembarang tanpa memastikan region Firestore dan batasan deployment Vercel. Jika region sudah optimal tetapi akses Firestore tetap lambat, selanjutnya audit desain penyimpanan rate-limit melalui tes keamanan dan beban terisolasi.

## Pengujian lokal

- `test_r109_fast_authentication_pipeline.mjs`: 20/20 PASS (proof/UID/lease/fail-closed/opt-out data saver & syntax).
- Regresi: R108 21/21, R107 19/19, R106 26/26, R105 10/10, R103 16/16, R101 10/10 PASS.
- TypeScript syntax diverifikasi; `npm run lint` tidak lulus pada lingkungan pengujian karena dependensi React/Firebase dan tipe Node tidak dipasang. Build produksi dan benchmark Android/Vercel belum diverifikasi.
