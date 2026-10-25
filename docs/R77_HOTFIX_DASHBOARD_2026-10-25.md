# R77 — Hotfix Dashboard dan Login tidak bisa dibuka setelah R76

## Bug yang direproduksi dari source R76
`src/types/dashboardInfo.types.ts` di R76 mengandung:

```ts
durationSeconds: [8, 12, 16, 20, 28].includes(value?.durationSeconds ?? 16) ? value!.durationSeconds! : 16,
```

Ketika konfigurasi `nameMarquee` belum tersedia (`undefined`/`null`), pemeriksaan array memakai default `16` dan **berhasil**, tetapi cabang `true` tetap melakukan akses `value.durationSeconds`. Hasilnya adalah `TypeError: Cannot read properties of undefined (reading 'durationSeconds')`. Selain itu, nilai berupa objek kosong menghasilkan durasi undefined.

Dashboard memanggil fungsi ini melalui `sanitizeDashboardInfoConfig`; rute login publik juga menggunakannya untuk mengirim pengaturan nama berjalan. Pada instalasi sekolah yang belum menyimpan pengaturan baru R76, fungsi ini berpotensi melempar error saat dibaca.

## Perbaikan
Nilai durasi dibaca sekali dengan optional chaining. Hanya durasi numerik yang termasuk `8,12,16,20,28` yang diterima; selebihnya default `16` tanpa dereferensi objek kosong. Status enabled tetap sesuai pengaturan Admin, default `true`.

## Isi ZIP
- `src/types/dashboardInfo.types.ts` — **satu-satunya file aplikasi yang berubah**.
- `scripts/verify_hotfix_r77.cjs` — uji regresi nilai lama dan baru.
- `docs/R77_HOTFIX_DASHBOARD_2026-10-25.md` — catatan audit.

## Cara deploy paling aman
1. Repo lokal harus telah menerapkan R76. Buat backup/commit checkpoint lebih dulu.
2. Salin ketiga berkas dari ZIP ke root repository; hanya `dashboardInfo.types.ts` yang ditimpa.
3. Jalankan `npm ci` (bila belum terpasang), `node scripts/verify_hotfix_r77.cjs`, `npm run lint`, dan `npm run build`.
4. Bila lint/build berhasil, Commit `R77 fix missing marquee defaults`, Push origin, dan konfirmasi Vercel `Ready` untuk commit yang benar.
5. Login dan buka Dashboard, Pengaturan Sekolah, serta pilih akun pada login; uji pada desktop dan mobile.
6. Jangan hapus data browser/PWA, `localStorage`, atau IndexedDB bila masih ada antrean offline; jika masih menampilkan halaman lama, lakukan reload biasa dan periksa commit Vercel.

## Batas validasi
- Kesalahan `TypeError` direproduksi pada source R76 yang ada di sini.
- Uji regresi pengaturan kosong/legacy dan config eksplisit lulus pada modul hasil transpile TypeScript.
- Full build Vercel/akses Firebase produksi tidak dapat disimulasikan dari lingkungan ini. Jika setelah update ke R77 masih gagal, ambil error dari DevTools Console; bisa jadi ada masalah lain selain bug ini.

## Opsi darurat
Jika sekolah sedang membutuhkan akses segera dan build R77 tidak dapat diselesaikan, pada Vercel gunakan rollback/Promote deployment R75 terakhir yang sudah berfungsi (jika tersedia), bukan memaksa pembaruan R76 yang rusak. Tidak perlu menghapus data Firebase.
