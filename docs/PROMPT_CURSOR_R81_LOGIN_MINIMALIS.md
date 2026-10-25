# PROMPT CURSOR — R81 Login Minimalis & Ergonomis (source spesifik)

Kamu sedang bekerja di repository React/TypeScript Piket Guru dengan source terbaru R80 yang sudah memperbaiki error backend Node ESM. **Lakukan perubahan langsung, tidak membuat halaman login baru**, dan jangan commit/push tanpa persetujuan.

## File yang tepat
- **Edit utama:** `src/features/auth/LoginPage.tsx`.
- **Baca bila perlu:** `src/features/auth/LoginAvatar.tsx`, `src/components/common/OverflowName.tsx`, `src/index.css`.
- **Pertahankan:** `src/services/auth/authService.ts`, `src/contexts/AuthContext.tsx`, `src/types/dashboardInfo.types.ts`, `src/server/routes/authRoutes.ts`, `src/services/auth/lastLoginPreference.ts`.
- **Regression test:** `scripts/verify_login_name_lookup_r79.cjs` dan `scripts/verify_login_ui_r81.cjs`.

## Hasil akhir yang wajib
1. Ganti area `Pilih akun pengguna` yang besar dengan label ringkas `Metode masuk`, dan segmen seimbang **Nama** (ikon Search, aria-label Cari Nama) / **ID/NIP** (KeyRound). Tinggi 44px HP dan 40px desktop, aktif/inaktif jelas.
2. Di mode Nama tampilkan input pencarian; di mode ID/NIP tampilkan input manual. **Jangan** mengubah login PIN, Google login, last-login preference, perangkat tepercaya, atau pengambilan daftar API.
3. Input mode Nama menggunakan placeholder `Cari nama guru atau ID...`, tombol X berlabel `Hapus pencarian nama` muncul saat input terisi. Pemfilteran `usersList` tetap lokal dan tidak perlu debounce/API tambahan.
4. Ketika input Nama baru fokus tanpa query, tampilkan maksimal **3 akun pertama** dan petunjuk untuk mengetik; setelah user mengetik, tampilkan seluruh hasil cocok dalam daftar yang tingginya dibatasi dengan scroll internal. Navigasi `ArrowUp`/`ArrowDown`/`Enter` harus membaca daftar **yang terlihat** (hindari memilih item tersembunyi).
5. Kartu akun terpilih lebih ringkas: satu `LoginAvatar compact`, `OverflowName` dengan konfigurasi nama panjang Admin, ID kecil, badge role ringkas. Jangan unduh foto untuk semua item pencarian.
6. Saat pindah dari mode ID/NIP dengan ID yang belum diverifikasi ke Nama, kosongkan ID manual tersembunyi dan PIN; jangan izinkan submit memakai identitas yang tidak lagi terlihat. Jika akun resmi sudah dipilih, identitas terpilih tetap konsisten.
7. Saat endpoint `/api/auth/users-summary` gagal, pertahankan pesan yang ramah, tombol `Coba Lagi`, dan akses mode ID/NIP. **Jangan** membaca langsung koleksi Firebase dari klien sebagai fallback.
8. Pastikan responsif 320/360/390/430/768/1280 px, mode terang/gelap, fokus keyboard, dan perilaku perangkat reduced-motion. Jangan tambahkan CSS global yang memengaruhi form lain.

## Validasi wajib
```
npm ci
node scripts/verify_login_ui_r81.cjs
node scripts/verify_login_name_lookup_r79.cjs
npm run lint
npm run build
```

Jika dependensi tidak tersedia, laporkan kendalanya; jangan mengklaim build sukses. Uji secara nyata: ganti mode beberapa kali, hapus pencarian, cari nama panjang, pilih akun, isi PIN 6 digit, coba gagal API dan tombol Coba Lagi, periksa bahwa login dan badge role tetap benar.

## Laporan hasil
Jelaskan file berubah, batas perubahan, bukti lint/build, uji layar dan regresi, serta hal yang masih memerlukan tes perangkat. **Jangan** mengubah Firestore Rules, data sekolah, endpoint backend, atau menjalankan commit/push otomatis.
