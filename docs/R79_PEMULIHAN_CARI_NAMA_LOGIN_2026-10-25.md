# Piket Guru R79 — Pemulihan pencarian nama login

**Basis:** Source aplikasi dengan fitur R76 + hotfix R77 + penyempurnaan R78. Tidak mengembalikan perubahan sebelum R77.

## Temuan source

Pada LoginPage.tsx, mode login ID/NIP ditampilkan secara otomatis ketika `usersList.length === 0`; tombol pindah ke pencarian nama juga hanya dirender ketika data tersedia. Kegagalan backend `/api/auth/users-summary` mengembalikan daftar kosong dan status `verified=false`, sedangkan daftar pengguna yang memang valid kosong menggunakan `verified=true`. UI sebelumnya tidak membedakan dua keadaan ini bagi pengguna.

## Perbaikan

- Tampilkan tombol pilihan **Cari Nama** dan **ID/NIP** setiap saat, baik di desktop maupun mobile.
- Mode **Cari Nama** menjadi pilihan awal; mode manual tetap tersedia untuk kondisi internet/API bermasalah.
- Jelaskan tiga status **memuat / daftar aktif kosong / tidak dapat dimuat** tanpa mengungkap data sensitif.
- Tambahkan **Coba Lagi** dan maksimal dua pemulihan otomatis berjeda saat browser online dan terlihat.
- Jangan gunakan cache pengguna lama yang belum diverifikasi sebagai pengganti respons API.
- Pertahankan nama terpilih, pilihan akun terakhir, PIN/Google login, serta fitur teks berjalan R76–R78.

## Letak pengaturan baru

Role ADMIN → **Pengaturan Sekolah** → tab **Info Dashboard** → bagian **Tampilan nama pengguna**. Aktifkan `Teks berjalan untuk nama panjang`, pilih kecepatan 8/12/16/20/28 detik, lalu klik **Simpan info dashboard**. Berlaku untuk dashboard dan kartu akun terpilih di login. Tab **Halaman Login** mengatur desain halaman login, bukan perilaku animasi nama.

## Pengujian yang sudah dijalankan

- `node scripts/verify_login_name_lookup_r79.cjs`: 27/27 PASS.
- `node scripts/verify_mobile_ux_r76.cjs`: 34/34 PASS.
- `node scripts/verify_hotfix_r77.cjs`: 19/19 PASS.
- `node scripts/verify_r78_r76_r77_compat.cjs`: 31/31 PASS.
- Pemeriksaan TSX/TS parsing: PASS.
- **`npm ci --offline` gagal ENOTCACHED**, karena `yargs-parser@21.1.1` tidak tersedia. Lint penuh tidak lulus karena dependencies/type Node belum terpasang; build penuh tidak dijalankan sampai sukses karena `vite` tidak tersedia. Tidak ada uji langsung endpoint/Firebase/Vercel produksi.

## Cara pasang

1. Ekstrak ZIP incremental R79 ke root repository `piket-guru` yang sudah R78, timpa berkas dengan path sama.
2. Pastikan GitHub Desktop menunjukkan `src/features/auth/LoginPage.tsx` sebagai Modified.
3. Jalankan `npm ci`, `node scripts/verify_login_name_lookup_r79.cjs`, `npm run lint`, dan `npm run build`.
4. Hanya jika berhasil, Commit & Push secara manual. Tunggu Vercel Ready.
5. Buka halaman login: tombol **Cari Nama** dan **ID/NIP** harus selalu ada. Coba Cari Nama, pilih akun, masukkan PIN. Jika daftar tidak tersedia, tekan **Coba Lagi** dan periksa respons jaringan `/api/auth/users-summary` (tanpa membagikan nama/NIP/PIN pengguna).

**Penting:** R79 memperbaiki ketersediaan dan pemulihan UI pencarian nama, tetapi tidak dapat memaksa daftar tampil jika backend tidak berfungsi. Jika tetap gagal, periksa HTTP status/JSON `status` pada API, Firebase Admin SDK, dan Vercel Logs; jangan membuka Firestore publik atau melemahkan Rules untuk mengatasinya.
