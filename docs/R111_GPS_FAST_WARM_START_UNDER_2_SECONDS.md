# R111 — Mobile GPS Fast Warm-Start (sasaran <2 detik)

## Tujuan
Mengurangi waktu dari membuka Presensi GPS hingga koordinat valid terbaca pada HP Android yang sudah memberikan izin lokasi. **<2 detik adalah target lapangan, bukan garansi**: perangkat, OS, cache GNSS, dan sinyal bisa menyebabkan waktu lebih lama.

## Perubahan
- `src/services/location/gpsFastWarmup.ts` (baru): prewarm **satu kali** di dashboard pasca-login atau ketika memasuki presensi, *hanya jika* `navigator.permissions.query('geolocation')` = `granted`. Tidak memicu dialog izin lokasi. Tidak melakukan tracking berkala. Maksimal pencarian 6,5 detik dan jeda percobaan berikut 20 detik untuk menghemat baterai.
- `src/AuthenticatedShell.tsx`: impor modul GPS **secara dinamis setelah login** agar login dan unduhan kerangka dashboard tidak ikut melambat; hanya jika pengguna punya izin fitur Presensi GPS.
- `src/features/attendance/AttendancePreview.tsx`: memanfaatkan shared GPS engine R104-B dan cache koordinat berumur maksimal 15 detik. Tambahan meter waktu **opt-in** `?gps_diag=1`, dari halaman Presensi dirender hingga GPS segar memenuhi akurasi dan radius. Untuk pembaruan manual pengukuran dimulai dari ketukan tombol.
- Presensi tetap memakai koordinat resmi sekolah yang diambil dari pengaturan (radius saat ini 300 m) dan akurasi <=50 m; tidak memakai cache yang kedaluwarsa untuk izin presensi. Foto, check-in, check-out tetap membutuhkan interaksi dan validasi yang berlaku.

## Instalasi
Ekstrak ZIP **setelah R110 / region `sin1`** ke root repository; commit/push di GitHub Desktop. Tidak mengubah `firestore.rules`, `vercel.json`, atau skema Firebase.

## Pengujian kode
```
node scripts/test_r111_gps_fast_warm_start.mjs
node scripts/test_r104b_instant_gps_engine.mjs
node scripts/test_r104c_mobile_gps_lifecycle.mjs
npm run lint
npm run build
```

## Uji langsung di HP (kunci agar target <2 detik berarti)
1. Buka aplikasi sesudah deploy dan login. Pastikan izin lokasi Chrome untuk aplikasi sudah **Izinkan** dan layanan lokasi HP menyala.
2. Dari dashboard, tunggu sekilas (1–2 detik), lalu buka **Presensi GPS** dengan URL `https://piket-guru-ashen.vercel.app/?gps_diag=1#attendance` jika ingin melihat meter waktu.
3. Catat durasi diagnostik **GPS siap**, akurasi (<=50m), jarak (<=300m), dan apakah indikator Dalam Radius muncul. Ulangi 5 kali: kondisi hangat vs baru membuka aplikasi.
4. Tes izin lokasi belum diberikan/ditolak: prewarm tidak meminta izin sendiri; permintaan izin tetap hanya muncul di alur presensi.
5. Tes lokasi di luar radius, akurasi >50m, dan data lama: jangan ada status Dalam Radius yang keliru.

**Interpretasi:** warm-start yang sudah punya fix segar dapat tampil sangat cepat, sedangkan cold fix tidak bisa dipaksa <2 detik oleh JavaScript. Jika hasil cold fix >2 detik, jangan mengurangi ketelitian atau memakai koordinat lama untuk mengakali target.

## Catatan QA
Tes Node memakai simulasi Geolocation/Permissions API. Tidak memverifikasi durasi hardware GPS pada HP nyata. Full lint/build hanya lulus bila semua dependensi React/Firebase terpasang.
