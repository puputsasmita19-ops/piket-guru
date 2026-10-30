# R103 — Login Branding Tanpa Data Contoh

## Prasyarat
Repository sudah menerapkan R102. Pasang ZIP ini ke root repo; file lain jangan dihapus.

## Perubahan

- `src/config/constants.ts`: default `schoolName`, alamat, nomor kontak, NPSN, dan website contoh dikosongkan. Pengaturan resmi sekolah yang sudah tersimpan di Firestore **tidak diubah**.
- `src/features/auth/LoginPage.tsx`: tidak lagi membaca cache operasional penuh `piket_guru_school_config` untuk identitas awal login. Meminta `/api/auth/public-config` langsung sejak halaman ditampilkan, tanpa jeda 1,5 detik. Daftar akun tetap mendapat prioritas jaringan. Saat identitas belum diketahui, teks netral muncul, bukan sekolah contoh.
- `src/features/auth/publicLoginBrand.ts`: cache **publik, kecil, tervalidasi** untuk label awal login, berlaku 15 menit. Cache hanya berisi nama, alamat, judul/subjudul aplikasi, kredit pengembang, **tanpa koordinat, PIN, token, atau data internal**. Identitas yang terverifikasi di server menggantikan cache ketika respons tiba.
- `src/server/routes/authRoutes.ts`: endpoint identitas publik menolak nama contoh lama, tidak mengarang nama sekolah ketika konfigurasi belum tersedia, dan memakai `Cache-Control: no-store`. Backend masih mengambil nama aktual dari `settings/school_config`.
- `src/features/settings/SettingsView.tsx` dan `src/services/watermark/watermarkService.ts`: fallback teks kontak dan label pratinjau tidak memuat contoh sekolah lama.
- `scripts/test_r103_public_school_branding.mjs`: tes deterministik untuk cache, fallback, dan perilaku startup.

## Terapkan & uji

1. Backup atau commit source saat ini.
2. Ekstrak isi ZIP di root repo setelah R102.
3. Jalankan:

   ```bash
   node scripts/test_r103_public_school_branding.mjs
   node scripts/test_r102_mobile_login_gps.mjs
   node scripts/test_r97_login_session_performance.mjs
   npm run lint
   npm run build
   ```

4. Commit dan push, tunggu deployment Vercel Preview berhasil.
5. Di HP/PWA: jalankan pembaruan versi PWA resmi aplikasi atau muat ulang halaman. Bila nama lama masih muncul, pastikan versi klien terbaru memang terpasang. **Tidak perlu menghapus data aplikasi atau cache operasional untuk memaksa refresh**.
6. Buka halaman login dengan koneksi normal, lalu matikan jaringan dan buka kembali dalam 15 menit: identitas lama yang *terverifikasi* boleh muncul saat offline, tetapi label demo tidak boleh muncul.
7. Ganti nama resmi sekolah dari Admin (pada proyek staging), buka login kembali, verifikasi teks berubah mengikuti `settings/school_config` dan tidak ada nama demo.

## Hal penting

- **Patch tidak mengubah Firestore database, aturan Firestore, GPS, radius, PIN, atau login token.**
- Jika `settings/school_config.schoolName` belum diisi dengan benar, perlu diperbaiki oleh Admin menggunakan menu profil sekolah. Patch tidak menebak nama sekolah.
- Kunci localStorage operasional lama (`piket_guru_school_config`) sengaja tidak dihapus karena masih dipakai fungsi lain; halaman login **tidak lagi mempercayainya** sebagai sumber branding publik.
- `backups/BACKUP_PRE_PURGE_2026-10-02.json` tidak diubah (arsip historis, bukan sumber awal login).
- Angka durasi login di HP memerlukan pengujian nyata. Patch menghilangkan penundaan identitas 1,5 detik, tetapi respons server/jaringan tetap tidak bisa dijamin.
- Tes sintaks lokal dan tes terarah lulus; `npm run lint` di lingkungan pembuat patch tidak bisa lulus karena tidak tersedia dependensi React/Firebase dan type packages. Jalankan lint & build lengkap di repo pengguna.
