# Piket Guru R51 — Pemulihan Monitoring Piket Realtime

Tanggal: 24 Oktober 2026 (WIB)

## Masalah
Setelah pembaruan hingga R50, menu Monitoring Piket Realtime tidak muncul lagi. Source R50 tidak memiliki entri `attendance-monitor` pada Sidebar, NavigationContext, NavigationTab, moduleAppearance, atau AuthenticatedShell. Komponen AdminAttendanceDashboard dan dialog koreksi juga tidak lagi tersedia pada source tersebut.

## Perbaikan
1. Memulihkan menu **Monitoring Piket Realtime** di kelompok **Administrasi** pada sidebar, khusus role `ADMIN` dengan izin `attendance.view_all`.
2. Memulihkan navigasi `#attendance-monitor` dan lazy-loaded view yang dilindungi pemeriksaan role dan izin.
3. Mengembalikan dashboard monitoring realtime: ringkasan petugas, hadir/belum hadir, belum pulang, jurnal piket, tampilan Grid/List, daftar scroll, serta riwayat dengan filter dan paginasi.
4. Memulihkan dialog koreksi/hapus riwayat presensi dengan alasan tertulis (10–500 karakter), transaksi Firestore dan audit untuk administrator.
5. Mengembalikan ikon monitoring berupa komponen vektor ringan, selaras dengan ikon aplikasi.
6. Melengkapi type untuk metadata `adminCorrection` yang sebelumnya ada pada modul monitoring.

## Akses
- Desktop: **Sidebar → Administrasi → Monitoring Piket Realtime**.
- Mobile: **Lainnya → Administrasi → Monitoring Piket Realtime**.
- Pengguna selain ADMIN tetap tidak diberi akses meskipun memiliki izin lain.
- Hak akses tetap perlu dievaluasi oleh server/Firestore Security Rules; menyembunyikan menu bukan pengganti otorisasi backend.

## Status pemeriksaan
- Skrip struktur `node scripts/verify_monitoring_r51.cjs`: 23/23 PASS.
- Parsing sintaks TypeScript/TSX dan impor relatif sembilan file perubahan: PASS.
- `npm ci --offline`: BLOCKED — `yargs-parser@21.1.1` tidak tersedia di cache lokal.
- `npm run lint`: NOT PASS — dependensi dan deklarasi tipe React/Firebase/Node belum tersedia dalam lingkungan pemeriksaan.
- `npm run build`: NOT PASS — Vite tidak tersedia karena instalasi dependensi terhalang.
- End-to-end Firebase dan pengujian Firestore Rules di lingkungan sekolah: BELUM DIJALANKAN. Jangan menganggap fitur edit/hapus produksi sudah teruji tanpa uji Admin dan otorisasi Firestore.

## Pemasangan
1. Basis: repository Piket Guru yang telah menerapkan R50.
2. Ekstrak ZIP incremental ke root repository, timpa hanya file dengan jalur sama.
3. Jalankan `npm ci`, `node scripts/verify_monitoring_r51.cjs`, `npm run lint`, dan `npm run build` pada lingkungan dengan dependensi lengkap.
4. Commit dan Push origin melalui GitHub Desktop; tunggu Vercel Ready.
5. Uji dengan akun ADMIN pada desktop dan HP; buka `#attendance-monitor`, verifikasi ringkasan dan pembaruan realtime. Pastikan menu tidak muncul untuk akun Guru.
6. Uji tindakan edit/hapus menggunakan data uji saja, bukan catatan produksi penting. Verifikasi audit tersimpan dan aturan Firestore menolak pengguna non-admin.

Tidak ada perubahan aturan Firestore atau database dalam ZIP ini. Jika aturan yang sedang terpasang tidak mengizinkan transaksi koreksi admin, tombol Edit/Hapus dapat gagal dan harus ditinjau dengan aturan backend yang berlaku sebelum digunakan.
