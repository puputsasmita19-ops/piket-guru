# Piket Guru R47 — Update PWA & Banner Mobile

**Tanggal:** 24 Oktober 2026

## Masalah
- Banner update terlihat, tetapi tombol **Perbarui Sekarang** dapat tampak tidak bereaksi ketika worker waiting tidak lagi tersedia, worker gagal mengaktifkan diri, atau browser masih memakai cache lama.
- Cache service worker sebelumnya memakai nama versi statis sehingga pembaruan berikutnya tidak dijamin mendeteksi perubahan build.
- Tulisan banner desktop terlalu panjang di mobile.

## Solusi
1. **Tombol pembaruan** kini membaca `registration.waiting` terbaru, mengirim `SKIP_WAITING`, merespons event `controllerchange`/`statechange`, dan menampilkan pesan jika aktivasi gagal/terlalu lama. Jika worker sudah tidak waiting, tombol tetap menavigasi ulang dengan parameter cache-buster sambil mempertahankan hash route.
2. **Pendeteksian pembaruan** memeriksa ulang SW saat tab kembali fokus/terlihat dan kembali online, dibatasi setiap 60 detik agar ringan. Tidak melakukan refresh tanpa klik pengguna.
3. **SW otomatis mengikuti setiap build**: plugin kecil di `vite.config.ts` mengisi token versi pada `dist/sw.js` saat build produksi. Registrasi SW memakai `updateViaCache: 'none'`, dengan pengecualian skrip SW dari cache asset internal.
4. **Banner mobile**: teks `Update tersedia`, tombol `Perbarui`; desktop `Update Piket Guru tersedia`, tombol `Perbarui sekarang`. Ada keadaan `Memuat…` dan pesan kesalahan singkat. Tombol dibuat ramah sentuh.
5. Tidak ada perubahan Firestore, antrean offline, login, hak akses, atau presensi. Tidak ada penghapusan localStorage, IndexedDB, atau CacheStorage secara massal. Cache aplikasi versi lama tetap ditangani secara selektif oleh SW saat aktivasi.

## Pemasangan
Salin file dari ZIP ke akar repository **R46 yang sudah dipasang** sesuai path. Lakukan Commit dan Push origin melalui GitHub Desktop. Pastikan deployment Vercel **Ready**. Setelah itu **buka ulang** situs, tunggu banner update apabila ada worker yang menunggu, klik tombol, dan periksa versi halaman baru.

## Pengujian
- `node scripts/verify_app_update_r47.cjs`: **PASS** — sintaks TS/TSX, build stamp, SW valid, 4 skenario update (menunggu/tiada worker/offline/gagal kirim).
- `npm ci --offline`: **GAGAL / ENVIRONMENT BLOCKED** — berkas NPM `yargs-parser@21.1.1` belum ada di cache.
- `npm run lint`: **BELUM LULUS** — dependensi TypeScript proyek belum terpasang; error modul seperti `firebase`, `vite`, `@types/node`.
- `npm run build`: **BELUM LULUS** — `vite: not found` akibat instalasi dependensi tidak selesai.
- Pengujian PWA pada Vercel serta perangkat produksi **belum dijalankan**. SW membutuhkan HTTPS dan browser yang mendukung service worker.

## Cara memverifikasi di komputer dengan internet
```sh
npm ci
node scripts/verify_app_update_r47.cjs
npm run lint
npm run build
```
Periksa `dist/sw.js` berisi versi deployment nyata, bukan `__PIKET_BUILD_REV__`. Uji tombol update pada desktop dan HP, serta pastikan formulir dengan perubahan belum disimpan memberikan peringatan sebelum navigasi saat mekanisme proteksi draft aktif.

## File patch
- `index.html`
- `vite.config.ts`
- `public/sw.js`
- `src/services/offline/appUpdateManager.ts`
- `src/components/layout/AppUpdateBanner.tsx`
- `scripts/verify_app_update_r47.cjs`
- `docs/CHANGELOG_UPDATE_PWA_R47.md`
