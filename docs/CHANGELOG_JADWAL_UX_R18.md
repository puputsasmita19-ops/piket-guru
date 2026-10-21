# Piket Guru R18 — Dialog ergonomis, foto profil seragam, panduan aksi

Tanggal: 21 Oktober 2026

## Perubahan aplikasi

1. **Dialog Guru Piket Berhalangan Mendadak** (`src/features/attendance/DutyCoverageDialog.tsx`)
   - Ringkasan jadwal asli, alasan, pemilihan pengganti, dan ringkasan dampak dibuat lebih mudah dibaca.
   - Jika belum memilih pengganti, admin mendapat penjelasan bahwa status menjadi Menunggu Pengganti.
   - Pemulihan jadwal asli memakai konfirmasi dalam dialog, bukan dialog browser.
   - Tombol aksi ditata vertikal pada mobile dan horizontal pada desktop.
   - Validasi alasan (10–500 karakter), daftar pencarian guru, pembatasan role, transaksi & audit server tetap digunakan.

2. **Dialog Batalkan Penugasan Piket** (`src/features/schedules/SchedulePreview.tsx`)
   - Perbedaan antara membatalkan **hanya tanggal yang dipilih** dan **seluruh jadwal mingguan** ditegaskan sebelum konfirmasi.
   - Ringkasan dampak berubah sesuai cakupan pembatalan, beserta alasan wajib (10–500 karakter).
   - Tindakan kembali / batalkan ditata ramah sentuhan. Pembatalan hanya dilakukan setelah konfirmasi admin.
   - Tidak mengubah aturan Firestore, transaksi layanan pembatalan, atau jadwal yang sudah tersimpan.

3. **Avatar foto guru seragam dan hemat data**
   - Avatar jadwal Grid dan List sama-sama berukuran 48 × 48 piksel, kotak membulat, objek foto tidak terdistorsi.
   - Foto profil menggunakan komponen `UserAvatar` existing dan cache autentikasi yang sudah ada.
   - Foto hanya diminta saat kartu berada di dekat viewport via `IntersectionObserver`; jika tidak didukung browser, foto tetap dimuat.
   - Jika guru belum memiliki foto profil di Master Pengguna, huruf inisial tetap ditampilkan, bukan foto palsu.

4. **Panduan tombol**
   - Kartu menyediakan `Apa fungsi tombol?` yang bisa dibuka/dilipat di HP tanpa hover.
   - Tombol ikon WA, Edit, dan Hapus mendapat `aria-label` dan `title` yang jelas.
   - Tabel jadwal mempertahankan aksi dan akses yang sama.

5. **Skrip pemeriksaan lama R17 ikut disesuaikan** untuk mendukung wrapper avatar baru tanpa mengubah perilaku fitur.

## File incremental

- `src/features/schedules/SchedulePreview.tsx`
- `src/features/attendance/DutyCoverageDialog.tsx`
- `scripts/verify_schedule_ui_r17.cjs` (penyesuaian pengujian avatar)
- `scripts/verify_schedule_ux_r18.cjs`
- `docs/CHANGELOG_JADWAL_UX_R18.md`

## Hasil pengujian lingkungan kerja

- `node scripts/verify_schedule_ux_r18.cjs`: 21 dari 21 pemeriksaan lulus.
- `node scripts/verify_build_exports_r16_2.cjs`: 405 file / 2995 impor lokal bernama/default diperiksa, tanpa impor atau ekspor yang hilang; 13 asersi status/pembatalan lulus.
- Regresi: R14 20/20, R15 16/16, R16 10/10, R17 lulus.
- `npm ci --offline`: **gagal** (paket npm `yargs-parser` tidak tersedia pada cache lokal).
- `npm run lint`: **belum bisa dinyatakan lulus** (dependensi dan tipe eksternal belum terpasang, termasuk jspdf/vite).
- `npm run build`: **belum bisa dinyatakan lulus** (`vite` tidak ditemukan karena dependensi belum terpasang).
- Tidak ada uji manual mobile/browser produksi pada lingkungan ini.

## Cara memasang

1. Cadangkan perubahan repository lokal yang belum di-commit.
2. Salin isi ZIP ke root repository Piket Guru (tidak menghapus `.git` atau file `.env`).
3. Pada komputer yang terhubung internet, jalankan:
   ```bash
   npm ci
   node scripts/verify_schedule_ux_r18.cjs
   node scripts/verify_schedule_ui_r17.cjs
   npm run lint
   npm run build
   ```
4. Setelah pemeriksaan berhasil, lakukan commit/push ke GitHub Desktop dan pastikan Vercel berstatus Ready.
5. Uji menggunakan akun admin dan data percobaan: Berhalangan dengan/ tanpa pengganti; Batalkan satu hari; Batalkan mingguan; pulihkan; cek foto profil pada mobile/desktop.
