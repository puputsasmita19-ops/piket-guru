# R69 — Perbaikan Tampilan Panduan Awal Setelah Login

## Akar masalah pada source terbaru yang tersedia
Komponen `src/components/guide/GuideWelcomePrompt.tsx` memakai class `guide-welcome-*`, tetapi `src/index.css` belum memiliki style untuk class tersebut. Karena undangan panduan dirender sebelum `<Header />` di `Layout.tsx`, `<aside>` mengikuti alur halaman biasa dan menekan seluruh header ke bawah. Screenshot HP menunjukkan tepat gejala tersebut.

## Perbaikan
1. `src/index.css` — menambahkan style khusus komponen onboarding: floating card fixed di atas bottom navigation HP, tidak menambah tinggi layout, batas lebar/tinggi mengikuti viewport, tampilan desktop kanan bawah, tombol sentuh min. 44px, dark theme dan reduced motion.
2. `src/components/guide/GuideWelcomePrompt.tsx` — penanda `data-ui-version="R69"` dan caption kecil `Panduan R69` untuk memastikan versi baru sudah di-deploy. **Tidak** mengubah handler Lewati, Tutup, Mulai 3 Langkah, atau status sekali-tampil per user.
3. `scripts/verify_guide_welcome_r69.cjs` — regresi khusus onboarding (20 cek).

## Hasil verifikasi lokal
- `node scripts/verify_guide_onboarding_r26.cjs`: 20/20 PASS (dengan TypeScript terpasang).
- `node scripts/verify_guide_welcome_r69.cjs`: 20/20 PASS.
- Parsing stylesheet `src/index.css` (tinycss2): 0 error tingkat stylesheet.
- Chromium menggunakan markup demonstrasi yang menyerupai welcome component + **CSS aktual** proyek: 320×720, 360×780, 390×844, 430×932, 768×1024, 1280×900 semuanya PASS (posisi fixed, header tidak terdorong, kartu dan tombol tidak melewati viewport).
- Tambahan uji viewport 320×480, 667×375 dan 820×390: PASS.
- `npm ci --offline`: belum berhasil (`yargs-parser@21.1.1` tidak ada di cache). `npm run lint` dan `npm run build` perlu dijalankan di repository lokal yang memiliki dependensi lengkap.
- Uji di Android produksi, Firebase, dan Vercel: BELUM DILAKUKAN.

## Cara memasang
1. Source acuan: `piket-guru-main.zip` yang diupload pengguna, dilapisi patch R68. Perubahan R69 kecil dan hanya pada kedua file front-end di atas.
2. Ekstrak ZIP ke root repository `piket-guru` yang telah menerapkan R68. Timpa hanya dua file `src` tersebut, lalu pastikan keduanya terdeteksi `Modified` di GitHub Desktop.
3. Jalankan `npm ci`, `node scripts/verify_guide_welcome_r69.cjs`, `node scripts/verify_guide_onboarding_r26.cjs`, `npm run lint` dan `npm run build`. Jangan push bila gagal.
4. Commit → Push origin → tunggu Vercel Ready.
5. **Panduan bersifat sekali tampil**. Uji di Chrome Incognito/login akun uji yang belum pernah menyelesaikan panduan di profile browser itu. Jangan hapus seluruh data situs karena bisa ada antrean offline. Saat terlihat, cek caption `Panduan R69`.
6. Pastikan tombol Lewati/Tutup menyembunyikan undangan; tombol Mulai 3 Langkah memulai tur tanpa menambah area kosong di atas header.
