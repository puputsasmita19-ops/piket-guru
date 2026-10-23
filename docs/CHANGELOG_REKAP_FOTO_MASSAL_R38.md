# Piket Guru R38 — Verifikasi Watermark Massal & Nomor Urut Foto

## Perubahan
- Rekap Foto kini mempunyai pilihan urutan **Terbaru → Terlama** (default) dan **Terlama → Terbaru**, berdasarkan waktu dokumentasi (bila ada), kemudian waktu kejadian.
- Kartu foto diberi **No. 1, 2, 3, ...** berdasarkan urutan hasil filter aktif; penomoran berlanjut pada halaman berikutnya. Nomor bersifat tampilan, bukan ID permanen di database.
- Filter status watermark: Semua / Belum diverifikasi / Berwatermark / Tanpa watermark.
- Admin dapat memilih foto yang belum diverifikasi **pada halaman aktif**, maksimal 12 foto per sesi. Hanya foto **Buku Tamu** dan **Laporan Kejadian** yang mengikuti mekanisme review visual R37.
- Satu dialog berisi navigasi foto berikutnya/sebelumnya; Admin perlu memeriksa foto utuh lalu memilih hasil **per foto**. Setelah semua diberi keputusan, Admin mengonfirmasi dan menyimpan seluruh keputusan.
- Penyimpanan dilakukan **berurutan** per foto, menggunakan layanan Firebase dan audit R37. Hal ini menghindari saling menimpa review pada beberapa foto dari satu laporan kejadian. Untuk operasi massal, server juga memeriksa apakah foto sudah diverifikasi oleh admin lain dan menolak penggantian tanpa sengaja. Kegagalan parsial dilaporkan, tanpa mengklaim semua foto berhasil.
- Pemilihan untuk PDF tetap tersedia; verifikasi massal memakai hanya foto yang terpilih dan memenuhi syarat pada halaman aktif.

## File pembaruan
- `src/features/reports/ReportsPreview.tsx`
- `src/utils/photoRecapOrdering.ts`
- `src/services/firebase/photoWatermarkReviewService.ts`
- `scripts/verify_photo_bulk_review_r38.cjs`
- `docs/CHANGELOG_REKAP_FOTO_MASSAL_R38.md`

## Verifikasi
`node scripts/verify_photo_bulk_review_r38.cjs`

## Catatan penting
- Verifikasi bersifat **visual manual**, bukan deteksi otomatis isi gambar atau uji keaslian foto.
- Hanya Admin berwenang menyimpan review dan penguncian data tetap melalui pemeriksaan service Firebase yang sudah ada.
- Tidak mengubah file foto dan tidak memerlukan perubahan koleksi/Firestore Rules dibanding R37.
- Nomor urut dapat berubah jika filter atau pengurutan diganti atau data baru masuk dari realtime.
- Build/lint dan uji di perangkat nyata tetap harus dilakukan sebelum penggunaan produksi; pengujian source tidak menggantikan uji integrasi Firebase.
