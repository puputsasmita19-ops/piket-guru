# Piket Guru R73 — Kontrol Dashboard Lebih Minimalis

Tanggal: 24 Oktober 2026 (WIB)

## Dasar perbaikan

Source: **R72 terbaru yang tersedia**. Dua target sesuai screenshot:
- Kalimat sambutan di Dashboard (`WelcomeSentence.tsx`): tombol Pause sebelumnya terpisah di ujung kanan dekat avatar, terlihat menggantung.
- Flash Info (`DashboardFlashInfo.tsx`): panah dan Pause/Play memakai ikon Phosphor *filled*, sehingga tampak tebal meskipun ukuran SVG dikurangi.

## Perubahan

1. Memindahkan tombol jeda/lanjut **kalimat sambutan** ke sisi awal kalimat di dalam area teks, sehingga tidak mengambang dekat avatar. Status jeda, rotasi interval, dan animasi tetap sama. Efek `ResizeObserver` yang hanya mengatur posisi lama dihapus.
2. Mengganti ikon panah dan Pause/Play Flash Info menggunakan SVG `stroke` asli dengan ketebalan **1.65**, bukan SVG terisi penuh.
3. Mengelompokkan 3 tombol Flash Info dalam satu kapsul/pill tipis. **Desktop:** kanan bawah kartu. **Mobile (<640px):** tengah bawah kartu, di bawah tautan rincian.
4. Mempertahankan `change(-1)`, `togglePlayback`, `change(1)`, geser/swipe, autoplay, reduced-motion, indikator halaman, dan aksi buka rincian.
5. Target sentuh Flash Info desktop 36px dan mobile 40px, dengan nama aksesibel dan fokus keyboard. Tombol sambutan mobile 38px.
6. Tidak mengubah Firebase, Firestore, service worker, data presensi, hak akses, atau pengaturan aplikasi.

## Isi ZIP (incremental)

- `src/features/dashboard/DashboardFlashInfo.tsx` (diubah)
- `src/features/dashboard/WelcomeSentence.tsx` (diubah)
- `src/features/dashboard/DashboardOutlineControlIcon.tsx` (baru)
- `src/index.css` (diubah)
- `scripts/verify_dashboard_controls_r73.cjs` (baru)
- `docs/CHANGELOG_KONTROL_DASHBOARD_R73.md` (baru)

## Hasil pengujian

- `NODE_PATH=$(npm root -g) node scripts/verify_dashboard_controls_r73.cjs`: **22/22 pemeriksaan lulus** dalam lingkungan audit; setelah `npm ci`, jalankan `node scripts/verify_dashboard_controls_r73.cjs` tanpa pengaturan tambahan.
- TSX masing-masing komponen: tidak ada kesalahan parser TypeScript.
- `tinycss2` stylesheet: **0 parse error top-level**.
- Chromium layout mock: **6/6 viewport lulus** (320, 360, 390, 430, 768, 1280 px). Tidak ditemukan overflow horizontal pada markup simulasi, kontrol berada di sisi yang direncanakan. **Bukan pengujian PWA produksi.**
- `npm ci --offline`: **gagal** karena `yargs-parser@21.1.1` tidak tersedia dalam cache; `npm run lint` dan `npm run build` penuh belum dapat diverifikasi.

## Cara memasang

1. Basis: repository `piket-guru` yang sudah menggunakan R72 (atau source berikutnya tanpa perubahan custom pada kedua komponen dashboard dan index.css). **Buat checkpoint/commit terlebih dahulu.**
2. Ekstrak ZIP ke root repository sehingga seluruh file mengikuti jalur `src/`, `scripts/`, `docs/` seperti aslinya. Jangan salin folder berlapis yang menyebabkan file tidak berubah.
3. Pastikan GitHub Desktop **Changes** menunjukkan perubahan `DashboardFlashInfo.tsx`, `WelcomeSentence.tsx`, `index.css`, serta `DashboardOutlineControlIcon.tsx` (file baru).
4. Jalankan di terminal (internet diperlukan untuk `npm ci`):

```bat
npm ci
node scripts/verify_dashboard_controls_r73.cjs
npm run lint
npm run build
```

5. Hanya Commit → Push origin jika pemeriksaan lulus; tunggu Vercel **Ready**.
6. Uji mobile dan desktop: rotasi kalimat sambutan, jeda/lanjut, panah kiri/kanan Flash Info, pause, swipe, dan tombol `Buka rincian`. Pastikan tombol terlihat tipis, tidak menutupi avatar atau konten kartu. Jangan membersihkan data situs/IndexedDB jika ada antrean offline.

Jika GitHub Desktop tidak menampilkan file-file utama sebagai berubah, patch belum dipasang ke folder repository yang benar. Jangan push sebelum cocok.
