# Perbaikan Peringatan Update Piket Guru – GitHub + Vercel

## Akar masalah

`AppUpdateBanner` masih dipanggil oleh `src/components/layout/Layout.tsx`, tetapi sebelumnya
`public/sw.js` memakai cache version statis (`v1.4.53`). Penggantian berkas
React/CSS di Vercel tanpa perubahan *byte* `sw.js` tidak menjamin update
service worker, sehingga tidak ada worker `waiting` yang dapat memicu banner.
Refresh yang sudah mengambil versi baru juga tidak memerlukan peringatan.

## Perbaikan

1. `npm run build` kini menjalankan `vite build`, lalu `scripts/stamp_pwa_release.mjs`.
   Script membangkitkan ID unik per deployment (Vercel deployment ID/URL, SHA,
   atau fallback timestamp) dan menulisnya ke **dist/sw.js** saja, sehingga tidak
   mengotori source yang dikelola GitHub Desktop.
2. Browser mengecek `registration.update()` sesudah siap, setiap tab difokuskan
   kembali, ketika koneksi online, saat menjadi visible, dan setiap 15 menit.
3. Banner muncul hanya saat service worker baru telah `installed` dan menunggu,
   **bukan** saat first install atau sudah memakai versi terbaru.
4. Tombol **Perbarui Sekarang** mengirim `SKIP_WAITING`; refresh baru dilakukan
   ketika user menekan tombol dan `controllerchange` terjadi.
5. Cache-Control `/sw.js` dan `/app-version.json` diatur `no-store` di Vercel.
6. Render mobile/desktop dan alur Firebase, realtime, RBAC tidak disentuh.

## Hasil pengujian saat paket dibuat

- `node --experimental-strip-types scripts/verify_pwa_updates.mjs`: **PASS** (15 checks).
- `tsc --noEmit --target ES2022 --lib ES2022,DOM --skipLibCheck --module ESNext --moduleResolution bundler src/services/offline/appUpdateManager.ts`: **PASS**.
- `node --check` pada `public/sw.js`, `stamp_pwa_release.mjs`, `verify_pwa_updates.mjs`: **PASS**.
- Integrasi source (banner di layout, teks update, registration in index.html): **PASS**.
- `npm run lint`: **BELUM LULUS** di lingkungan ini; library React/Firebase/@types
  tidak tersedia sehingga TypeScript gagal menyelesaikan dependensi.
- `npm run build`: **BELUM LULUS** di lingkungan ini; executable `vite` tidak
  terpasang. Tidak ada klaim produksi sudah siap sebelum Vercel build berhasil.

## Langkah deploy

1. Salin source pembaruan ke folder lokal repository Piket Guru (jangan hapus `.git` atau `.env`).
2. Di GitHub Desktop: review changes, commit, **Push origin**.
3. Vercel otomatis menjalankan `npm run build` sesuai `vercel.json`.
4. Pastikan Vercel -> Deployments -> **Ready**. Jika build gagal, baca logs.
5. Jika ingin simulasi update: buka Piket Guru di tab A sebelum perubahan
   berikutnya di-deploy; setelah ada deployment baru, fokus kembali ke tab A
   dan tunggu banner muncul. Uji tombol perbarui setelah menyimpan input.
6. Setelah browser memakai versi terbaru, banner seharusnya **hilang**: ini benar.
7. Versi yang ter-deploy dapat diperiksa melalui `/app-version.json`.

**Catatan:** Karena konfigurasi SW versi lama belum distamp, deployment perbaikan
ini dapat membutuhkan satu kali refresh agar SW terbaru didaftarkan. Jangan
menghapus seluruh cache/storage browser karena ada data offline pengguna.
