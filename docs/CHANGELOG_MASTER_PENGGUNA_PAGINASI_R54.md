# Piket Guru R54 — Paginasi Guru/Pengguna Stabil

**Basis:** source R52 dengan pembaruan R53 (R53 tidak mengubah komponen UserManagementView).

## Perbaikan

- Menu Master Pengguna -> Guru dan Siswa memakai pagination dengan **5 posisi nomor tetap**. Placeholder transparan menjaga lebar posisi nomor untuk dataset hanya 1–4 halaman.
- Area daftar diberi tinggi responsif tetapi **tetap untuk semua halaman**; halaman terakhir berisi lebih sedikit guru tidak membuat tombol pagination bergerak ke atas.
- Footer dipecah menjadi info hasil, ukuran halaman, dan navigasi supaya posisi tidak berubah karena panjang tulisan.
- Scroll kembali ke atas **di dalam tabel** pada perpindahan halaman/ukuran/filter, bukan menggulir seluruh aplikasi.
- Tombol min. 36 px di mobile dan 40 px desktop; status aktif, keyboard focus, prev/next disabled dan aria-label dipertahankan.
- Filter, data Firebase, halaman 10/15/20/50/Semua, edit/hapus, dan akses Admin tidak diubah.

## Instalasi

Ekstrak ZIP incremental ke repository `piket-guru` versi R53, timpa file sesuai folder, commit lalu Push Origin. Setelah deployment Vercel Ready, uji 41 pengguna dengan ukuran halaman 15: tekan 1 -> 2 -> 3 -> 1. Area tabel dan tombol navigasi tidak seharusnya berpindah posisi. Uji juga ukuran 10, 20, 50, Semua dan mobile.

## Pemeriksaan

`node scripts/verify_master_pagination_r54.cjs`.

`npm run lint` dan `npm run build` masih memerlukan instalasi semua dependensi proyek. Tidak ada perubahan data atau Firebase Rules.
