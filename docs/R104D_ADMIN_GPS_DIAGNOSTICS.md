# R104-D — Admin GPS Diagnostics

Basis: **R104-C terpasang setelah R104-B dan R104-A**, aplikasi Piket Guru.

## Hasil utama

1. **Admin > Monitoring Piket Realtime:** panel *Diagnostik GPS Presensi Hari Ini* menampilkan jumlah Check-In yang memenuhi batas, perlu diperiksa, tanpa data, dan Check-Out dengan/tanpa bukti GPS. Setiap baris guru membuka detail Check-In dan Check-Out tanpa query Firestore tambahan.
2. **Admin > Riwayat Presensi:** detail GPS tersedia per catatan pada panel riwayat. Pada tabel Riwayat di menu Presensi GPS, kolom **Jarak GPS** dan **Akurasi GPS** dipisahkan; tombol **Detail GPS** hanya untuk role **ADMIN**.
3. **Check-In baru:** menyimpan `checkInGpsCapturedAt` (waktu fix GPS yang diterima browser, ISO UTC) dan `checkInRadiusMeters` (radius saat transaksi), di samping `latitude`, `longitude`, `accuracy`, `distance`, `status` yang sudah ada.
4. **Check-Out baru:** menyimpan `checkoutGps` di transaksi Firestore yang sama dengan waktu pulang, dengan `latitude`, `longitude`, `accuracy`, `distance`, `radiusMeters`, `status`, `capturedAt` (timestamp perangkat GPS), dan `validatedAt` (waktu server Firebase). Layanan menghitung geofence ulang dari setting sekolah yang dibaca di dalam transaksi; koordinat kadaluarsa atau akurasi >50 m ditolak.
5. **Data lama tidak diubah/backfill**. `jamMasuk` dan `jamPulang` bukan waktu pembacaan GPS. Jika `checkInGpsCapturedAt` atau `checkoutGps` tidak ada, tampil *Tidak tersedia*. Koreksi Admin bukan bukti GPS asli.

## Wajib: deploy firestore.rules sebelum frontend

**R104-D mengubah `firestore.rules`**: jika `checkoutGps` dikirim, data wajib berbentuk sesuai skema, akurasi <=50m, jarak <=radius sekolah yang tersimpan, dan timestamp konfirmasi berasal dari server. **Klien PWA versi lama masih boleh melakukan Check-Out tanpa `checkoutGps`** untuk kompatibilitas transisi, dengan batasan autentikasi/waktu yang sama seperti sebelum R104-D. Semua pembatasan lama mengenai akun aktif, kepemilikan, dan jam pulang tetap berlaku. Konfigurasi sekolah harus memiliki `allowedRadiusMeters` numerik (saat ini **300 m**).

Urutan implementasi untuk mencegah `permission-denied` pada Check-Out:

1. Backup `firestore.rules` dan gunakan Firebase Emulator untuk menguji transaksi Check-Out, baik sukses maupun penolakan field tidak sah; **tes emulator belum dijalankan pada lingkungan penyusunan patch**.
2. Review dan **deploy `firestore.rules`** proyek Firebase yang benar terlebih dulu (contoh bila Firebase CLI sudah dikonfigurasi: `firebase deploy --only firestore:rules`). Jangan menimpa aturan produksi tanpa review.
3. Baru gabungkan file `src/`, `scripts/`, `docs/` dan push Vercel. Perbarui PWA pada HP uji. **Versi lama tetap dapat Check-Out, namun tidak akan menyimpan bukti GPS baru.**
4. Uji dengan akun **GURU** dan **ADMIN**. Pastikan presensi pulang benar-benar berhasil dan Admin melihat GPS pulang. Pantau log `permission-denied`.

> **Perhatian rollout:** Aturan dibuat kompatibel dengan klien lama. Meski demikian, pilih jam sepi dan uji deployment bertahap; beri kesempatan pengguna memperbarui PWA. Dalam masa transisi, *GPS pulang belum ada* tidak selalu berarti GPS gagal; bisa jadi klien masih versi lama.

## Batas keamanan dan interpretasi

- Radius sekolah **tetap membaca dari `settings/school_config`**, saat ini **300 m**; akurasi maksimal **50 m**.
- Selama migrasi, aturan lama (tanpa field checkoutGps) masih diizinkan agar PWA yang belum diperbarui tidak gagal presensi. Tidak ada cara membedakan secara aman browser lama vs. browser baru hanya dari dokumen Firestore; **kehadiran bukti GPS bukan jaminan semua pengguna telah memakai rilis R104-D**.
- `capturedAt` berasal dari GPS browser/perangkat, sedangkan `validatedAt` dari server. Status *Memenuhi batas* berarti **data tercatat memenuhi ketentuan**, bukan bukti anti-GPS-spoofing. Firestore Rules tidak menghitung geodesi sendiri; geofence dihitung client sebelum transaksi dan ulang dari data settings yang dibaca di transaksi. Field bukti yang dikirim client harus dipandang sebagai bukti operasional, bukan verifikasi lokasi kriptografis.
- Layar Admin menampilkan koordinat operasional sensitif, sehingga **jangan ditampilkan dalam menu publik**. **Catatan privasi penting:** aturan saat ini `allow read: if isValidActiveUser()` pada koleksi `attendance` memungkinkan akun aktif membaca dokumen presensi yang berisi koordinat, termasuk field Check-Out baru. Patch ini tidak mengubah cakupan baca. Jika diperlukan perlindungan yang benar-benar hanya dapat dibaca ADMIN, rancang koleksi GPS terpisah beraturan admin-only dan migrasi terkontrol sebelum produksi luas.
- Perbaikan admin pada Check-Out lama tidak membuat bukti GPS baru. Histori tetap menampilkan *Tidak tersedia* untuk bukti yang tidak pernah dicatat.
- Tidak ada polling lokasi/Firebase tambahan pada dashboard Admin; panel memakai `todayRecords` yang sudah disubscribe.

## Pengujian lokal

```bash
node scripts/test_r104d_admin_gps_diagnostics.mjs
node scripts/test_r104c_mobile_gps_lifecycle.mjs
node scripts/test_r104b_instant_gps_engine.mjs
node scripts/test_r104a_gps_lifecycle_accuracy.mjs
npm ci
npm run lint
npm run build
```

Tes R104-D berbasis simulasi transaksi Firestore dan pemeriksaan statis aturan; **tidak menggantikan Firebase Rules Emulator, build produksi, ataupun tes GPS HP fisik**.

## Skenario uji setelah deploy

1. Login GURU di HP Android, buka Presensi GPS di lingkungan sekolah. Pastikan jarak <=300m dan akurasi <=50m. Ambil foto dan Check-In; pastikan Admin melihat jarak, akurasi, waktu pembacaan, dan radius.
2. Saat waktunya pulang, Check-Out. Pastikan dokumen menyimpan `checkoutGps` dan Admin dapat melihat jarak, akurasi, dua waktu terpisah, koordinat.
3. Coba Check-Out GPS palsu/absen, tidak akurat, kedaluwarsa, di luar radius, dan Check-Out kedua: semuanya harus ditolak.
4. Buka data presensi sebelum R104-D: waktu GPS Check-In dan data GPS Check-Out harus tertulis *Tidak tersedia*, bukan nol atau jam pulang.
5. Uji di layar HP kecil dan dark mode: panel detail harus bisa ditutup/buka dan tetap terbaca.
6. Uji perubahan radius di Admin: check-out berikutnya harus mengikuti setting server terbaru, bukan status GPS lama di tampilan.
