# R93 — Swafoto presensi satu kali jepret & GPS otomatis

## Masalah yang diperbaiki

Pada versi sebelumnya, `prepareSelfieCapture()` meminta hasil GPS yang masih segar <=15 detik, namun pemanggilan `getCurrentPosition()` pada callback renewal masih mengizinkan cache hingga 30 detik. Pembacaan cache yang berhasil dikembalikan dapat langsung ditolak oleh `ensureFreshPosition()`, sehingga muncul pesan merah "Hasil pembacaan GPS baru ... maksimal 30 detik" dan guru harus mencoba lagi.

Ada masalah kedua di pengiriman presensi: swafoto yang telah berhasil direkam ditolak setelah 30 detik meskipun foto dan koordinat **valid pada waktu foto diambil**. Masalah kedua membuat guru perlu swafoto ulang hanya karena terlambat menekan tombol kirim.

## Perilaku baru

1. Dari Presensi GPS, pilih **Ambil Swafoto** seperti biasa.
2. Klik **Jepret Foto** **sekali**. Saat ini aplikasi akan memakai posisi GPS sangat baru (<=15 detik), atau meminta pembacaan GPS baru dengan `forceFresh: true` dan `maxStaleAgeMs: 15000` (maks. pencarian sekitar 12 detik). GPS tetap wajib akurat <=50 meter, dalam radius sekolah, dan waktunya valid.
3. Kamera langsung menyimpan hasil ber-watermark sebagai **draf swafoto**, lalu menutup dialog kamera. Tombol **Gunakan Foto Ini** tidak lagi diperlukan khusus swafoto presensi. Pembuatan catatan kehadiran **tidak otomatis**: guru tetap harus menekan **Kirim Presensi Masuk**.
4. Jika guru mengirim setelah GPS foto berumur >30 detik, aplikasi mengambil GPS **baru** untuk validasi *lokasi pada waktu pengiriman* tanpa memaksa swafoto ulang. Draf foto asli tetap ada. Kolom `selfieCaptureGps` dan `selfieCapturedAt` pada record menyimpan GPS/waktu foto; koordinat utama record menggunakan GPS saat kirim.
5. Draf foto hanya dapat digunakan pada tanggal WIB yang sama dengan foto, dan tetap harus memenuhi keterkaitan waktu foto dengan GPS (maks. 30 detik). GPS **saat pengiriman** tetap harus akurat <=50m serta berada dalam radius sekolah. Foto baru wajib pada hari berikutnya.
6. Jika GPS benar-benar ditolak/tidak tersedia, aplikasi menampilkan alasan yang lebih jelas dan tidak melanjutkan secara tidak aman. Draf foto sebelumnya tetap tersedia jika masalah terjadi saat kirim.

## Pengujian yang direkomendasikan (Preview, bukan langsung produksi)

- [ ] Android, Chrome: halaman Presensi GPS → Ambil Swafoto → Jepret Foto 1 kali → otomatis tutup dan draf foto tampil → Kirim Presensi Masuk.
- [ ] Buka kamera saat GPS telah terdeteksi >30 detik yang lalu: klik Jepret 1 kali → GPS diperbarui otomatis; foto bisa selesai tanpa pesan cache lama.
- [ ] Setelah foto, tunggu lebih dari 30 detik sebelum kirim: GPS disegarkan otomatis, foto **tidak** diminta ulang.
- [ ] GPS dimatikan/izin lokasi ditolak: tidak boleh menghasilkan foto GPS palsu maupun menyimpan presensi.
- [ ] GPS akurasi >50m atau di luar radius: tetap ditolak; jangan menonaktifkan geofence.
- [ ] Dokumen presensi pada Firebase memiliki `selfieCapturedAt` / `selfieCaptureGps` sesuai watermark foto dan koordinat presensi utama sesuai lokasi verifikasi saat pengiriman.
- [ ] Konfirmasi tidak ada dua presensi dalam satu hari, kamera berhenti sesudah modal ditutup, dan foto draf lama tidak digunakan pada hari berikutnya.
- [ ] Kamera dokumentasi non-presensi tetap memakai alur konfirmasi/ambil ulang semula.

## Uji lokal

```bash
node scripts/test_r93_single_shot_gps.mjs
node scripts/test_r91_selfie_watermark_font.mjs
node scripts/verify_attendance_round10.cjs
npm run lint
npm run build
```

Pengujian logika/sintaks bukan pengganti uji kamera fisik/HTTPS/GPS/Firebase di Vercel Preview.

## Perubahan file

- `src/services/location/locationService.ts`
- `src/services/attendance/selfieWatermark.ts`
- `src/features/attendance/AttendancePreview.tsx`
- `src/components/camera/CameraCaptureModal.tsx`
- `src/services/firebase/attendanceService.ts`
- `src/types/index.ts`
- `scripts/test_r93_single_shot_gps.mjs`

Tidak mengubah `firestore.rules`, `settings`, PIN, GPS sekolah, dan kebijakan geofence.
