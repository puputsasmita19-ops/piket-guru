# Piket Guru R75 — UI/UX Refinement & Safe Update Dialog

Tanggal: 24 Oktober 2026. Dasar kerja: ZIP source `piket-guru-main.zip` dengan lapisan pembaruan R68–R74 yang tersedia dalam percakapan; **jangan** menganggap build produksi sama sebelum membandingkan di GitHub Desktop.

## Perubahan aplikasi

1. `src/services/offline/pwaUpdateSafety.ts`:
   - Hapus pemanggilan `window.confirm`.
   - `ensurePwaUpdateSafe(confirmPending?)` mengharuskan persetujuan asinkron pada perangkat tepercaya jika terdapat antrean/draf; tanpa callback **ditolak**.
   - Tetap memeriksa editor aktif, `DraftService.flushPending`, kepemilikan akun, antrean `SENDING`, jenis perangkat, dan storage error (fail closed).
   - Validasi ulang setelah user menyetujui: ID akun, `flushPending`, status antrean, perangkat tepercaya, jumlah draf/kiriman **dan identitas item antrean**. Perubahan pada salah satunya akan menahan update.
   - Pembatalan eksplisit memakai `PwaUpdateCancelledError`, tidak ditampilkan sebagai kesalahan aplikasi.
2. `src/components/layout/AppUpdateBanner.tsx`:
   - Konfirmasi berbasis `Modal` yang sudah digunakan aplikasi (focus trap, Escape, body scroll lock).
   - Judul **Data Belum Selesai Dikirim**, ikon peringatan outline, hanya jumlah data > 0; tombol **Perbarui Sekarang** dan **Nanti Saja**.
   - Ref untuk antiketukan ganda, bersihkan promise saat unmount, tampilkan tahap pemeriksaan/update dengan jelas.
   - Tidak menambah retry atau memanipulasi antrean offline.
3. `src/features/dashboard/{DashboardWelcome.tsx,WelcomeSentence.tsx}`, `src/index.css`:
   - Tombol Pause dipindahkan dari kiri teks sambutan ke posisi kanan atas dalam **grid tersendiri**, tidak bertabrakan dengan avatar.
   - Waktu rotasi pesan dan pause state tetap di komponen `WelcomeSentence`; tidak menambah timer, tetap menghormati reduced-motion.
   - Ukuran tombol minimal 40px desktop, 44px mobile. Teks sapaan tetap sejajar kiri.
4. `src/features/dashboard/DashboardView.tsx`, `src/dashboard-compact-r46.css`:
   - Ikon empat kotak `Kegiatan sekolah, lebih praktis` diganti SVG outline 1.55px (24px desktop, 22px mobile). Warna tema dan latar cyan dipertahankan.
   - Kontrol Flash Info R73 tidak dimodifikasi.

## Validasi lokal

- Gate safety R75: **18/18 skenario PASS**, memakai mock storage/auth dan TypeScript transpilation.
- Pemeriksaan struktur UI R75: **26/26 PASS**.
- Regresi R57: **16/16 PASS** (verifikasi struktur), tes legacy R57 diarahkan ke gate R75 aktif.
- Regresi kontrol Dashboard R73: **22/22 PASS** (assert penempatan baru sesuai R75).
- Regresi hak akses R74: **20/20 PASS**.
- Chromium fixture dengan CSS sumber: 320, 360, 390, 430, 768, 1280 piksel × light/dark **12/12 PASS**: tidak overflow dan kontrol tidak menabrak avatar. Ini simulasi geometri, **bukan** pengujian visual aplikasi production yang telah dibundel.
- `tinycss2` parser: 0 top-level error pada kedua berkas CSS yang dimodifikasi.
- `npm ci --offline`: **BLOCKED** karena cache `yargs-parser@21.1.1` tidak tersedia.
- `npm run lint`: **BELUM PASS** karena dependensi/type declarations belum lengkap dalam lingkungan yang digunakan.
- `npm run build`: **BELUM PASS** (`vite: not found`).

## Cara memasang

1. Pastikan repository lokal berisi pembaruan **R74**; buat checkpoint (commit/backup) terlebih dahulu.
2. Ekstrak ZIP incremental R75 ke root repository, timpa hanya berkas sesuai path.
3. Buka GitHub Desktop → Changes dan periksa semua diff. Jangan salin berkas source lama selain berkas ZIP.
4. Di komputer dengan koneksi NPM memadai, jalankan:

```bash
npm ci
node scripts/test_r75_pwa_gate.cjs
node scripts/verify_ui_r75.cjs
node scripts/verify_r57_offline_pwa.cjs
node scripts/verify_dashboard_controls_r73.cjs
node scripts/verify_bulk_permissions_r74.cjs
npm run lint
npm run build
```

5. Apabila semuanya berhasil, Commit dan Push secara manual (tidak dilakukan dari ChatGPT).
6. Setelah deployment Vercel Ready, tes pada browser pribadi **dan** perangkat bersama tanpa menggunakan catatan produksi penting: pilih Nanti Saja, pilih Perbarui Sekarang, lihat antrean 0/1, coba editor aktif, coba nama panjang dan Flash Info desktop/HP.
7. Draf tidak boleh hilang. Jangan bersihkan storage situs untuk uji tanpa memastikan data penting telah terkirim.

## Batas keamanan & kompatibilitas

- Tidak mengubah API Firebase, Firestore Rules, `appUpdateManager`, `DraftService`, `OfflineStorage`, atau data Google Drive.
- Tombol Perbarui Sekarang *tidak* menjamin sinkronisasi draf selesai; pengguna tetap harus menyelesaikan data penting.
- Aspek keamanan disimulasikan, belum diverifikasi memakai Firebase Emulator atau data produksi. Pastikan build benar-benar lulus sebelum deployment.
