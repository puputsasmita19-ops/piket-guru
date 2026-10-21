# Piket Guru — Perbaikan Build R16.2

Tanggal: 21 Oktober 2026

## Masalah pada Vercel
Vercel menghasilkan `MISSING_EXPORT` untuk fungsi `dutyCancellationId` dan `getOperationalScheduleStatus` saat bundling `SchedulePreview.tsx` dan service pembatalan. File `scheduleUtils.ts` yang digunakan sebelumnya masih versi R14 sehingga tidak membawa semua fungsi yang dipakai R16.

## Yang diperbaiki
- `src/utils/scheduleUtils.ts`
  - Menambahkan ekspor `dutyCancellationId`, `getDutyCancellationForDate`, dan `getOperationalScheduleStatus`.
  - Status `TERJADWAL`, `BERJALAN`, `SELESAI`, `DIGANTIKAN`, `MENUNGGU_PENGGANTI`, `DIBATALKAN` dihitung berdasarkan presensi dan pengecualian yang ada, tanpa menimpa jadwal mingguan.
  - Pembatalan untuk satu tanggal mengeluarkan petugas dari daftar aktif pada tanggal tersebut, tetapi tidak pada minggu berikutnya.
- `src/types/index.ts`
  - Menambahkan field opsional `cancelForScheduleId` dan `cancellationReason` untuk penanda pembatalan harian.
- `scripts/verify_build_exports_r16_2.cjs`
  - Verifikasi baru mengecek **nama ekspor** di semua impor relatif TypeScript/JavaScript, bukan hanya keberadaan file.
  - Ditambah 13 skenario pengujian status & pembatalan/penggantian harian.

## Pemeriksaan pada source gabungan sampai R16.1
- 405 file TypeScript/JavaScript diperiksa.
- 2.994 impor relatif default/bernama diperiksa, tidak ditemukan impor tanpa ekspor.
- 13 pengujian skenario status/pembatalan berhasil.
- Pemeriksaan terarah R16 (10) dan R14 (20) juga berhasil.

Build lengkap tidak dapat dituntaskan di lingkungan kerja ini karena pemasangan dependensi NPM tidak berhasil. **Status deployment Vercel masih harus diverifikasi setelah push.**

## Cara penerapan
1. Ekstrak isi ZIP tepat di akar repository GitHub lokal `piket-guru` (bukan folder bersarang).
2. Periksa di GitHub Desktop bahwa `src/utils/scheduleUtils.ts` dan `src/types/index.ts` berubah, serta file verifikasi/dokumentasi ditambahkan.
3. Commit `Fix missing schedule exports R16.2` lalu Push origin.
4. Buka Vercel → Deployments → pastikan status **Ready**.
5. Setelah berhasil deploy, coba status jadwal dan pembatalan satu hari dengan akun uji.

Opsional pemeriksaan di terminal (setelah `npm ci`):

```bash
node scripts/verify_build_exports_r16_2.cjs
npm run lint
npm run build
```

**Tidak perlu mengubah Firebase Rules, menghapus data, atau memasang ulang R14–R16.1.**
