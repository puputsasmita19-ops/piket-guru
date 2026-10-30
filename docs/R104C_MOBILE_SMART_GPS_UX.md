# R104-C — Mobile Smart GPS & UX

**Basis:** source R104-B terpasang setelah R104-A, mengikuti pengaturan presensi Piket Guru.

## Tujuan

Ketika browser/PWA Android kembali aktif setelah layar terkunci, aplikasi berpindah tab, atau halaman kembali dari cache browser, GPS harus pulih dengan **satu permintaan yang relevan** dan status mudah dipahami. Tidak ada pencarian GPS ketika pengguna berada di tab Riwayat atau sedang melakukan Check-In, Check-Out, maupun mengambil swafoto.

## Perubahan

- `src/features/attendance/gpsMobileLifecycle.ts`: kebijakan murni yang menentukan perlu/tidaknya pembacaan GPS ketika layar kembali aktif.
  - GPS yang valid, akurat (≤50m), dan **sangat baru (≤8 detik)** boleh digunakan kembali di UI. Jika lebih lama, tidak akurat, atau tidak ada, minta pembacaan baru.
  - Event foreground beruntun dalam waktu <1.500 ms tidak men-trigger permintaan baru.
  - **Hanya** layar Presensi yang terlihat dan pengaturan lokasi sekolah yang sah yang boleh memulai pencarian otomatis.
  - Tidak memulai permintaan ketika kamera, Check-In, Check-Out, atau pencarian GPS lain sedang bekerja.
- `src/features/attendance/AttendancePreview.tsx`:
  - Menangani `visibilitychange`, `pageshow`, `pagehide`, dan `focus` dengan listener stabil beserta cleanup.
  - Ketika halaman masuk background, proses GPS tampilan non-kritis dibatalkan; koordinat lama tidak dianggap tetap segar. Saat aktif lagi, pencarian dilanjutkan jika perlu.
  - Pencarian setelah resume memerlukan callback browser baru (`forceFresh`) dan **tidak menerima koordinat lama dari cache sebagai pembacaan baru**.
  - Kembali dari Riwayat ke Presensi tidak membuang koordinat yang masih layak. Riwayat tidak memulai pencarian GPS sendiri.
  - Notifikasi kecil **"Memperbarui GPS setelah aplikasi kembali aktif…"** tampil saat proses berlangsung, dengan dukungan `aria-live` dan tanpa animasi berat.
  - Perubahan koordinat sekolah/radius mereset hasil GPS lama. Status, aksi presensi, dan panduan swafoto tetap tunduk pada pembacaan GPS nyata.
- `src/features/attendance/attendanceGps.css`: gaya notifikasi GPS baru untuk mode terang/gelap, tanpa efek animasi yang berat.
- `scripts/test_r104c_mobile_gps_lifecycle.mjs`: tes keputusan resume, ketukan event berulang, GPS non-valid, UI, dan lifecycle cleanup.

## Persyaratan keamanan yang tidak berubah

- Radius **300 meter** yang telah disimpan di `settings.school_config`, **bukan hardcode**.
- Ambang akurasi maksimum **50 meter**.
- Batas kesegaran UI Swafoto 15 detik, dengan validasi ulang pada shutter/pengiriman presensi.
- Kamera dan tombol Kirim Presensi tetap memerlukan tindakan manual guru.
- Jika izin GPS ditolak / pembacaan gagal / lokasi di luar radius, lokasi tidak boleh diloloskan.
- Tidak ada perubahan ke `firestore.rules`, skema presensi, atau backend.

## Uji di repo

```bash
node scripts/test_r104c_mobile_gps_lifecycle.mjs
node scripts/test_r104b_instant_gps_engine.mjs
node scripts/test_r104a_gps_lifecycle_accuracy.mjs
npm ci
npm run lint
npm run build
```

**Hasil penyusunan:** R104-C 29/29 PASS, regresi R93–R97, R101–R102, R104-A/B 139/139 PASS, TypeScript terisolasi PASS. `npm run lint` proyek belum dapat dilewati karena dependensi React, Firebase dan tipe Node belum tersedia di lingkungan penyusunan; build dan pengujian fisik wajib di repositori pengguna.

## Skenario HP Android / PWA

1. Buka Presensi GPS dengan lokasi aktif dan izin sudah diberikan. Pastikan koordinat dalam radius 300m dan akurasi ≤50m menampilkan status **Dalam Radius** serta memandu swafoto.
2. Kunci layar selama lebih dari 15 detik lalu buka lagi. Status lama tidak boleh tetap dianggap valid; aplikasi otomatis memulai pembacaan baru dan menampilkan notifikasi ringkas.
3. Kunci/buka layar beberapa kali dan berpindah aplikasi. Pastikan tidak ada dua loading GPS bersamaan dan tidak ada pembacaan yang bertabrakan.
4. Beralih ke Riwayat, tunggu, lalu kembali ke Presensi. GPS hanya dicari bila pembacaan tidak lagi sangat baru, dan tidak dicari saat tetap berada di Riwayat.
5. Ambil foto atau lakukan Check-In / Check-Out ketika layar berubah aktif/nonaktif. Pastikan permintaan GPS untuk proses kritis tidak diputus oleh handler background.
6. Matikan izin lokasi / pindah ke luar radius. Setelah resume, aplikasi harus tetap gagal-tertutup dan memberikan penjelasan yang sesuai.
7. Periksa Chrome Android dan PWA terpasang, termasuk mode hemat baterai atau GPS lambat. Kecepatan hardware/OS tidak dapat dijamin oleh aplikasi.

## Batasan

- Browser bisa membatasi eksekusi saat halaman disembunyikan. Pembacaan baru dimulai saat event foreground kembali diterima, bukan ketika layar terkunci.
- Estimasi akurasi browser tidak menjamin anti-spoofing GPS.
- R104-D berikutnya dapat menambahkan akurasi, timestamp, dan jarak yang tercatat di sisi admin. R104-C sendiri tidak mengubah skema rekam GPS pada presensi pulang.
