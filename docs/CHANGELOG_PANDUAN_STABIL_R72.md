# Piket Guru R72 — Stabilisasi Panduan Interaktif (Desktop, Tablet, Mobile)

Tanggal: 24 Oktober 2026.

## Masalah yang diperbaiki
Screenshot pengguna memperlihatkan panduan langkah **2 (Pengaturan GPS)** dan **3 (Manajemen Pengguna)** menggeser area halaman saat berpindah langkah. Label `Bagian yang dimaksud` juga muncul di pojok atas layar tanpa posisi yang benar.

## Temuan konkret pada source R70/R71
1. `InteractiveGuideTour.tsx` mengukur `cardRef.current?.offsetHeight` dan menggunakannya untuk menghitung ulang posisi kartu. Teks tambahan yang tampil/hilang ketika target berhasil disorot mengubah tinggi kartu, memicu pengukuran ulang dan potensi *feedback loop* posisi.
2. `element.scrollIntoView` dapat menggulir beberapa ancestor sekaligus (misalnya main content, tab, dan dokumen) pada saat tab panduan berpindah.
3. Saat tab belum selesai berpindah, efek sudah mulai mengukur target pada halaman sebelumnya.
4. CSS `.guide-target-flag` belum ada sehingga label lokasi sorot tidak terposisikan.
5. Animasi masuk `.guide-card` menggunakan `translate`, terlihat sebagai perpindahan posisi kecil setiap mount (dinonaktifkan khusus tur terpandu).
6. Skrip regresi R24/R25 masih mengharuskan pola animasi/scroll lama dan diperbarui agar sesuai perilaku baru.

## Perubahan
- `src/components/guide/InteractiveGuideTour.tsx`: posisi berdasarkan anggaran tinggi stabil menurut viewport; mencegah pengukuran tab lama, scroll **sekali** hanya pada ancestor terdekat yang dapat digulir; menjaga tahapan Admin/Guru, kontrol keyboard, tombol Kembali/Lanjut, dan semua selector fitur.
- `src/components/guide/guidePositioning.ts`: helper pure `getGuideCardBudget` dan `getGuideScrollDelta`; penyesuaian sorot navigasi bawah pada tablet berlebar <1024 px.
- `src/index.css`: label sorot berposisi fixed, footer tetap terjangkau saat uraian panjang, dan gerak masuk kartu panduan dinonaktifkan (area UI lain tetap normal).
- `scripts/test_r72_guide_stability.cjs`: uji khusus R72.
- `scripts/verify_guide_spotlight_r24.cjs` & `scripts/verify_guide_targets_r25.cjs`: memperbarui ekspektasi regresi lama ke perilaku stabil tanpa animasi/scrollIntoView.

## Hasil verifikasi pada source yang tersedia
- R72 panduan: **19 pemeriksaan lulus** (geometri, scroll, parsing TS/TSX, navigasi, handler).
- Regresi R24 diperbarui: **16/16**; R25 diperbarui: **7/7**.
- Regresi R26 onboarding: **20/20**, R69 welcome: **20/20**.
- Chromium sintetik: **8/8 viewport** (320×650, 360×740, 390×850, 430×780, 768×800, 920×720, 1280×900, 1440×768) tidak mengalami pergeseran top/left saat teks bertambah; tanpa overflow horizontal. Ini **bukan** uji end-to-end di aplikasi/akun produksi.
- TypeScript `guidePositioning.ts` dan CSS parsing: **lulus**.
- `npm run lint` dan `npm run build`: **belum lulus** di lingkungan pembuat patch karena dependensi NPM belum tersedia (`vite` tidak ditemukan). Ini bukan verifikasi build pada komputer pengguna.

## Pemasangan
1. Basis: repository Piket Guru yang sudah menerapkan **R71**. Simpan checkpoint Git terlebih dahulu.
2. Ekstrak ZIP R72 ke root repository, timpa **hanya file dengan path sama**.
3. Di GitHub Desktop, pastikan 3 file UI berikut muncul sebagai Modified: `src/components/guide/InteractiveGuideTour.tsx`, `src/components/guide/guidePositioning.ts`, dan `src/index.css`. Skrip dan changelog juga ikut berubah/baru.
4. Jalankan:
```
npm ci
node scripts/test_r72_guide_stability.cjs
node scripts/verify_guide_spotlight_r24.cjs
node scripts/verify_guide_targets_r25.cjs
node scripts/verify_guide_onboarding_r26.cjs
node scripts/verify_guide_welcome_r69.cjs
npm run lint
npm run build
```
5. Jika semuanya lulus, Commit lalu Push origin, periksa Vercel Ready, dan uji Panduan Lengkap langkah 1–6 Admin dengan **Kembali/Lanjut berkali-kali**, serta panduan Guru langkah 1–6 dan Panduan Cepat. Amati stabilitas halaman desktop dan HP.
6. Jika ada kegagalan, **jangan push**; kirim keluaran error lint/build atau screenshot.

## Ruang lingkup
Tidak ada perubahan ke Firebase, backend, data sekolah, konfigurasi presensi, GPS, akun, atau hak akses. Perubahan hanya menyasar mekanisme visual Panduan Penggunaan dan pengujiannya. Jika masih bergoyang di perangkat nyata, dibutuhkan rekaman layar dan kode aktual R71 untuk melihat apakah komponen lain menggulir halaman setelah navigasi.
