# Patch Incremental R10 — Form Presensi Mobile & Kamera Selfie

Tanggal: 21 Oktober 2026

## Fokus
1. **Form mobile lebih ringkas**: tombol "Ambil Swafoto" lebih mudah disentuh, instruksi dipadatkan. Setelah presensi masuk tercatat, area pilih shift dan swafoto disembunyikan; tindakan presensi pulang tetap tersedia.
2. **Kamera selfie lebih responsif**: stream yang masih aktif digunakan kembali saat "Ambil Ulang", sehingga tidak perlu meminta akses kamera lagi. Indikator kesiapan video memastikan tombol jepret hanya aktif ketika gambar kamera siap. Resolusi ideal selfie disesuaikan menjadi 640×480; kamera dokumentasi lain tetap 800×600. Video diaktifkan ulang saat retake dan track dinonaktifkan sementara ketika meninjau foto. Semua track dihentikan saat dialog ditutup.
3. **Render lebih efisien**: daftar shift hari ini menggunakan memoization; kalkulasi daftar rekap hanya berjalan pada tab riwayat. Komponen dialog kamera hanya dipasang ketika dibuka.
4. **Regresi R8 diperbaiki**: integrasi tombol Edit/Hapus dan dialog koreksi presensi pada rekap khusus role ADMIN dipertahankan kembali dalam file `AttendancePreview.tsx` (fitur tersebut hilang pada file R9). Tidak ada perubahan ke aturan keamanan Firestore.

## File berubah (hanya file ini yang perlu ditimpa)
- `src/features/attendance/AttendancePreview.tsx`
- `src/components/camera/CameraCaptureModal.tsx`
- `scripts/verify_attendance_round10.cjs` (baru)
- `docs/CHANGELOG_PRESENSI_R10.md` (baru)

## Verifikasi
Jalankan `node scripts/verify_attendance_round10.cjs` setelah menyalin patch. Verifikasi tersebut memeriksa sintaks TSX dan keberadaan perlindungan penting pada source. Tidak menguji waktu loading kamera pada perangkat nyata.

Pada lingkungan penyiapan patch, `npm ci` tidak berhasil karena paket NPM belum seluruhnya tersedia (cache offline tidak lengkap; instalasi online gagal). Akibatnya `npm run lint` tidak dapat menemukan sebagian type definitions dan `npm run build` tidak menemukan Vite. Verifikasi build produksi dan uji E2E Firebase/Vercel **belum lulus/belum dijalankan**.

Untuk validasi di komputer/repository aktif, jalankan `npm ci`, `node scripts/verify_attendance_round10.cjs`, `npm run lint`, kemudian `npm run build` sebelum commit/push. Pastikan pengujian langsung pada HP dengan izin kamera, presensi masuk, presensi pulang, dan opsi retake. Perubahan kecepatan kamera tetap bergantung perangkat/izin browser.
