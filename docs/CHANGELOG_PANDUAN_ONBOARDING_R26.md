# R26 — Panduan Cepat, Berbasis Role & Pengenalan Pengguna Baru

Tanggal: 22 Oktober 2026

## Perubahan
1. Menu ikon **? Panduan Penggunaan** kini menyediakan:
   - **Panduan Cepat · 3 Langkah**
   - **Panduan Lengkap sesuai Role** (tur R25 tetap tersedia)
2. Panduan Cepat otomatis menyesuaikan hak akses yang sudah dimiliki:
   - Admin / Kepala Sekolah: Navigasi → Jadwal Piket → Laporan & Rekap (jika berizin)
   - Guru: Perbarui GPS → Swafoto → Kirim Presensi (jika berizin)
   - Jika ada langkah yang tidak diizinkan, diganti oleh langkah lain yang memang boleh diakses; jumlah langkah bisa kurang dari tiga untuk akun dengan izin sangat terbatas.
3. Saat pertama kali memakai aplikasi **di browser/perangkat itu**, pengguna melihat kartu pengenalan kecil pada dashboard:
   - **Mulai 3 Langkah** atau **Lewati**
   - Tidak langsung memindahkan halaman, membuka kamera, atau mengirim data.
   - Penawaran disimpan per akun di localStorage (`piket_guide_welcome_v1_<userId>`), tidak ditampilkan berulang setelah ditangani.
   - Pengguna yang mengaktifkan opsi *Tampilkan panduan otomatis saat masuk* tetap menerima alur tur lengkap sebelumnya; undangan pengenalan tidak ditampilkan bersamaan.
4. Pada desktop saat sidebar disembunyikan, target navigasi dapat diarahkan ke tombol pembuka sidebar di header.
5. Sorotan R24/R25 (GPS, swafoto, status koneksi) dipertahankan.

## File berubah (hanya update)
- `src/contexts/GuideContext.tsx`
- `src/components/guide/InteractiveGuideTour.tsx`
- `src/components/guide/GuideWelcomePrompt.tsx` (baru)
- `src/components/layout/GuideHelpButton.tsx`
- `src/components/layout/Layout.tsx`
- `src/index.css`
- `scripts/verify_guide_onboarding_r26.cjs` (baru)
- `docs/CHANGELOG_PANDUAN_ONBOARDING_R26.md` (baru)

## Uji lokal
`node scripts/verify_guide_onboarding_r26.cjs` → 20 pemeriksaan struktur dan sintaks lulus.

`node scripts/verify_guide_spotlight_r24.cjs` dan `node scripts/verify_guide_targets_r25.cjs` → lulus.

`node scripts/verify_build_exports_r16_2.cjs` → 409 file, 3.044 ikatan impor lokal lengkap.

`npm run lint` **belum berhasil**: banyak dependensi belum ada (`react`, `firebase`, `@types`, dll).

`npm run build` **belum berhasil**: `vite: not found`.

## Catatan implementasi
- Tidak ada perubahan Firestore, Firebase Rules, data akun, presensi, atau hak akses.
- Undangan pengenalan mencerminkan kunjungan pertama **pada browser/perangkat yang digunakan**, bukan riwayat login pertama secara global di server.
- Hasil tes di atas adalah pemeriksaan lokal, bukan bukti uji visual/performa pada perangkat asli atau build Vercel.
