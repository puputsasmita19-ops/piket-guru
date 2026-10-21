# Perbaikan performa login mobile & desktop (R11)
Tanggal: 2026-10-21

## Tujuan
Mengurangi pekerjaan yang tidak perlu ketika pengguna membuka formulir dan mengirim login, tanpa mengurangi keamanan autentikasi.

## Perubahan
- `LoginPage.tsx`: tidak lagi mengunduh modul dashboard saat pengguna sekadar fokus pada formulir. Muat daftar akun melalui cache memori aplikasi bila masih segar; refresh tetap terjadi jika data sudah kedaluwarsa atau koneksi pulih. Animasi video latar dijeda saat login berlangsung.
- `AuthContext.tsx`: modul dashboard diminta setelah PIN/Google berhasil atau setelah verifikasi sesi Firebase berhasil; bukan sebelum jaringan memproses autentikasi. Backend PIN, custom token Firebase, verifikasi role, status akun dan pemeriksaan revokasi tetap sama.
- `authService.ts`: masa kesegaran daftar pengguna di memori per tab diperpanjang dari 15 ke 45 detik untuk mengurangi fetch berulang akibat fokus/visibility. Tidak menyimpan PIN, token, atau izin pengguna dalam cache baru. Akun nonaktif tetap ditolak oleh backend.
- `LoginBackdrop.tsx`: menerima status `paused` agar animasi dan video login tidak berjalan selama proses autentikasi.

## Lingkup keamanan yang dipertahankan
- Login PIN harus melewati `/api/auth/login`, scrypt dan rate limiter server, serta `signInWithCustomToken`.
- Login Google tetap memakai `signInWithPopup` dan validasi UID + profil Firebase.
- Session restore tetap memvalidasi profil, role dan status aktif sebelum menampilkan dashboard.
- Hak akses / Firebase Rules / realtime tidak diubah.

## Verifikasi
`node scripts/verify_login_performance_round11.cjs` — 15 pemeriksaan source dan transpile lulus. Ini bukan benchmark latensi atau pengujian perangkat sungguhan.

Percobaan `npm ci --offline` gagal karena paket `yargs-parser` belum ada di cache. `npm run lint` menghasilkan error modul/types yang tidak terpasang. `npm run build` gagal karena `vite` tidak ditemukan. **Lint/build penuh belum dinyatakan lulus**.

## Uji penerimaan pascadeploy
1. Mobile: masuk PIN 6 digit, logout, login ulang; pastikan navigasi dashboard dan data pengguna sesuai.
2. Desktop: masuk PIN dan Google, pembatalan pop-up, lalu login ulang.
3. Browser refresh dengan sesi valid: masuk dashboard setelah verifikasi, tanpa flash halaman pengguna lain.
4. Login PIN salah/akun dinonaktifkan/rate limit: tetap ditolak.
5. Akun guru tidak memperoleh izin admin.
6. Catat waktu dari klik Masuk sampai dashboard siap pada jaringan nyata; cold start Vercel, kualitas internet dan Firebase masih dapat menentukan waktu tunggu.

## Pemasangan
Ekstrak ZIP incremental ke akar repository lokal, timpa sesuai path, lalu `npm ci`, `npm run lint`, `npm run build`. Hanya commit dan push jika pemeriksaan berhasil; pantau status Vercel `Ready`.
