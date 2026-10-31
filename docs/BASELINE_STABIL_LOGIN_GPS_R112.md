# PIKET GURU — Baseline Stabil Login & GPS (R112)

**ID baseline:** `PIKET-GURU-STABLE-LOGIN-GPS-R112`  
**Tanggal pembekuan acuan:** 31 Oktober 2026  
**Basis kode:** login R110 dengan penyelarasan region Jakarta–Singapura dan GPS R112 (mencakup R104-A/B/C/D dan R111).  
**Status:** Baseline kode & pengujian simulasi siap dijadikan acuan. **Bukan sertifikasi produksi atau SLA.**

## 1. Hal yang dipertahankan (jangan diubah tanpa audit regresi)

| Area | Perilaku baseline | Pengamanan |
|---|---|---|
| Login PIN | Login melalui backend → verifikasi PIN aman → Firebase Sign-In → dashboard | Rate limiter/IP/akun, lock, status akun, Firebase token & sesi tetap berlaku |
| Rate limiter | Admission dan reset transaksional Firestore; pembacaan berkelompok; tidak mengulang pemeriksaan lock jika UID middleware cocok | Transaksi atomik, lease, penolakan ketika Firestore tidak tersedia, blokir aktif tidak boleh dihapus |
| Infrastruktur | Firestore `(default)` di `asia-southeast2` (Jakarta); fungsi Vercel ditetapkan `sin1` di `vercel.json` | Pastikan `X-PG-Function-Region` atau diagnostik `sin1` setelah deploy |
| Login UX | PIN responsif tanpa haptic; satu notifikasi error; daftar akun diprioritaskan; dashboard hanya setelah Firebase sah | Tidak mengasumsikan login sukses dari cache, tidak membocorkan PIN/token di diagnostik |
| GPS | Warm-start setelah login **jika** permission granted; shared watcher; cache hanya untuk koordinat segar | Tidak membuka izin otomatis tanpa aksi pengguna; tidak melacak terus-menerus |
| Status Dalam Radius | Diterbitkan hanya dari koordinat valid dengan jarak <= radius sekolah, akurasi <= 50 m, dan data segar | Radius sekolah berasal dari pengaturan Admin; saat pengujian terkonfirmasi 300 m, bukan hardcode |
| Masa berlaku GPS | Status halaman memerlukan usia lokasi <= 15 detik | Check-In, Check-Out, dan swafoto memvalidasi kembali sesuai kebutuhannya |
| GPS UX | Segera perbarui status; panduan Swafoto satu kali, tanpa jeda tetap 160 ms; batalkan hanya subscriber halaman | Jangan batalkan shared watcher milik proses lain; tidak otomatis memotret atau mengirim presensi |
| Bukti GPS Admin | Informasi GPS Check-In/Check-Out baru dipisahkan; data lama tanpa bukti ditandai tidak tersedia | Tetap gunakan `firestore.rules` versi R104-D; validasi data baru tetap berlaku |

## 2. Kinerja lapangan yang boleh dijadikan referensi (bukan janji)

**Login Android, sesudah region `sin1`:** 2,37; 2,00; 2,08 detik → **rata-rata 2,15 detik** sampai sesi selesai. Kerangka dashboard: 2,97; 2,84; 2,80 detik → **rata-rata 2,87 detik**. Ini hasil pada satu perangkat/kondisi, dari pengujian sesudah R110 region alignment; durasi login **belum diukur ulang setelah patch GPS R112**.

**GPS:** pengguna melaporkan pembacaan **sedikit di atas 2 detik setelah R111**. R112 memperbaiki konsistensi, pembatalan, dan navigasi, tetapi **belum ada angka terukur sesudah R112**, sehingga status target GPS di bawah 2 detik adalah **belum terverifikasi**. Hardware GPS, izin, gedung, dan kondisi sinyal dapat mengubah hasil.

**Ambang evaluasi saat uji penerimaan berikutnya** (jangan jadikan batas pemblokiran login):
- Login PIN → sesi: target <= 3 detik pada kondisi jaringan representatif, **bukan jaminan**; pencapaian sebelumnya 2,15 detik rata-rata.
- Dashboard tampil: bandingkan ke baseline sebelumnya 2,87 detik, hindari kemunduran yang konsisten.
- GPS siap: catat *median*, *p95*, dan jumlah keberhasilan <=2 detik dari minimal 5–10 uji untuk tiap kondisi cold/warm. Jangan abaikan data GPS yang tidak valid agar metrik tampak baik.
- Radius pengaturan sekolah saat ini: 300 m. Ambang akurasi maksimum: 50 m. Usia koordinat untuk status halaman: <= 15 detik.

## 3. Cara menetapkan baseline di repository

1. Pastikan repository berisi **seluruh patch hingga R112**, `vercel.json` memiliki `"regions": ["sin1"]`, dan `firestore.rules` hasil R104-D telah dipertahankan.
2. Ekstrak ZIP baseline ini ke root repo (berisi **dokumentasi + guard**, **tidak mengganti kode aplikasi**).
3. Jalankan pemeriksaan ringan (tanpa `npm install`):
   ```bash
   node scripts/verify_baseline_login_gps_r112.mjs --check
   ```
4. Jalankan regresi utama (**perlu dependensi `typescript`**):
   ```bash
   npm ci
   node scripts/verify_baseline_login_gps_r112.mjs
   node scripts/verify_baseline_login_gps_r112.mjs --full
   npm run lint
   npm run build
   ```
5. Commit melalui GitHub Desktop dengan pesan `BASELINE R112 - Stable Login & GPS (sin1)` kemudian push. Di **Repository → Open in Terminal** (jika ingin menandai titik balik):
   ```bash
   git tag baseline-login-gps-r112-20261031
   git push origin baseline-login-gps-r112-20261031
   ```
   Buat tag **hanya setelah** kode dan pengujian benar-benar siap. Jangan mengubah baseline historis jika ada patch baru: buat baseline versi baru setelah lulus QA.

## 4. Prosedur rollback & perubahan berikutnya

- Jangan mengubah file autentikasi, rate limiter, GPS, atau aturan Firestore secara bersamaan tanpa pengujian. Gunakan patch kecil dan pemeriksaan `--full` setiap kali menyentuh jalur kritis.
- Skrip guard mencocokkan SHA-256 file inti terhadap snapshot R112. **Ketidakcocokan hash berarti ada perubahan, bukan bukti langsung kerusakan.** Periksa patch dan ulangi tes. Untuk versi yang sengaja diperbarui, simpan baseline R112 dan buat manifest/tag baru, jangan menimpa manifest lama.
- Jika deployment baru bermasalah, gunakan fitur rollback deployment Vercel ke versi yang sudah diverifikasi atau revert commit di Git. **Pastikan kompatibilitas schema/rules sebelum rollback**, karena rollback frontend tidak otomatis mengembalikan perubahan database.
- Tidak ada perubahan Firestore Rules atau region yang perlu dideploy dari paket baseline ini.

## 5. Uji manual wajib pada HP Android

1. **Login:** jalankan 5 kali dengan PIN benar pada 4G/Wi-Fi; catat `?login_diag=1`, waktu backend & Firebase, dan region `sin1`. Uji PIN salah, akun nonaktif/terblokir, dan refresh sesi.
2. **GPS:** aktifkan `?gps_diag=1`, uji 5–10 kali dari dashboard saat izin sudah `granted`, termasuk saat aplikasi cold/warm. Catat durasi, akurasi, jarak, dan status.
3. **Radius:** dengan radius sekolah 300 m, lokasi di luar radius atau akurasi >50 m **tidak boleh mendapat status valid**. Koordinat yang >15 detik tidak boleh mempertahankan status hijau.
4. **UX:** valid GPS langsung mengarah ke swafoto sekali, outline Check-In/Check-Out aktif saat siap, dan scroll tidak berulang. Uji background → foreground serta berpindah Presensi ↔ Riwayat.
5. **Audit Admin:** cek jarak vs akurasi; data Check-Out lama tanpa bukti tampil “Tidak tersedia”, bukan nilai hasil karangan.

## 6. Keterbatasan pengujian baseline

Guard dan regresi lokal bekerja memakai simulasi kode. Mereka **tidak bisa menguji kecepatan sinyal GPS pada HP**, latensi jaringan 4G ke Vercel, sign-in Firebase live, ataupun Firebase Emulator tanpa dependensi/konfigurasi yang diperlukan. Pengujian produksi tetap terpisah.
