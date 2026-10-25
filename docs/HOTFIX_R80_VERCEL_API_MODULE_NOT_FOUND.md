# Piket Guru R80 — Hotfix HTTP 500 API Vercel (Node ESM)

Tanggal: 25 Oktober 2026. Basis: source R79 (R76+hotfix R77+R78+R79) dan error runtime dari screenshot Vercel Logs.

## Penyebab yang terkonfirmasi

Production Runtime Logs untuk `/api/auth/users-summary` dan `/api/auth/public-config` menunjukkan:

```
ERR_MODULE_NOT_FOUND: Cannot find module
'/var/task/src/types/dashboardWelcome.types'
imported from '/var/task/src/types/dashboardInfo.types.js'
```

`src/server/routes/authRoutes.ts` memuat `src/types/dashboardInfo.types.js` di Node ESM. Module tersebut sebelumnya mengimpor `./dashboardWelcome.types` tanpa ekstensi. Pada Node ESM, resolver **tidak otomatis mencoba `.js`** untuk impor relatif yang memakai nama tanpa akhiran. Akibatnya, module API gagal dimuat sebelum penanganan request (bukan masalah PIN atau Firestore Rules).

## Perbaikan minimal

`src/types/dashboardInfo.types.ts`:

```diff
-import { sanitizeDashboardWelcomeConfig, type DashboardWelcomeConfig } from './dashboardWelcome.types';
+import { sanitizeDashboardWelcomeConfig, type DashboardWelcomeConfig } from './dashboardWelcome.types.js';
```

Ekstensi `.js` benar untuk referensi ke hasil keluaran TypeScript saat berjalan sebagai Node ESM, sementara Vite/TS resolver akan memetakannya ke `.ts` ketika membangun frontend. File sumber `src/types/dashboardWelcome.types.ts` **harus tetap ada di repository**.

Dua skrip regresi R77/R78 disesuaikan agar mengharapkan specifier runtime `.js` yang benar (bukan melemahkan validasi fungsi). File pengujian baru memeriksa impor backend dan menjalankan fixture JavaScript nyata melalui Node ESM untuk mereproduksi bug sebelum fix dan memverifikasi fix.

## Pemeriksaan yang dilakukan

- `scripts/verify_server_esm_imports_r80.cjs`: 9/9 lulus, termasuk reproduksi ERR_MODULE_NOT_FOUND pada versi lama dan sukses memuat versi yang sudah diperbaiki.
- `scripts/verify_hotfix_r77.cjs`: 19/19 lulus.
- `scripts/verify_r78_r76_r77_compat.cjs`: 31/31 lulus.
- `scripts/verify_login_name_lookup_r79.cjs`: 27/27 lulus.
- Tidak menjalankan pengujian Firestore/Vercel produksi dan tidak membuat perubahan ke data sekolah.
- `npm ci --offline` gagal karena paket belum tersimpan dalam cache; lint/build lengkap masih harus dijalankan di komputer dengan seluruh dependensi tersedia.

## Cara pasang di repository GitHub

1. Pastikan branch telah menggunakan **R79**; simpan checkpoint commit sebelum menerapkan hotfix.
2. Ekstrak ZIP R80 ke folder root repository dan **timpa** file dengan path yang sama. Hanya satu file aplikasi yang diubah.
3. Dari terminal root repository:

```bash
npm ci
node scripts/verify_server_esm_imports_r80.cjs
node scripts/verify_hotfix_r77.cjs
node scripts/verify_r78_r76_r77_compat.cjs
node scripts/verify_login_name_lookup_r79.cjs
npm run lint
npm run build
```

4. Hanya jika semua tahap lulus, Commit + Push lewat GitHub Desktop; periksa deployment Production Vercel dengan commit R80 dan status Ready.
5. Buka halaman login melalui tab samaran dan cek **Cari Nama**. Pastikan `/api/auth/public-config` dan `/api/auth/users-summary` merespons tanpa HTTP 500. Dalam DevTools Network, status kedua request seharusnya 200 jika backend lain sehat; format/isi dapat berbeda menurut kondisi data sekolah. Jangan bagikan respons yang memuat identitas pengguna ke publik.
6. Bila 500 tetap muncul, buka Vercel Runtime Logs untuk **deployment baru**. Error berikutnya dapat berbeda, jadi jangan menyimpulkan bahwa Firebase pasti bermasalah.

## Hal yang sengaja tidak diubah

PIN, kredensial, database, Firestore Rules, konfigurasi Firebase Admin, Google Drive, otorisasi pengguna, UI login, PWA/cache, dan berkas `dashboardWelcome.types.ts`.

Jika perlu rollback, pilih commit/deployment terakhir yang **terbukti** berfungsi; mengembalikan versi R79 saja akan menghidupkan kembali error Node ESM ini.
