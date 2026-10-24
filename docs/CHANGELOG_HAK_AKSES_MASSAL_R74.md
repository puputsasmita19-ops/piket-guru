# Piket Guru R74 — Tampilkan Hak Akses Massal (Admin)

Tanggal: 24 Oktober 2026.

## Penyebab
Komponen `src/features/users/BulkPermissionsModal.tsx` sudah ada dalam repository lengkap yang diunggah, tetapi **tidak pernah diimpor atau diberi tombol pembuka** di `UserManagementView.tsx`, sehingga menu tidak terlihat.

## Perbaikan
- Tambah tombol **Hak Akses Massal** pada menu **Manajemen Pengguna & Master Data → Akun & Pengguna → Golongan Guru & Tenaga Pendidik**, di samping Import CSV dan Tambah Pengguna.
- Tombol **hanya** muncul bagi user dengan role `ADMIN`, sama dengan aksi manajemen pengguna yang sudah ada.
- Komponen modal juga hanya di-render saat `isAdmin`, dan menerima identitas Admin dari AuthContext.
- Gunakan komponen `BulkPermissionsModal` yang sudah ada: pilih beberapa akun, pilih izin, kemudian Tambahkan atau Cabut tanpa mengganti izin lain.
- Modal bawaan tetap mengecualikan akun Admin, nonaktif, dan wildcard (`*`). Pilihan massal tidak memodifikasi role.
- Tidak mengubah database schema, Firestore Rules, ataupun komponen operasi massal yang sudah ada.

## Pemasangan
1. Basis: repo pengguna dengan pembaruan R73; file view didasarkan pada R70 karena R71–R73 tidak mengubah `UserManagementView.tsx`.
2. Ekstrak ZIP ke root repository, timpa `src/features/users/UserManagementView.tsx`.
3. Setelah `npm ci`, jalankan `node scripts/verify_bulk_permissions_r74.cjs`, `npm run lint`, dan `npm run build`.
4. Commit dan Push melalui GitHub Desktop hanya setelah pemeriksaan lulus dan diff menunjukkan file yang dimaksud.
5. Login sebagai Admin: **Akun & Pengguna → Golongan Guru & Tenaga Pendidik → Hak Akses Massal**. Tes dialog menggunakan satu **akun uji non-Admin** dahulu, kemudian periksa audit dan Firestore.
6. Login sebagai Guru untuk memastikan tombol tidak tampil; percobaan write ke Firestore harus tetap ditolak oleh Rules bagi non-Admin.

## Batas verifikasi
- Pemeriksaan integrasi statis dilakukan menggunakan source lengkap R68 yang tersedia dan `UserManagementView.tsx` R70. R71–R73 tidak mengubah komponen pengguna tersebut.
- Belum ada pengujian write ke Firebase produksi, Firestore Emulator, atau pengujian lint/build aplikasi lengkap. Pastikan Rules yang ter-deploy mengizinkan transaksi Admin termasuk dokumen audit log.
- Jangan menggunakan fitur pada seluruh guru sebelum tes izin tambah/cabut pada akun uji berhasil. Hak akses yang diberikan kepada guru dapat memberi akses pada fungsi operasional yang sensitif.
