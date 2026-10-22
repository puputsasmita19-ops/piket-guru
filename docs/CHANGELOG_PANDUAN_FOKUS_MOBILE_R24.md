# Piket Guru R24 — Panduan Penggunaan Menunjuk Fitur Secara Langsung

Tanggal: 22 Oktober 2026

## Masalah yang diperbaiki
Panduan interaktif di HP sebelumnya menampilkan instruksi, tetapi sorotannya sering tidak muncul karena tombol GPS, Swafoto, dan Presensi berada di luar area layar. Pada R22 scroll otomatis di mobile sengaja dinonaktifkan agar tombol panduan tidak bergeser, tetapi dampaknya pengguna tidak mengetahui komponen yang dimaksud. Fallback ke keseluruhan halaman Presensi juga menghasilkan sorotan yang terlalu luas.

## Perubahan
- **Scroll otomatis terarah:** ketika langkah aktif, halaman bergerak tanpa animasi menuju tombol yang relevan, dengan jarak aman dari header dan kotak panduan. Tidak dilakukan terus-menerus pada setiap render.
- **Sorotan tepat sasaran:** langkah GPS memilih tombol Perbarui GPS, swafoto memilih Ambil/Ganti Foto, dan kirim presensi memilih tombol Masuk, Pulang, atau status Selesai sesuai kondisi aktual.
- **Label visual:** penanda "Bagian yang dimaksud" berada dekat elemen yang disorot; sorotan tidak ditampilkan jika target sebenarnya tidak terlihat.
- **Kotak mobile lebih ringkas:** tinggi maksimal adaptif, sehingga sebagian besar layar tetap menampilkan elemen yang sedang dipelajari. Area scroll tambahan hanya aktif selama panduan terbuka.
- **Kondisi setelah check-in:** jika tombol selfie sudah tidak muncul karena presensi masuk tercatat, panduan memberi penjelasan khusus, bukan menunjuk lokasi salah.
- **Respons tetap ringan:** pencarian elemen dibatasi waktunya dan tidak memakai pengamatan seluruh DOM; tombol Lanjut/Kembali/Tutup tetap single tap.
- **Keamanan:** elemen sorotan berfungsi sebagai penunjuk, bukan tombol untuk mengirim presensi otomatis. Presensi dan aturan akses tetap tidak diubah.

## File source yang berubah/ditambahkan
- `src/components/guide/InteractiveGuideTour.tsx` (diubah)
- `src/components/guide/guidePositioning.ts` (baru; utilitas posisi sorotan)
- `src/features/attendance/AttendancePreview.tsx` (diubah; penanda spesifik pada tombol)
- `src/index.css` (diubah; label sorotan, panduan ringkas dan ruang scroll sementara)

## Pengujian
Jalankan:

```bash
node scripts/verify_guide_spotlight_r24.cjs
npm run lint
npm run build
```

Verifikasi R24 mencakup sintaks, penanda target, dan uji fungsi geometri untuk layar kecil. Skenario scroll ke tombol GPS, selfie, dan kirim presensi juga dicoba dalam browser Chromium headless ukuran mobile. Pengujian langsung dengan Firebase dan perangkat Android nyata belum dilakukan.

## Langkah uji setelah deployment
1. Buka Panduan di HP pada menu Presensi.
2. Tekan **Lanjut** dari langkah 1 hingga 4: setiap langkah harus melakukan scroll sekali dan menyorot elemen yang sesuai, tanpa menutupinya.
3. Ulangi saat sudah check-in, saat belum check-in, dan setelah presensi lengkap. Jika selfie tidak tersedia, panduan harus memberi penjelasan kondisi tersebut.
4. Pastikan tombol **Tutup dulu, Kembali, Lanjut** berfungsi sekali ketuk dan setelah ditutup halaman kembali normal.

**Catatan:** Patch hanya mengubah panduan interaktif dan penanda visual. Perubahan tidak menyentuh logika Firebase, API, GPS geofence, maupun data tersimpan.
