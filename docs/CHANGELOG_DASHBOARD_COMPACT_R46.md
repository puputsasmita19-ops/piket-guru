# Piket Guru R46 — Dashboard Compact Desktop dan Mobile

## Penyebab perbaikan R45 tidak terlihat
Aturan R45 masih bergantung pada `min-height` kartu pintasan dan tidak menyasar komponen carousel `DashboardFlashInfo`. Pemeriksaan source menemukan bahwa komponen aslinya adalah `QuickActions` dan `DashboardFlashInfo`, bukan kartu sederhana pada bundle yang lebih tua.

## Perubahan R46
- Tambah file CSS yang mengatur langsung kelas `shortcut-grid`, `quick-action shortcut-tile`, dan `flash-slide` sesuai source dashboard.
- Desktop: pintasan menjadi kartu horizontal ringkas dengan ikon di sisi kiri, maksimal 4 kolom pada viewport lebar.
- Mobile: tetap grid 2 kolom, ikon dan judul ditata vertikal, kartu jauh lebih pendek; aman sampai 320 px.
- Flash Info: tinggi slide konsisten sekitar 118–122 px; konten ringkasan panjang dapat digulir di dalam slide dan dibuka penuh lewat tombol rincian. Tombol rotasi tetap ada.
- Gaya memakai background/warna R42–R45, dengan bayangan minimal.

## File incremental
- `src/main.tsx` (menambahkan satu baris import CSS setelah tema sebelumnya)
- `src/dashboard-compact-r46.css` (file baru)
- `scripts/verify_dashboard_compact_r46.cjs`
- `docs/CHANGELOG_DASHBOARD_COMPACT_R46.md`

Tidak mengubah API, role, Firebase, realtime, GPS, maupun data pengguna.

## Pemasangan dan verifikasi
1. Ekstrak ke root repository yang sudah memakai R45, tidak menghapus file lain.
2. Jalankan `node scripts/verify_dashboard_compact_r46.cjs`.
3. Lakukan commit dan push melalui GitHub Desktop, cek Vercel Ready.
4. Refresh penuh/clear cache aplikasi jika PWA masih menampilkan CSS lama. Periksa kembali mobile dan desktop.

Catatan: build dan lint penuh memerlukan dependensi proyek. Jika gagal, inspeksi Build Logs Vercel dan jangan dianggap lulus.
