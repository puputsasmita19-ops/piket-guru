# R95 — Smart GPS Auto-Guide to Swafoto

## Ruang lingkup

- **Presensi GPS → Presensi Mandiri**: Status GPS diperbarui begitu ada hasil pembacaan geolocation, bukan menunggu animasi atau timer selesai.
- Bila pembacaan **segar maksimal 15 detik**, **akurasi maksimal 50 m**, dan **di dalam radius sekolah**, sistem otomatis **scroll sekali** ke kotak **Ambil Swafoto** dan memfokuskan tombolnya. Kamera **tidak** dibuka otomatis dan foto **tidak** dijepret otomatis.
- Tombol disorot dengan outline warna aplikasi dan animasi ringan tiga putaran. Dengan preferensi aksesibilitas *reduced motion*, outline tetap tampak tanpa animasi.
- Pemandu tidak aktif ketika presensi masuk sudah ada, swafoto sudah dibuat, kamera sedang terbuka, atau pengguna tidak berhak check-in pada hari itu.
- Navigasi otomatis dibatasi **satu kali per akun/hari/per pembukaan halaman** supaya perubahan koordinat berkali-kali tidak menggeser layar terus menerus.
- Perubahan tidak menyentuh proses validasi GPS ketika shutter, kompresi/watermark, pengiriman presensi, GPS pulang, Firestore Rules, ataupun basis data.

## File patch

- `src/features/attendance/AttendancePreview.tsx` — GPS freshness aligned to 15 s, once-per-day auto-guide, progressive status, focus.
- `src/features/attendance/attendanceGps.css` — outline animasi yang ringan dan reduced-motion fallback.
- `src/features/attendance/selfieGpsGuide.ts` — aturan kelayakan pemandu UI terpisah, dapat diuji.
- `scripts/test_r95_smart_gps_selfie_guide.mjs` — uji regresi.
- `docs/R95_SMART_GPS_AUTO_GUIDE_SWAFOTO.md` — panduan ini.

## Cara menerapkan

1. Pastikan repository sudah menerapkan **R94**.
2. Ekstrak ZIP ke root repository dan izinkan penimpaan file yang disebut di atas.
3. Jalankan:

```bash
node scripts/test_r95_smart_gps_selfie_guide.mjs
node scripts/test_r94_fast_selfie_preparation.mjs
node scripts/test_r93_single_shot_gps.mjs
npm run lint
npm run build
```

4. Commit/push dengan GitHub Desktop, kemudian verifikasi pada Vercel Preview (bukan langsung produksi bila masih ada pilot).

## Skenario uji di HP

1. Login guru yang **belum presensi masuk** dan diperbolehkan check-in pada hari itu; aktifkan izin GPS presisi tinggi.
2. Buka menu **Presensi GPS**; ketika status sudah **Dalam Radius Sekolah**, halaman harus mengarah ke **Ambil Swafoto** satu kali, dengan outline jelas. Tap tombol untuk membuka kamera.
3. Tutup kamera tanpa foto, klik **Perbarui GPS**. Halaman **tidak boleh** meloncat lagi setiap pembaruan.
4. Uji GPS di luar radius / akurasi >50 m / GPS dimatikan. Jangan tampilkan panduan sukses palsu. Guru tetap bisa mencoba pembaruan lokasi.
5. Uji pengguna yang **sudah check-in** atau **sudah mempunyai draf swafoto**. Tidak ada navigasi otomatis.
6. Uji dengan preferensi perangkat `Reduce motion`; outline tetap jelas tanpa pulse.
7. Ambil swafoto satu kali dan kirim seperti R93/R94. GPS dan foto wajib tervalidasi ulang saat pengambilan/pengiriman.

## Batasan

Waktu perolehan GPS sangat bergantung pada satelit, perangkat, sinyal, dan izin browser. R95 mempercepat **respons UI dan alur menuju swafoto** setelah ada fix yang valid; R95 tidak mengubah kemampuan perangkat keras GPS atau menjamin angka waktu tertentu.
