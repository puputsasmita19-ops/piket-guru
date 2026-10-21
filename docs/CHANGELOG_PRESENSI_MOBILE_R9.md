# Patch Presensi Mobile Minimalis & Optimasi GPS (R9)

Tanggal: 2026-10-21

## Ringkasan
Patch ini merapikan tampilan mobile pada menu Presensi GPS agar lebih minimalis, bersih, dan mudah dipahami, sekaligus mempercepat pembacaan koordinat GPS dengan memanfaatkan bacaan valid terbaru secara aman.

## Perubahan utama
1. **Tampilan mobile lebih minimalis**
   - Panel GPS diubah menjadi tampilan kartu ringkas 2 kolom di mobile dan 4 kolom di desktop.
   - Informasi difokuskan pada: jarak sekolah, akurasi GPS, waktu baca, dan koordinat.
   - Pesan teknis "GPS membutuhkan waktu 2,5 detik / maksimal 2,5 detik" dihapus dari tampilan.
   - Peta dibuat dapat ditampilkan/disembunyikan dengan tombol **Lihat Peta / Sembunyikan Peta** agar layar mobile lebih bersih.

2. **Pembacaan koordinat lebih cepat & efisien**
   - Bacaan GPS valid terakhir disimpan sementara di `sessionStorage` agar setelah refresh halaman, posisi yang masih segar bisa dipakai lebih cepat.
   - Ditambahkan **quick read** (`getCurrentPosition`) untuk menangkap koordinat lebih cepat jika browser sudah punya cache lokasi.
   - `watchPosition` tetap digunakan untuk menyempurnakan akurasi setelah bacaan awal diperoleh.
   - Saat refresh GPS, aplikasi tidak lagi mengosongkan tampilan lama jika bacaan sebelumnya masih ada, sehingga UI terasa lebih stabil dan tidak berkedip.

3. **Kartu Jadwal Shift diperhalus**
   - Ringkasan shift dibuat lebih rapi, dengan pemisahan waktu masuk dan pulang ke dalam dua kartu kecil.

## File yang berubah
- `src/features/attendance/AttendancePreview.tsx`
- `src/features/attendance/attendanceGps.css`
- `src/services/location/locationService.ts`
- `scripts/verify_mobile_presensi_round9.mjs`
- `docs/CHANGELOG_PRESENSI_MOBILE_R9.md`

## Verifikasi lokal yang dilakukan
- Transpile sintaks `AttendancePreview.tsx` dan `locationService.ts` berhasil.
- Verifikasi statis untuk memastikan:
  - teks waktu tunggu GPS lama sudah hilang,
  - layout minimalis baru tersedia,
  - toggle peta tersedia,
  - cache GPS sementara tersedia.

Jalankan:

```bash
node scripts/verify_mobile_presensi_round9.mjs
```

## Catatan
- Build/lint penuh tetap perlu dijalankan di environment proyek Anda (`npm ci`, `npm run lint`, `npm run build`).
- Penyimpanan cache GPS bersifat sementara dan hanya disimpan di browser sesi aktif, bukan di server.
