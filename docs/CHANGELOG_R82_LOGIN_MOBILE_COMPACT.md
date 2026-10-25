# R82 — Login Mobile Compact Switch

**Basis:** R81 yang sudah berhasil di-deploy. Perubahan hanya pada `src/features/auth/LoginPage.tsx`.

## Penyebab

Segmented switch pada R81 menggunakan `w-full` dan posisi vertikal `flex-col` di mobile. Tombol Nama / ID-NIP membesar memenuhi kartu dan menambah tinggi halaman login.

## Perbaikan

- Judul **Metode masuk** dan dua pilihan ditempatkan pada satu baris fleksibel; baris dapat membungkus secara aman jika layar terlalu sempit.
- Lebar masing-masing tombol menjadi **79 px di mobile** dan **88 px di desktop** (sebelumnya berbagi seluruh lebar kartu pada HP).
- Dua tombol tetap berukuran **minimal 44 px tinggi di HP** dan 40 px di desktop untuk kenyamanan sentuh.
- Ikon Search dan KeyRound menjadi 14 px, teks singkat Nama / ID-NIP tetap terbaca, border dan bayangan lebih halus.
- Switch tidak mengubah form field berdasarkan mode, pemulihan nama R79, autentikasi R80, pilihan akun, PIN, login Google, trusted device, atau Firebase.

## Instalasi

Ekstrak ZIP ke root repository yang telah menerapkan R81, atau ganti satu file `src/features/auth/LoginPage.tsx` saja. Jalankan:

```
node scripts/verify_compact_login_switch_r82.cjs
node scripts/verify_login_ui_r81.cjs
node scripts/verify_login_name_lookup_r79.cjs
npm run lint
npm run build
```

Apabila lint/build gagal, hentikan deployment. Commit dan Push melalui GitHub Desktop setelah verifikasi lulus. Periksa mode Nama dan ID/NIP pada layar HP serta desktop; hindari menghapus data browser/IndexedDB pengguna yang mungkin berisi draft offline.

## Batas uji

Tes R82/R81/R79 memeriksa kode dan kompatibilitas alur secara statis. Build penuh membutuhkan dependensi NPM dan belum dijalankan hingga sukses di lingkungan pengemasan. Hasil mock browser tidak membuktikan pengalaman UI produksi. Tes login nyata dan cache PWA perlu dilakukan setelah deployment.

## Pemeriksaan di lingkungan pembuat patch

- `verify_compact_login_switch_r82.cjs` 23/23 lulus.
- Regresi R81 (tes disesuaikan untuk menerima switch ringkas) 37/37 lulus.
- Regresi pencarian nama R79 27/27 lulus.
- Mock HTML statis Chromium: 12/12 ukuran dan mode warna lulus tanpa tumpang tindih tombol maupun scroll horizontal. **Mock bukan tangkapan layar aplikasi produksi.**
- `npm ci --offline` terhenti: `yargs-parser@21.1.1` tidak ada dalam cache.
- `npm run lint` belum terverifikasi karena dependensi aplikasi dan tipe Node belum terinstal.
- `npm run build` belum terverifikasi karena Vite tidak terinstal.
