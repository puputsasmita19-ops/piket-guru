# Piket Guru R49 — Bersihkan Logo Sidebar & Perbarui Ikon Dashboard

## Perubahan

1. **Sidebar, desktop dan mobile:** Hapus panel identitas `PIKET GURU / Navigasi Sekolah` yang sebelumnya tampil ganda dengan identitas di header aplikasi. Tidak menghapus menu Navigasi, pencarian, tombol sematkan, atau tombol tutup mobile.
2. **Flash Info Dashboard:** Ganti artwork buku kertas miring pada slide “Kegiatan sekolah, lebih praktis” menjadi ikon grid minimalis pada kotak berwarna mengikuti tema. Untuk slide “Piket Anda hari ini” digunakan ikon kalender dengan tampilan yang sama.
3. **Responsif:** Dimensi ikon 56 px pada layar lebih besar, 46 px pada layar kurang dari 640 px. Shadow dibuat sangat ringan. Aksi slide dan perilaku carousel tidak diubah.

## Berkas incremental

- `src/components/layout/Sidebar.tsx`
- `src/features/dashboard/DashboardView.tsx`
- `src/dashboard-compact-r46.css` (ditambah aturan R49 di bagian akhir)
- `scripts/verify_dashboard_sidebar_r49.cjs` (baru)
- `docs/CHANGELOG_DASHBOARD_SIDEBAR_R49.md` (baru)

## Pemasangan

Timpa hanya berkas di atas pada repository Piket Guru setelah R48, lalu GitHub Desktop: **Changes → Commit → Push origin**. Tunggu deployment Vercel berstatus **Ready**. Uji tampilan desktop dan mobile, termasuk menu sidebar, tombol Cari, dan Flash Info.

## Batasan

Patch ini merupakan perubahan presentasi. Firebase, aturan akses, service worker, dan database tidak diubah. Jangan mengklaim lulus build penuh sebelum dependensi proyek tersedia dan `npm run lint && npm run build` dijalankan pada lingkungan lengkap.
