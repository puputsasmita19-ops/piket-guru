# Piket Guru R53 — Tombol Pembaruan Responsif (24 Oktober 2026)

## Tujuan
Menghilangkan jeda tanpa respons ketika menekan tombol **Perbarui** di desktop/HP. Perubahan bersifat UI dan alur aktivasi service worker; tidak mengubah Firebase, data pengguna, aturan akses, atau penyimpanan draft offline.

## Perubahan
1. `src/components/layout/AppUpdateBanner.tsx`
   - Tampilkan status **Mengaktifkan…** segera setelah diklik, lalu **Memeriksa…** jika diperlukan dan **Memuat versi baru…** saat siap.
   - Ringkas tampilan mobile: "Update tersedia" dan tombol "Perbarui". Desktop memakai teks yang lebih lengkap.
   - Pengaman ketukan berulang dengan ref, tombol dinonaktifkan saat proses berlangsung, status accessible via `aria-live` dan `aria-busy`.
   - Status proses tetap tampil sampai navigasi versi baru berlangsung; pesan kesalahan dipertahankan saat gagal.
2. `src/services/offline/appUpdateManager.ts`
   - Prioritaskan service worker yang sudah `waiting` dan tersimpan saat banner muncul; kirim `SKIP_WAITING` tanpa `registration.update()` atau permintaan jaringan baru saat tombol ditekan.
   - Jika worker lama sudah aktif/berubah, batasi pemeriksaan registrasi hingga 1,2 detik, kemudian lakukan navigasi network-first dengan cache-busting tanpa menghapus cache/data secara paksa.
   - Pantau `controllerchange`/`activated`, cegah reload ganda, dan beri error bila aktivasi tidak berhasil dalam 10 detik.

## Batasan keamanan data
- Tombol update tetap **memerlukan tindakan eksplisit** pengguna untuk memuat ulang halaman.
- **Perubahan formulir yang belum disimpan dapat hilang akibat reload manual**. Sebaiknya selesaikan pengisian formulir atau kirim dahulu antrean offline sebelum menekan Perbarui.
- R53 **tidak** menghapus `localStorage`, `IndexedDB`, Firestore, Cache Storage, maupun aturan aplikasi. Mekanisme service worker lama tetap berlaku.
- Perbaikan mempercepat *feedback dan jalur aktivasi*, bukan menjamin internet lebih cepat.

## Hasil pemeriksaan di lingkungan pembuat patch
- `node scripts/verify_fast_update_r53.cjs` — 26 pemeriksaan **lulus** (service worker sintetis, tidak menggunakan production).
- TypeScript `appUpdateManager.ts` secara terisolasi — **lulus**.
- `npm ci --offline` — **gagal** karena paket `yargs-parser@21.1.1` belum tersedia di cache.
- `npm run lint` — **tidak lulus** karena dependensi seperti `firebase`/`@types/node` belum terinstal.
- `npm run build` — **tidak lulus** karena `vite` belum tersedia.
- QA perangkat nyata, Firebase produksi, dan Vercel belum dijalankan.

## Cara instalasi
1. Ekstrak ZIP incremental ke repository lokal Piket Guru yang sudah menggunakan **R52**.
2. Timpa file sesuai struktur folder.
3. Dari root repository dengan dependensi lengkap: `npm ci`, `node scripts/verify_fast_update_r53.cjs`, `npm run lint`, lalu `npm run build`.
4. Commit & Push origin melalui GitHub Desktop dan periksa Vercel berstatus **Ready**.
5. Buka aplikasi di desktop dan HP, tekan **Perbarui** ketika banner terlihat; periksa status tampil seketika dan aplikasi berpindah ke versi baru. Uji saat form **sudah tersimpan**.
