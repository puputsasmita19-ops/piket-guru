# Piket Guru R37 — Riwayat Buku Tamu dan verifikasi watermark foto

## Perbaikan
1. Tampilan **Daftar Buku Tamu (mode list)** menggunakan kolom yang proporsional, nomor badge dan nama dipisah secara vertikal, teks instansi dapat membungkus, kolom waktu jelas, serta area aksi dapat membungkus. Tabel tetap bisa digulir secara horizontal pada layar sempit.
2. **Rekap Foto** tidak lagi menyimpulkan foto *non-watermark* hanya karena URL Drive tidak memiliki penanda. Metadata lama yang tidak diketahui ditampilkan sebagai **Status watermark belum diverifikasi**.
3. Admin dapat melihat foto utuh, memilih **Watermark terlihat** atau **Tanpa watermark**, mencentang konfirmasi pemeriksaan visual, kemudian menekan **Simpan Status Watermark**. Hasilnya dicatat pada dokumen `visitors` atau `incidents` yang sudah ada dan diaudit.
4. Verifikasi ditautkan pada fingerprint ringkas URL foto yang diperiksa (tanpa menggandakan data Base64) dan, untuk insiden dengan beberapa foto, pada indeks foto masing-masing. Jika file berubah, status review lama tidak otomatis melekat pada file baru.
5. Mode foto `WATERMARK` / `ORIGINAL` pada Buku Tamu R34 tetap dipakai sebagai bukti mode pengambilan. Hasil pemeriksaan visual Admin diberi prioritas jika memang berbeda.

## Cara memverifikasi foto contoh
- Buka **Laporan & Rekap → Rekap Foto → foto Buku Tamu / Laporan Kejadian**.
- Periksa seluruh gambar, terutama panel watermark pada bagian bawah.
- Sebagai Admin, tentukan pilihan hasil verifikasi, centang bahwa pemeriksaan visual sudah dilakukan, lalu simpan.
- Setelah berhasil, label berubah menjadi **Berwatermark** atau **Tanpa watermark**. Sistem menyimpan nama dan waktu Admin yang memeriksa.

> Verifikasi ini hanya memastikan keberadaan watermark secara visual, **bukan** menyatakan gambar asli atau belum dimanipulasi.

## Isi patch
- `src/features/visitors/VisitorPreview.tsx`
- `src/features/reports/ReportsPreview.tsx`
- `src/services/firebase/photoWatermarkReviewService.ts` (baru)
- `src/utils/photoWatermarkStatus.ts` (baru)
- `src/types/watermark.types.ts`
- `src/types/visitor.types.ts`
- `src/types/incident.types.ts`
- `scripts/verify_visitors_watermark_r37.cjs`
- `docs/CHANGELOG_R37_BUKU_TAMU_WATERMARK.md`

## Pemeriksaan
`node scripts/verify_visitors_watermark_r37.cjs` setelah dependensi dipasang.

Lint dan build produksi masih harus diuji pada repository lokal atau Vercel. Tidak diperlukan perubahan Firestore Rules untuk Admin yang sudah diperbolehkan memperbarui `visitors` dan `incidents` pada R32. Foto asli tidak diubah, dan migrasi foto Google Drive R35 tetap tersedia.
