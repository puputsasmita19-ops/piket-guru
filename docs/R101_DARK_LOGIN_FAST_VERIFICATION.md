# R101 — Dark Login Search UI + Performance Verification (setelah R100)

## Perubahan

1. **Input cari nama dan ID/NIP** sekarang satu kontainer dengan radius/border tunggal di mode terang maupun gelap. Tombol switch memiliki pemisah internal tanpa bingkai ganda, ukuran ketukan tetap aman untuk HP, dan daftar hasil tetap terpisah.
2. **Proses login mobile** menginisialisasi sanitasi cache kredensial lama setelah render awal, bukan saat klik Masuk. Autentikasi tetap menunggu inisialisasi apabila login ditekan lebih dahulu.
3. **Animasi latar login** berhenti sementara saat verifikasi berlangsung dan dilanjutkan jika tetap berada di halaman login.
4. **Pengukuran durasi anonim** ditambahkan ke Performance Timeline browser: permintaan PIN API, proses Firebase sign-in, dan total verifikasi dari tombol Masuk sampai hasil autentikasi. Tidak menyimpan PIN, ID, token, atau profil dan tidak melakukan request telemetry baru.

## Target waktu 3 detik

**Target, bukan jaminan.** Verifikasi resmi melewati beberapa langkah (limit percobaan, pembacaan akun, scrypt, custom token, Firebase sign-in). Cold start backend, kondisi jaringan seluler, Firebase dan spesifikasi perangkat tidak bisa dijamin < 3 detik hanya dengan frontend.

Untuk mengukur pada perangkat Android/Chrome nyata:

1. Buka aplikasi dengan sinyal seluler biasa, pilih akun, isi PIN, klik Masuk.
2. Jika perlu, gunakan Chrome DevTools remote debugging → Console dan jalankan:

```js
performance.getEntriesByType('measure')
  .filter(item => item.name.startsWith('piket-login-'))
  .map(({ name, duration }) => ({ phase: name, ms: Math.round(duration) }));
```

3. Ulangi setidaknya 10 kali pada dua kondisi: browser baru dibuka (cold) dan sesudah aplikasi siap (warm). Ukur p50 dan p95; **tujuan:** median verifikasi < 3000 ms pada kondisi warm; tidak boleh terjadi login tanpa server/Firebase.
4. Bila `piket-login-pin-api` paling lama, periksa latensi server / cold start / Firestore / scrypt / rate limiter. Bila `piket-login-firebase-signin` paling lama, periksa jaringan dan Firebase SDK. Jika total berbeda jauh dari penjumlahan dua fase, periksa render/auth context.

## Penerapan

Ekstrak isi ZIP ke **root repository setelah R100**. Lalu jalankan:

```
node scripts/test_r101_dark_login_performance.mjs
npm run lint
npm run build
```

Commit & push dengan GitHub Desktop. Uji pada Vercel Preview sebelum rilis produksi. Tidak perlu perubahan `firestore.rules`.

## Batasan pengujian lingkungan penyusun

- Pengujian khusus R101 10/10 lulus.
- Regresi lokal R97 15/15, R98 18/18, R99 21/21, R100 16/16 lulus.
- Build/lint penuh belum terverifikasi karena modul npm proyek tidak terpasang di lingkungan ini.
- Kecepatan login < 3 detik dan tampilan dark mode di perangkat fisik belum terverifikasi.
