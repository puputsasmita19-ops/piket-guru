# Piket Guru R84 — Toggle Dua Mode Pencarian Login

Tanggal: 25 Oktober 2026. Basis: `src/features/auth/LoginPage.tsx` dari R83.

## Masalah R83

Tombol tunggal `Nama ⇄ ID/NIP` hanya menampilkan mode yang sedang aktif. Sebagian pengguna tidak langsung mengetahui bahwa tombol tersebut dapat mengganti metode. Ikon panah ganti dan label yang berubah juga menambah beban visual pada HP.

## Perbaikan R84

Di dalam satu border input terdapat **dua pilihan yang terlihat bersamaan**:

- `Nama` (ikon Search), `aria-pressed={!isManualInput}`.
- `ID/NIP` (ikon KeyRound), `aria-pressed={isManualInput}`.

Salah satu pilihan aktif dengan background lembut dan border tipis, sehingga statusnya jelas. Keduanya bisa diketuk langsung tanpa perlu melakukan siklus toggle. Tinggi area sentuh masing-masing minimal 44px mobile dan 40px desktop. Lebar masing-masing ~60/70px di HP, ~64/74px di desktop. Kolom input menyesuaikan sisa ruang dan `min-w-0` mencegah overflow.

- Mempertahankan satu baris tanpa heading tambahan `Metode masuk`.
- Pilihan aktif diulang tidak mengosongkan input/PIN tanpa alasan.
- Peralihan dari ID manual yang belum terverifikasi ke Nama tetap mengosongkan ID/PIN tersembunyi untuk mencegah salah identitas.
- PIN, login Google Admin, akun terpilih dan foto, marquee nama, pencarian dropdown, respons status/verifikasi API, tombol Coba Lagi dan trusted device tetap sebagaimana R83.
- Tidak ada perubahan backend Node ESM, Firebase, Firestore Rules, data sekolah, autentikasi, penyimpanan offline, atau PWA.

## File ZIP

- `src/features/auth/LoginPage.tsx` **Modified** — satu-satunya file aplikasi yang berubah.
- `scripts/verify_login_toggle_r84.cjs` **New** — pengujian TSX, kontrak UI, dan eksekusi handler onClick terisolasi.
- `docs/CHANGELOG_R84_TOGGLE_LOGIN_DUA_MODE.md` **New** — dokumen ini.

## Pengujian yang telah dilakukan

- Verifikasi statis/handler R84: **30/30 PASS**.
- Mock tampilan Chromium: **12/12 PASS** (320, 360, 390, 430, 768, 1280px × tema terang/gelap), no horizontal overflow, toggle satu-tap dan tinggi sentuh. Ini **mock statis**, bukan React yang telah terintegrasi dengan repo produksi.
- Syntax/transpile TypeScript TSX: **PASS**.
- Karena source penuh beserta dependencies NPM/tsconfig dan node_modules aplikasi tidak tersedia pada paket R83 yang digunakan, `npm ci`, `npm run lint`, dan `npm run build` **belum dapat diverifikasi di sini**. Jalankan semuanya sebelum Push.
- Belum menguji login akun nyata pada Firebase dan Vercel setelah deployment.

## Cara pasang ke GitHub Desktop

1. Pastikan source lokal sudah mengandung R83 dan login berjalan. Buat checkpoint commit jika diperlukan.
2. Ekstrak ZIP R84 ke root folder `piket-guru`, lalu timpa sesuai struktur folder asli.
3. Jalankan dari root repository:

```bash
npm ci
node scripts/verify_login_toggle_r84.cjs
npm run lint
npm run build
```

4. Jika semua pemeriksaan lulus, Commit → Push origin secara manual. Pastikan Vercel Deployment baru berstatus Ready.
5. Uji di HP dan desktop: ketuk Nama, pilih akun, isi PIN, kembali ke ID/NIP, masukkan ID, lalu ganti ke Nama; periksa field dan fokus. Uji fallback ketika daftar nama tidak tersedia serta dark mode.

**Jangan menghapus IndexedDB/draf/antrean offline untuk memeriksa UI login.** Jika terjadi error, rollback hanya commit R84, bukan R77–R83.
