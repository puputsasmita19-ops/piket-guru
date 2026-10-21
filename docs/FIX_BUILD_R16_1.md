# Perbaikan Vercel Build R16.1 — Import Tidak Ditemukan

**Masalah:** Vite gagal membangun aplikasi pada commit R16 karena `SchedulePreview.tsx` mengimpor `../../services/firebase/dutyCancellationService`, tetapi file `src/services/firebase/dutyCancellationService.ts` tidak ikut dikemas dalam ZIP incremental R16. Ini adalah kekurangan pada paket pembaruan, bukan kesalahan konfigurasi Vercel.

## Isi patch
- `src/services/firebase/dutyCancellationService.ts` — service pembatalan jadwal satu hari atau berulang, serta pemulihannya, dengan pemeriksaan admin dan transaksi audit Firestore.
- `scripts/verify_build_imports_r16_1.cjs` — memverifikasi service tersebut dan memeriksa semua import relatif pada source.
- `docs/FIX_BUILD_R16_1.md` — catatan perbaikan ini.

Tidak ada file jadwal atau Firebase Rules lama yang ditimpa. Tidak ada migrasi database.

## Cara penerapan
1. Ekstrak ZIP ke **root repository lokal** `piket-guru` sehingga file service berada tepat di `src/services/firebase/dutyCancellationService.ts`.
2. Commit `Fix missing duty cancellation service R16.1` melalui GitHub Desktop, lalu **Push origin**.
3. Pastikan deployment Vercel terbaru berstatus **Ready**. Jika masih gagal, buka Build Logs deployment terbaru dan kirim teks errornya.
4. Sebagai verifikasi tambahan lokal apabila dependencies tersedia:

   ```bash
   npm ci
   node scripts/verify_build_imports_r16_1.cjs
   npm run lint
   npm run build
   ```

## Pengujian yang sudah dilakukan
- Pemeriksaan sumber R14/R15/R16: 20 + 16 + 10 skenario terarah lulus.
- Pemeriksaan import relatif pada 405 file source gabungan: 0 hilang setelah file service dikembalikan.
- Build/lint penuh tidak dapat diverifikasi dalam lingkungan penyusunan patch karena dependency lokal tidak lengkap (`vite` dan `@types` belum tersedia lengkap). Deployment Vercel merupakan verifikasi akhir.
