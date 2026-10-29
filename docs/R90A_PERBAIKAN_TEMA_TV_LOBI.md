# R90-A — Hotfix Tema TV Lobi Selalu Gelap

## Basis
Patch incremental untuk proyek Piket Guru setelah R90. Tidak menyertakan perubahan `firestore.rules`, skema Firestore, atau presensi GPS.

## Akar masalah
- R90 hanya menerapkan `colorMode` pada bingkai dan header TV; `<main>`, kartu, teks dan `<footer>` masih menggunakan kelas gelap `bg-slate-950`, `bg-slate-900`, `text-white`, dan sejenisnya.
- Pilihan `theme` hanya berpengaruh ke jam dan ambient glow; lencana/panel tidak mengikuti pilihan warna aksen.
- Kartu pratinjau TV kecil pada menu TV memakai kelas dark mode tetap.

## Perbaikan
- Fungsi palet TV tersendiri pada `kioskTheme.ts` dengan dua mode: terang (`light`) dan gelap (`dark`), enam pilihan warna aksen, serta teks dengan kontras sesuai latarnya.
- Latar, header, kartu, panel inset, teks, pembatas, ticker dan elemen branding pada `PublicKioskDisplay` memakai token palet TV agar konsisten pada seluruh enam jenis slide.
- Pratinjau mini pada `KioskPreview` mengikuti konfigurasi TV tersimpan yang diterima dari listener Firestore, bukan tema dashboard operator.
- Pratinjau swatch warna di Pengaturan TV Lobi langsung merespons perubahan draf. Pilihan warna aksen dan mode kecerahan tetap **dua kontrol terpisah** dan perubahan tidak aktif pada monitor lain sebelum **Simpan**.
- Tidak mengubah rotasi slide, data sekolah, sistem autentikasi, atau mekanisme listener.

## Cara pasang
1. Pastikan repository sudah memakai patch R90.
2. Ekstrak isi ZIP ke root repository dengan mempertahankan jalur `src/`, `scripts/`, `docs/`.
3. Periksa perubahan di GitHub Desktop; commit lalu push untuk deployment Vercel Preview.
4. Pada proyek lengkap dengan dependensi terpasang, jalankan:
   ```bash
   node scripts/test_r90a_kiosk_theme.mjs
   node scripts/test_r90_tv_lobby_daily_recap.mjs
   npm run lint
   npm run build
   ```
5. Uji di Vercel Preview, sebaiknya dengan monitor atau browser kedua.

## Uji manual untuk Admin
- Masuk Pengaturan Sekolah → TV Lobi. Pilih `Mode Kecerahan Layar TV = Mode Terang`, dan `Skema Warna Aksen TV = Hijau Mint` (contoh). Swatch pratinjau menjadi putih/hijau. Klik **Pratinjau**: semua slide, header dan ticker harus cerah dengan teks gelap.
- Klik **Simpan**. Buka TV dari menu TV Lobi/dashboard pada perangkat lain. Pastikan warna mengikuti pengaturan yang tersimpan (termasuk saat panel berganti otomatis).
- Ubah `Mode Gelap` + `Lavender`, simpan dan pastikan semua panel berubah gelap dengan aksen ungu.
- Coba enam skema warna dalam masing-masing mode; jam, label panel dan ticker harus mengikuti skema terpilih.
- Pastikan perubahan tema dashboard pengguna tidak memaksa tema TV berubah; TV dikendalikan hanya oleh pengaturan TV Lobi.
- Coba pengaturan lain R90: urutan slide, interval slide, ticker ON/OFF; semua harus tetap bekerja.
- Bila TV lama tetap gelap sesudah deploy, pastikan commit versi terbaru terpasang di URL TV yang dibuka. Lakukan reload paksa atau tutup-buka PWA untuk mengganti berkas JavaScript yang masih di-cache. Periksa pula apakah mode kecerahan disetel `light` (warna aksen saja tidak mengubah latar).

## Hasil pemeriksaan lingkungan pembuatan
- R90-A: `23/23` pemeriksaan palet/TSX/sumber kode **PASS**.
- Regresi R90: `24/24` **PASS**.
- Build dan lint penuh belum dapat diverifikasi di lingkungan ini karena dependensi aplikasi belum tersedia (`npm run lint` gagal dengan missing modules dari proyek yang belum di-install). Test runtime Firebase/Vercel/monitor fisik harus dilakukan setelah patch diterapkan.

## Rollback
Revert commit R90-A di GitHub Desktop; tidak perlu rollback Firestore Rules maupun perubahan data.
