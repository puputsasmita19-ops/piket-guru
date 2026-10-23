# Piket Guru R35 — Tombol Migrasi Foto Buku Tamu pada Laporan & Rekap

Tanggal: 23 Oktober 2026

## Penyebab
Di patch R34, tombol **Kirim Foto Lama ke Google Drive** hanya ada pada dialog **Buku Tamu Digital → Dokumentasi Foto Tamu**, bukan pada dialog **Laporan & Rekap → Rekap Foto → Detail Foto Dokumentasi**. Screenshot memperlihatkan dialog kedua, sehingga tombol tidak terlihat.

## Perubahan
- Tambahkan status lokasi penyimpanan foto pengunjung pada dialog Detail Foto Dokumentasi di Laporan & Rekap: **Firestore/Base64**, **Google Drive**, atau **sumber tidak dikenali**.
- Tambahkan tombol **Kirim Foto Lama ke Google Drive** untuk **Admin** pada foto **Buku Tamu** yang masih berbentuk data Base64. Foto modul lain dan foto yang telah berada di Drive tidak mendapat tombol tersebut.
- Tambahkan konfirmasi sebelum migrasi, indikator proses, pesan keberhasilan/gagal, serta penguncian tombol saat unggah berlangsung.
- Setelah migrasi berhasil, gambar dan label penyimpanan di dialog segera diperbarui; data pada modul laporan juga mengikuti Firestore realtime.
- Migrasi layanan sekarang mengenali kolom foto lama (`fotoUrl`, `photoUrl`, `fotoTamu`, atau `foto`) sehingga catatan versi lama tetap bisa dipindah. Alias data foto Base64 yang sama dibersihkan *setelah* unggahan dan sebelum penyimpanan catatan berhasil.
- Penyimpanan catatan menggunakan pemeriksaan versi `expectedState` agar tidak diam-diam menimpa pembaruan admin lain.
- Operasi tidak berjalan otomatis dan tidak membuka akses bagi guru biasa. Jika unggah gagal, catatan Firestore sebelumnya tidak diubah.

## File patch incremental
- `src/features/reports/ReportsPreview.tsx`
- `src/services/firebase/visitorService.ts`
- `scripts/verify_visitor_photo_move_r35.cjs`
- `docs/CHANGELOG_FOTO_TAMU_DRIVE_R35.md`

## Cara uji
1. Pastikan pengaturan Penyimpanan Foto Google Drive sekolah **aktif** dan status koneksi **CONNECTED**.
2. Masuk dengan akun **ADMIN**.
3. Buka **Laporan & Rekap → Rekap Foto Dokumentasi**, pilih foto Buku Tamu lama dan buka **Detail Foto Dokumentasi**.
4. Bila informasi penyimpanan **Firestore/Base64**, klik **Kirim Foto Lama ke Google Drive**, lalu konfirmasi.
5. Pastikan status berubah menjadi **Google Drive**. Periksa folder `PiketGuru_Photos/<tahun>/<bulan>/visitors` di Drive terhubung.
6. Buka ulang laporan; fotonya harus tetap tampil. Jika foto ternyata telah tersimpan di Drive, tombol migrasi tidak perlu muncul.

Jalankan pemeriksaan source: `node scripts/verify_visitor_photo_move_r35.cjs`.

## Batas pengujian
- Pemeriksaan unit simulasi dan validasi sintaks dilakukan, tetapi tidak mengunggah ke Drive sungguhan.
- `npm run lint` / `npm run build` belum dapat diselesaikan dalam lingkungan ini karena dependensi proyek belum lengkap. Tetap konfirmasi status **Ready** di Vercel.
- Patch ini tidak otomatis memigrasikan semua foto arsip lama dan tidak membutuhkan pembaruan Firestore Rules baru.
