# R97 — Optimasi Login & Verifikasi Akun

## Perbaikan

1. **Loading verifikasi sesi / setelah refresh**
   - Menggabungkan permintaan verifikasi simultan untuk *Firebase User instance* yang sama saja.
   - Tetap memeriksa profil akun langsung dari server Firestore dan hasil token Firebase untuk setiap validasi baru.
   - Tidak menyimpan/memakai ulang hasil persetujuan akses setelah promise selesai; tidak menggunakan localStorage sebagai sumber hak akses.
   - Pencabutan sesi, akun tidak aktif, atau kegagalan verifikasi masih menyebabkan penolakan sesuai alur sebelumnya.
2. **Halaman login pertama kali**
   - Kolom login tidak lagi memicu prefetch modul dashboard yang besar saat disentuh.
   - Endpoint daftar pengguna menggunakan query user aktif dengan proyeksi field penting saja; foto profil publik hanya dikirim sebagai referensi bila Admin sudah memberi izin.
   - Daftar nama tetap dikonfirmasi dari server; tidak menyimpan daftar akun publik dalam cache lokal sebagai data otoritatif.
   - Batas waktu *direktori nama opsional* dipersingkat 12→8 detik saat koneksi bermasalah. Login ID/NIP tetap dapat digunakan tanpa menunggu daftar nama.
3. **Saat kembali ke tab/refresh**
   - Permintaan direktori nama yang dipicu fokus/visibility/combobox dibatasi interval minimal 45 detik.
   - Refresh manual, jaringan kembali online, dan upaya pemulihan error tetap boleh meminta data terbaru.
   - Verifikasi saat refresh halaman tetap meminta token + profil otoritatif sebelum dashboard ditampilkan.

## Berkas baru/diubah

- src/contexts/AuthContext.tsx
- src/services/auth/sessionVerificationFlight.ts (baru)
- src/features/auth/LoginPage.tsx
- src/services/auth/authService.ts
- src/server/routes/authRoutes.ts
- scripts/test_r97_login_session_performance.mjs (baru)

## Cara menerapkan

Ekstrak ZIP patch di **root repo yang sudah menggunakan R96**, lalu jalankan:

```sh
node scripts/test_r97_login_session_performance.mjs
npm ci
npm run lint
npm run build
```

Commit dan push ke Vercel Preview; tidak diperlukan deploy `firestore.rules`.

## Pilot perangkat nyata

- Login baru via Nama + PIN; gunakan Google bila memang diaktifkan untuk role tersebut.
- Login baru via ID/NIP bahkan saat direktori nama tidak tersedia.
- Refresh pada sesi yang masih valid: tunggu verifikasi server dan pastikan akun/role benar.
- Simulasikan jaringan lambat, offline lalu online, dan buka-tutup tab secara cepat.
- Ubah status aktif/hak akses satu akun dari Admin dan pastikan akun tidak dapat melewati verifikasi saat refresh.
- Uji sign out, login kembali dengan akun lain pada perangkat yang sama, dan cek tidak ada profil akun sebelumnya yang terlihat.
- Bandingkan Network DevTools: saat fokus formulir login tidak semestinya ada unduhan modul dashboard; request `users-summary` tidak berulang pada setiap fokus.

## Batas validasi lingkungan kerja ini

- `node scripts/test_r97_login_session_performance.mjs`: 15/15 PASS (tes tanpa Firebase/network).
- `node scripts/verify_login_toggle_r84.cjs`: 30/30 PASS.
- `npm run lint` penuh tidak dapat diverifikasi karena paket React/Firebase tidak terpasang di lingkungan ini (banyak TS2307 missing modules).
- Skrip R11/R79/R81 merupakan pemeriksaan struktur UI lama; beberapa asersi tidak lagi sesuai alur sejak revisi sebelumnya sehingga hasilnya bukan regresi fungsional R97.
- Waktu login di perangkat dan Firestore/Google SDK nyata belum diukur; tidak ada jaminan pengurangan detik yang spesifik.

## Rollback

Pulihkan hanya 5 file source yang berubah ke versi R96. Hapus helper baru apabila tidak digunakan. Tidak ada perubahan database, indeks, koleksi, schema, ataupun Firestore Rules.
