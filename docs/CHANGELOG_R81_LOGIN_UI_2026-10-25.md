# R81 — Login UI Minimalis & Ergonomis

Tanggal: 25 Oktober 2026. Basis: komponen login R79 dengan hotfix R80 Node ESM dipertahankan.

## Perubahan
- Segmented switch Nama / ID/NIP diperpendek, namun tetap memakai ikon dan label jelas, `aria-pressed`, dan ukuran 44 px (HP) / 40 px (desktop).
- Label `Metode masuk`, input kondisional, placeholder yang ringkas, tombol X hapus pencarian, dan jarak vertikal lebih konsisten.
- Untuk daftar tanpa query hanya tiga akun pertama ditampilkan. Saat mengetik, semua nama cocok dapat digulir dalam kotak hasil terbatas; navigasi keyboard menggunakan daftar yang benar-benar tampil.
- Hasil akun terpilih memakai `LoginAvatar compact`, nama panjang via `OverflowName` dan badge role kecil. Thumbnail tetap hanya diunduh bagi akun terpilih.
- Menghapus ID manual yang belum terverifikasi saat pengguna beralih ke mode pencarian nama, sehingga tidak ada pengiriman identitas tersembunyi. PIN untuk akun terpilih yang valid tetap mengikuti alur sebelumnya.

## Tetap dipertahankan
PIN enam digit, Google login Admin, mode manual fallback, pemeriksaan response `users-summary` yang diverifikasi, tombol Coba Lagi, LastLoginPreference, pengaturan perangkat tepercaya, pengaturan tema, autentikasi, Firestore Rules, dan backend API. Perubahan source aplikasi hanya `src/features/auth/LoginPage.tsx`.

## Verifikasi
- `NODE_PATH=$(npm root -g) node scripts/verify_login_ui_r81.cjs`: pemeriksaan statis dan transpile kode R81.
- `NODE_PATH=$(npm root -g) node scripts/verify_login_name_lookup_r79.cjs`: regresi fitur daftar nama.
- `npm ci --offline`: gagal `ENOTCACHED yargs-parser@21.1.1` di lingkungan pengemasan.
- `npm run lint`: belum dapat divalidasi karena dependensi dan `@types/node` / Firebase tidak terpasang.
- `npm run build`: belum dapat divalidasi karena `vite` belum terpasang.
- Uji mock layout Chromium: 12/12 ukuran/mode (320, 360, 390, 430, 768, 1280 px x terang/gelap), tanpa horizontal overflow; **mock statis, bukan React production**.
- Sejumlah skrip lama (R48/R50/R77/R78) memiliki ekspektasi teks atau path impor yang sudah tidak sesuai R79/R80; jangan menganggapnya sebagai bukti error R81. Tes berbasis `esbuild` belum dapat berjalan karena dependensi belum terpasang.
- Uji browser/app produksi yang terhubung ke API dan akun nyata belum dijalankan; tes statis bukan pengganti tes visual dan autentikasi.

## Instalasi
Ekstrak ZIP incremental ke root repository setelah R80. Tidak perlu menjalankan patcher; file TSX langsung ditimpa. Jalankan `npm ci`, tes R81, tes R79, `npm run lint`, dan `npm run build` di mesin Anda; jika semua berhasil, commit dan push via GitHub Desktop. Test di HP/desktop saat deployment Vercel Ready.
