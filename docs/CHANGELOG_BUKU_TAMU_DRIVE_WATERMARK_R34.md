# Piket Guru R34 — Penyimpanan Foto Buku Tamu, QR & Mode Watermark
Tanggal: 23 Oktober 2026

## Penyebab temuan
1. `VisitorService.registerVisitor()` (input petugas) sudah menggunakan `processPhotoForStorage(..., 'visitors', ...)`. Bila Drive diaktifkan dan siap, hasilnya disimpan sebagai `/api/drive/photo/<fileId>`. Bila Drive dimatikan secara eksplisit, hasilnya tetap Base64 di dokumen Firestore `visitors`.
2. Jalur QR mandiri pada `visitorRegistrationRoutes.ts` sebelumnya memasukkan foto Base64 dari antrean langsung ke catatan `visitors` saat disetujui. **Itulah celah yang diperbaiki**.
3. Laporan foto sebelumnya mengidentifikasi watermark terutama dari penanda dalam URL. Ketika URL sudah berubah menjadi proxy Google Drive, penanda itu hilang. Label **Foto Arsip (Non-watermark)** bisa salah untuk foto yang sebenarnya berwatermark.

## Perubahan R34
- QR yang disetujui mengunggah foto ke Google Drive lebih dahulu ketika Drive aktif. Gagal unggah atau koneksi Drive belum siap -> tidak ada badge atau data kunjungan baru; permintaan tetap PENDING. Unggah bersifat idempotent pada identitas foto/kunjungan. Dua petugas tidak bisa memproses satu QR secara bersamaan karena lease transaksi Firestore.
- Ketika Drive dinonaktifkan secara eksplisit, sumber lama tetap kompatibel: foto disimpan sebagai Base64 di dokumen `visitors`. Sistem menunjukkan lokasinya agar admin tahu situasi tersebut.
- Detail foto di Buku Tamu menunjukkan lokasi penyimpanan: Drive/Firestore/tautan eksternal dan mode watermark jika diketahui.
- Admin dapat memindahkan foto **lama yang masih Base64** ke Drive, satu per satu, melalui detail foto → **Kirim Foto Lama ke Google Drive**. Foto lama di Firestore tidak diganti sebelum upload Drive sukses dan pembaruan catatan tidak konflik. Tidak dilakukan migrasi massal otomatis yang berisiko saat deploy.
- Role Admin → Pengaturan Sekolah → bagian *Cetak laporan & tujuan buku tamu* → **Pengambilan foto tamu**: jenis foto default dan izin petugas memilih saat memotret. Petugas mendapatkan pemilih **Dengan Watermark / Tanpa Watermark** pada formulir Buku Tamu. Pilihan jenis foto tidak menentukan lokasi penyimpanan. Foto QR mandiri tetap asli/tanpa watermark, dengan verifikasi petugas wajib.
- Data foto baru menyimpan metadata `fotoMode` dan `fotoStorageProvider`. Laporan menggunakan mode eksplisit untuk foto tamu. Foto lama tanpa mode tidak diklaim pasti non-watermark; label berubah menjadi *Status watermark belum diverifikasi*.
- Lokasi penyimpanan baru di Drive adalah `PiketGuru_Photos/<YYYY>/<MM>/visitors` berdasarkan tanggal unggah menurut server, misalnya `PiketGuru_Photos/2026/10/visitors`.

## File patch
- `src/types/visitorConfig.types.ts`
- `src/types/visitor.types.ts`
- `src/types/watermark.types.ts`
- `src/features/settings/OperationalReportSettingsCard.tsx`
- `src/features/visitors/VisitorFormModal.tsx`
- `src/features/visitors/VisitorPreview.tsx`
- `src/features/reports/ReportsPreview.tsx`
- `src/services/firebase/visitorService.ts`
- `src/server/routes/visitorRegistrationRoutes.ts`
- `scripts/verify_visitor_drive_watermark_r34.cjs`
- `docs/CHANGELOG_BUKU_TAMU_DRIVE_WATERMARK_R34.md`

## Pengujian
- `node scripts/verify_visitor_drive_watermark_r34.cjs`: 36 pemeriksaan lulus, termasuk eksekusi fungsi pemroses foto QR dengan tiruan Drive sukses/gagal.
- `node scripts/verify_visitor_photo_r29.cjs`: 28 lulus.
- `node scripts/verify_visitor_registration_r28.cjs`: 26 lulus.
- `node scripts/verify_build_exports_r16_2.cjs`: 418 file source, 3.091 impor/ekspor lokal terverifikasi.
- `npm run lint`: TIDAK LULUS karena dependensi `@types` tidak lengkap di lingkungan pengujian.
- `npm run build`: TIDAK LULUS karena executable `vite` tidak tersedia di lingkungan pengujian.
- Tidak ada pengujian langsung ke Google Drive pengguna atau Firebase produksi. **Jangan klaim file di Drive sudah ada sebelum dicek di akun Drive yang terhubung**.

## Langkah pemasangan / pemeriksaan
1. Backup repository dan konfigurasi. Ekstrak ZIP incremental ke root repository, tanpa menimpa `.git`/`.env`.
2. Commit & Push origin di GitHub Desktop. Pastikan deployment Vercel **Ready**.
3. Admin → Pengaturan Sekolah → Penyimpanan Foto Google Drive Pribadi. Pastikan terhubung, Uji Koneksi sukses, serta opsi *Aktifkan Penyimpanan Drive untuk Foto Baru* aktif. Bila tidak aktif, Base64 di Firestore tetap merupakan perilaku normal.
4. Admin → Pengaturan Sekolah → bagian cetak/buku tamu: pilih default watermark dan apakah petugas boleh mengganti mode.
5. Buat satu tamu baru dengan foto dari petugas. Lihat detail foto, pastikan *Google Drive* dan cek folder Drive `PiketGuru_Photos/<YYYY>/<MM>/visitors`.
6. Buat satu QR registrasi, isi foto dan persetujuan di HP uji, setujui sebagai petugas, periksa file di Drive dan badge.
7. Uji kegagalan Drive di lingkungan pengujian: pengajuan QR harus tetap menunggu. Jangan lakukan pengujian gagal paksa pada sekolah yang sedang aktif.
8. Untuk foto lama, buka foto di Buku Tamu dan klik *Kirim Foto Lama ke Google Drive* memakai role ADMIN, setelah memastikan Drive aktif.

## Batasan / perlindungan privasi
- Foto tamu berisi data pribadi: batasi akses akun petugas, jangan bagikan URL publik, dan tetapkan retensi/persetujuan sesuai kebijakan sekolah.
- R34 tidak mengubah Firebase Rules, tidak memindahkan foto lama secara otomatis, tidak menghapus foto di Google Drive, tidak mengubah penomoran badge, dan tidak mengubah presensi.
- QR mandiri menghasilkan foto asli (tanpa watermark); mode watermark yang dipilih petugas tidak otomatis mengolah gambar yang sudah diajukan melalui QR.
