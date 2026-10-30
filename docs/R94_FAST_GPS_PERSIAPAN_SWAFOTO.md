# R94 — Fast GPS & Swafoto Preparation

**Basis:** kode setelah R93. Ekstrak ZIP ini di root repository Piket Guru (folder yang berisi `src/`, `scripts/`, dan `package.json`).

## Perbaikan
- Modal kamera memulai pemuatan font watermark Open Sans dan kamera secara bersamaan.
- Jika GPS belum segar, pembacaan GPS dapat dimulai saat modal kamera dibuka (hanya bila proses pencarian GPS normal tidak sedang berjalan).
- Jepret Foto menggunakan hasil GPS preflight yang masih segar, tanpa memulai pencarian kedua. Jika sudah kedaluwarsa, GPS diperbarui pada proses foto.
- Pemrosesan GPS dan kesiapan font saat shutter berjalan paralel, bukan menunggu satu per satu.
- Permintaan font bersama disimpan hanya sepanjang satu sesi tab, menghindari penundaan font ulang terutama ketika offline.
- Ketika modal ditutup, referensi preflight dilepas, dan saat mencoba lagi setelah GPS gagal permintaan lama tidak mengunci proses berikutnya.
- Kamera tetap memakai satu kali jepret untuk membuat draf; pengguna masih wajib menekan **Kirim Presensi Masuk** untuk mengirim presensi.

## Tidak berubah
- GPS wajib nyata, akurasi paling tinggi 50 meter, dan harus berada dalam radius sekolah.
- Data waktu dan GPS pada watermark berasal dari foto asli, bukan diisi secara otomatis dengan data palsu.
- Batas kedekatan waktu GPS ke foto 30 detik tetap; pemilihan bacaan pra-jepret lebih ketat, maksimal 15 detik.
- Foto tetap berwatermark Open Sans/Arial, kompresi JPEG dan batas berkas seperti R93.
- Tidak mengubah Firestore Rules, database, jam presensi, atau hak akses.

## Pengujian kode lokal
```bash
node scripts/test_r94_fast_selfie_preparation.mjs
node scripts/test_r93_single_shot_gps.mjs
node scripts/test_r91_selfie_watermark_font.mjs
npm run lint
npm run build
```

**Hasil pengujian statis/logika saat patch disiapkan:** R94 12/12; R93 17/17; R91 13/13.
**Belum teruji di sini:** build penuh menggunakan dependensi proyek serta kamera dan GPS pada HP sebenarnya.

## Checklist pada HP Android/iOS
1. Buka Presensi GPS, izinkan lokasi, lalu buka Ambil Swafoto. Pastikan preview kamera cepat tampil.
2. Saat GPS sudah dalam radius dan akurat, tekan Jepret Foto sekali. Harus langsung menjadi draf tanpa konfirmasi kedua.
3. Setelah menunggu 20–40 detik sejak GPS terakhir, coba ulang; GPS disegarkan otomatis tanpa menyuruh pengguna menekan Perbarui GPS manual.
4. Uji koneksi buruk/izin GPS ditolak/akurasi di atas 50m: harus tetap menolak, tidak menghasilkan draf palsu.
5. Periksa watermark dan alur Kirim Presensi Masuk setelah kamera ditutup.
6. Uji keluar modal lalu buka kembali: pengambilan kedua tidak terblokir oleh permintaan GPS lama.

## Rollback
Pulihkan 3 file di `src/` dari commit setelah R93 (sebelum R94), lalu commit dan deploy ulang. Perubahan skrip uji tidak memengaruhi aplikasi runtime.
