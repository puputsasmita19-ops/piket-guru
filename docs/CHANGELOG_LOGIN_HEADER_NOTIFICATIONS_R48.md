# R48 — Login Ringkas, Header Lengkap, Notifikasi Aktivitas

Tanggal: 2026-10-24. Patch incremental untuk source R47.

1. **Login:** pilihan akun ganda diganti kolom pencarian terlihat langsung dan satu kartu akun terpilih. Hasil cari dapat discroll, pencarian nama/ID/NIP/NUPTK/peran. Input ID manual dan PIN tetap tersedia. Otentikasi server tetap sama.
2. **Google:** tombol ikon-only tetap di bawah formulir (seperti di source R47). Login OAuth tidak diubah.
3. **Teks keamanan:** tagline “Otentikasi Aman • Enkripsi Salted SHA-256” sudah tidak terdapat dalam source LoginPage R47 dan tidak ditambahkan di R48.
4. **Header:** ikon koneksi/sinkronisasi, panduan, notifikasi, dan personalisasi warna dibuat tetap terlihat di viewport mobile/desktop. Ikon palet membuka mode terang/gelap/sistem dan tema warna.
5. **Notifikasi:** aktivitas sendiri ditampilkan bersama aktivitas pengguna lain, hanya bila izin modul terpenuhi dan fitur notifikasi diaktifkan Admin. Data sensitif tidak ditambahkan. Kelengkapan aktivitas tergantung audit/event yang berhasil dipublikasikan dan batas riwayat.
6. **Sidebar:** tampilkan logo aplikasi bawaan (`/icon.svg`) di bagian atas panel navigasi versi desktop/mobile.

File yang berubah:
- `src/features/auth/LoginPage.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/types/notification.types.ts`
- `src/modern-soft.css`
- `scripts/verify_login_header_notifications_r48.cjs` (baru)
- `docs/CHANGELOG_LOGIN_HEADER_NOTIFICATIONS_R48.md` (baru)

Validasi: `node scripts/verify_login_header_notifications_r48.cjs`, `npm ci`, `npm run lint`, dan `npm run build`.

Perhatian: tidak ada perubahan Firestore Rules atau database. Uji dengan akun Admin dan Guru setelah build, termasuk izin notifikasi, PIN manual, dan OAuth Google pada domain Vercel.
