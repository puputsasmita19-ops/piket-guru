# Piket Guru R41 — Daftar Master Scroll & Paginasi Stabil

## Perbaikan

- **Master Data & Pengguna → Data Guru, Tenaga Kependidikan, Data Siswa:** daftar dibatasi tinggi maksimal `min(62vh, 620px)` dan dapat di-scroll secara independen; tidak lagi membuat seluruh halaman terlalu panjang.
- Scroll mendukung mouse, touch, dan keyboard (area daftar dapat difokuskan); pencarian dan pergantian kategori mereset scroll daftar ke atas.
- **Manajemen Pengguna / Data Siswa:** tinggi tabel stabil (320–560 px mengikuti viewport) sehingga bagian kontrol halaman tidak meloncat ketika jumlah baris berbeda.
- Navigasi menggunakan **lima slot nomor tetap** termasuk placeholder tanpa interaksi untuk dataset kecil; tombol sebelumnya/berikutnya selalu ada dan dinonaktifkan bila tidak berlaku. Ukuran 10/15/20/50/Semua tetap tersedia.
- Nomor halaman aktif, label navigasi dan informasi total dapat dibaca pembaca layar.
- Perpindahan halaman dan perubahan jumlah baris mengembalikan scroll tabel ke awal tanpa menggeser posisi halaman utama.
- Tidak mengubah layanan Firebase, transaksi, fungsi edit/hapus, role, atau Firestore Rules.

## File incremental
- `src/features/master/MasterDataTabs.tsx`
- `src/features/users/UserManagementView.tsx`
- `src/utils/paginationUtils.ts` (baru)
- `scripts/verify_master_scroll_pagination_r41.cjs` (baru)
- `docs/CHANGELOG_MASTER_SCROLL_PAGINATION_R41.md` (baru)

## Verifikasi

```bash
node scripts/verify_master_scroll_pagination_r41.cjs
npm run lint
npm run build
```

Pengujian source tidak menggantikan pemeriksaan tampilan di desktop/HP. Tetap konfirmasi hasil build Vercel.
