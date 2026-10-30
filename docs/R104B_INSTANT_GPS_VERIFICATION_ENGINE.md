# R104-B — Instant GPS Verification Engine

**Baseline:** R104-A (GPS Lifecycle & Accuracy Audit), melanjutkan R103 Piket Guru.

## Tujuan dan hasil

Mempercepat respons GPS di mobile dengan **satu pembacaan hardware aktif** yang bisa digunakan beberapa pemanggil sekaligus. Tidak ada perubahan izin, data sekolah, radius, atau ambang kualitas GPS. Layanan tetap **gagal-tertutup** pada koordinat tidak akurat, basi, atau di luar radius.

## Perubahan kode

1. `src/services/location/locationService.ts`
   - Pemanggil GPS serentak berbagi **satu** `getCurrentPosition` cepat dan **satu** `watchPosition` akurasi tinggi. Permintaan baru tidak lagi otomatis membatalkan permintaan terdahulu.
   - Masing-masing permintaan memiliki batas waktu, persyaratan `forceFresh`, toleransi usia koordinat, dan callback progres sendiri.
   - **Hasil pertama** yang segar, valid, dan akurasinya **≤50 meter** langsung menyelesaikan permintaan. Nilai `desiredAccuracyMeters:20` hanya target aspiratif, bukan alasan menunggu hingga di bawah 20m.
   - Pembacaan dengan akurasi **>50m** hanya menjadi progres sementara; watcher tetap mencari hingga waktu habis.
   - Timeout satu pemanggil **tidak menghentikan watcher** bila pemanggil lain masih menunggu. Setelah semua selesai/gagal, watcher dilepas.
   - Pembacaan dengan timestamp/koordinat tidak valid atau data `forceFresh` yang lebih tua dari waktu mulai permintaan ditolak.
   - Izin GPS ditolak → semua permintaan segera gagal dengan pesan jelas. Kesalahan sinyal sementara → tetap menunggu pembacaan lebih baik selama batas waktu pemanggil.
   - `cancelCurrentSearch()/clearCurrentWatcher()` khusus untuk menghentikan aktivitas (mis. halaman ditutup), menolak semua promise dengan `AbortError`.
2. `src/features/attendance/AttendancePreview.tsx`
   - Pra-pembacaan GPS ketika izin sudah diberikan **tetap aktif**, tetapi saat `school_config` siap, halaman langsung berlangganan progres mesin GPS bersama. Tidak perlu menunggu janji prewarm selesai sebelum update status.
   - Penilaian geofence tetap memakai koordinat sekolah resmi di `settings.schoolLat`, `settings.schoolLng`, dan `settings.allowedRadiusMeters`.
   - Panduan Swafoto (R95), satu kali jepret, validasi Check-In/Check-Out, dan timer GPS kedaluwarsa R104-A tetap berlaku.
3. `scripts/test_r102_mobile_login_gps.mjs` — pembaruan pengujian regresi untuk mekanisme shared-prewarm yang baru.
4. `scripts/test_r104b_instant_gps_engine.mjs` — 19 pemeriksaan unit simulasi GPS browser, cache, konkurensi, timeout, permission, kualitas, radius, dan UI.

## Kebijakan yang tidak diubah

- **Radius sekolah: 300m** adalah konfigurasi **di database**, bukan angka yang ditetapkan ulang dalam patch.
- **Akurasi maksimum: 50m**. Jika pembacaan = 45m dan berada di radius, hasil boleh dipakai tanpa menunggu 20m.
- Koordinat untuk **panduan swafoto** harus masih segar (≤15 detik); pengiriman presensi tetap memeriksa ulang kesegaran dan geofence.
- Tidak ada swafoto otomatis atau kirim presensi otomatis.
- Tidak mengubah `firestore.rules`, skema Firebase, PIN, maupun sesi pengguna.

## Keterbatasan yang disengaja

- Optimasi mengurangi pembacaan GPS **ganda** serta penundaan karena memburu akurasi 20m; **tidak menjamin** lokasi langsung diperoleh bila perangkat, OS, izin, atau sinyal satelit lambat.
- Mesin hanya menggunakan estimasi akurasi dari browser; **tidak dapat memastikan anti-mock location / spoofing**.
- R104-C masih relevan untuk pengelolaan ulang GPS saat aplikasi berpindah background/foreground dan UX mobile. R104-D masih relevan untuk menyimpan dan menampilkan diagnostik akurasi Admin; terutama bukti GPS Check-Out pada backend.

## Pengujian otomatis

```bash
node scripts/test_r104b_instant_gps_engine.mjs
node scripts/test_r104a_gps_lifecycle_accuracy.mjs
node scripts/test_r102_mobile_login_gps.mjs
node scripts/test_r93_single_shot_gps.mjs
node scripts/test_r94_fast_selfie_preparation.mjs
node scripts/test_r95_smart_gps_selfie_guide.mjs
node scripts/test_r96_checkin_checkout_highlight.mjs
npm ci
npm run lint
npm run build
```

**Hasil di lingkungan penyusunan:** R104-B 19/19 PASS; regresi R91, R93–R97, R101–R104-A 149/149 PASS. Kompilasi `tsc` terisolasi untuk `locationService.ts` PASS. Lint proyek lengkap belum dapat diluluskan karena `node_modules`/dependensi React dan Firebase tidak tersedia; validasi di repositori/deployment wajib.

## Uji manual Chrome Android / PWA

1. Pastikan GPS dan izin lokasi aktif. Buka Presensi GPS pada radius 300m. Jika pembacaan berada di radius dan akurasi ≤50m, status **Dalam Radius** langsung tampil dan tombol Swafoto disorot.
2. Saat akurasi awal 80–100m, aplikasi menampilkan pembacaan sementara, **tidak** memverifikasi lokasi. Ketika pembacaan berikutnya ≤50m, status langsung valid.
3. Buka kamera ketika GPS masih dipersiapkan. Pastikan tidak ada loading dua kali, satu kali jepret dan watermark tetap berhasil.
4. Setelah swafoto, tahan >30 detik sebelum Check-In; sistem harus mengambil GPS segar tanpa membuang foto.
5. Pindah ke luar radius, ubah izin GPS, atau tutup halaman saat mencari. Pastikan presensi tidak lolos lewat koordinat kedaluwarsa dan pencarian terhenti saat halaman ditutup.
6. Lakukan Check-Out pada jam yang diizinkan; koordinat dan geofence dihitung ulang dan kebijakan 50m/300m tetap diterapkan.

## File patch incremental

- `src/services/location/locationService.ts`
- `src/features/attendance/AttendancePreview.tsx`
- `scripts/test_r102_mobile_login_gps.mjs`
- `scripts/test_r104b_instant_gps_engine.mjs`
- `docs/R104B_INSTANT_GPS_VERIFICATION_ENGINE.md`
