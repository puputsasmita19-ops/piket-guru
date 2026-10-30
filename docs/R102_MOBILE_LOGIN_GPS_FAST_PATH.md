# R102 — Mobile Login & GPS Fast Path

**Prasyarat:** repository sudah memasang R101 dan fitur presensi R93–R96.

## Perubahan

1. **Haptic login dihapus.** Tombol getaran, pilihan kekuatan, tombol tes, event pointer haptic, dan stylesheet khusus dihilangkan. Tombol PIN tetap memiliki efek visual dan tombol klik biasa. `src/features/auth/pinHaptics.ts` bisa dihapus melalui script pembersihan.
2. **Muat daftar akun lebih prioritas.** Permintaan `users-summary` kini berprioritas tinggi, sedangkan pengaturan visual login menggunakan data lokal sementara dan dimuat setelah daftar akun selesai (atau setelah 1,5 detik saat daftar lambat). Tidak ada penyimpanan kredensial pengguna pada cache daftar publik.
3. **Bacaan daftar akun pada backend berbagi proses.** Query akun aktif sekarang digabung saat ada permintaan bersamaan, dengan snapshot dalam memori maksimal 5 detik per instance server. **Ini hanya informasi tampilan selector**, bukan cache izin, PIN, atau status verifikasi. Login tetap membaca Firestore secara otoritatif.
4. **GPS mobile disiapkan lebih awal.** Ketika halaman presensi terbuka, izin lokasi **sudah pernah diberikan**, dan sekolah masih dimuat, aplikasi mulai pembacaan GPS. Hasilnya dipakai saat pengaturan sekolah selesai, hanya jika segar (≤15 detik) dan akurasi ≤50 m. Jika GPS gagal/kedaluwarsa, dilakukan pembacaan baru.
5. **Verifikasi geofence langsung.** Setiap pembacaan terbaru dievaluasi terhadap latitude, longitude, dan radius sekolah dari konfigurasi tersimpan di server. R95 otomatis mengarahkan ke swafoto ketika valid; kamera, jepret foto, dan pengiriman presensi tidak otomatis berjalan.

## Langkah penerapan (GitHub Desktop)

1. Backup/commit perubahan lokal dahulu.
2. Ekstrak ZIP incremental ke **root repository setelah R101**, dengan izin overwrite untuk file yang berubah.
3. Jalankan di terminal pada root proyek:

   ```bash
   node scripts/r102_cleanup_haptic.mjs
   node scripts/test_r102_mobile_login_gps.mjs
   npm run lint
   npm run build
   ```

4. Pastikan `src/features/auth/pinHaptics.ts` terhapus pada daftar Changes. Commit/push via GitHub Desktop.
5. Uji pada Vercel Preview sebelum produksi. **Tidak ada perubahan Firestore Rules** pada patch ini.

> Script regresi haptic lama `test_r98_*`, `test_r99_*`, dan `test_r100_*` adalah test historis yang sudah tidak berlaku setelah fitur haptic dihapus. Tidak perlu dijalankan untuk R102.

## Checklist uji HP

- Halaman login pertama: nama bisa dipilih saat respons server datang; ID/NIP manual tetap bisa digunakan bila daftar gagal.
- Keypad PIN: angka 0–9, hapus satu digit, hapus semua, masuk, indikator proses dan kegagalan tetap bekerja; **tidak ada sakelar getaran**.
- Login/refresh: akun dinonaktifkan, PIN salah, PIN diblokir, dan sesi dicabut tetap ditolak. Ukur total waktu login melalui Performance Timeline R101.
- GPS izin sudah granted: pembacaan dapat berlangsung saat pengaturan sekolah dimuat; jika koordinat dalam radius dan akurasi ≤50 m, muncul status “Dalam radius sekolah” dan panduan swafoto R95.
- GPS izin belum granted: tidak ada prewarm yang menampilkan prompt di luar alur yang semestinya; gunakan pembacaan normal setelah pengaturan sekolah siap.
- GPS di luar radius, koordinat sekolah tidak valid, akurasi lebih dari 50m, lokasi berumur >15 detik, mode offline, atau izin ditolak: **tidak boleh dinyatakan siap presensi**.
- Pastikan satu kali jepret, Check-In, Check-Out, R96 highlight, pengaturan jam, dan pengamanan GPS tetap berjalan.

## Keterbatasan

- **Kecepatan login di bawah 3 detik adalah target, bukan jaminan.** Durasi jaringan, Firebase sign-in, cold start server, dan periksa PIN tetap mempengaruhi hasil.
- JavaScript tidak dapat memaksa GPS mendapatkan fix dengan lebih cepat dari perangkat; R102 mengurangi waktu menunggu pengaturan dan permintaan berulang.
- Snapshot 5 detik hanya membantu daftar nama pada server hangat. Akun nonaktif masih harus ditolak segera oleh endpoint login yang selalu mengecek database langsung.
- Perlu validasi di HP Android/iPhone dan lingkungan Vercel asli. Pengujian source/skrip lokal tidak setara dengan tes hardware.
