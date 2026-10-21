# Patch Monitoring Piket Realtime R12

Tanggal: 2026-10-21

## Ringkasan
Patch ini mengganti ikon menu **Monitoring Piket Realtime** dengan gambar kustom yang diberikan pengguna, lalu menambahkan kontrol tampilan **Grid / List** dan area **scroll** pada dashboard monitoring agar lebih nyaman diakses saat data banyak, baik pada mobile maupun desktop.

## Perubahan utama
1. **Ikon menu Monitoring Piket Realtime**
   - Menu admin `attendance-monitor` kini memakai gambar ikon kustom.
   - Judul halaman dashboard monitoring juga menggunakan ikon yang sama agar identitas visual konsisten.

2. **Tampilan Grid / List**
   - Dashboard monitoring kini memiliki toggle **Grid** dan **List** di header halaman.
   - Toggle tersebut mengatur tampilan untuk:
     - Aktivitas Piket Hari Ini
     - Jurnal Kegiatan Piket Hari Ini
   - Riwayat presensi tetap mempertahankan mode grid/list yang sudah ada dari kontrol riwayat.

3. **Scroll untuk akses lebih nyaman**
   - Area **Aktivitas Piket Hari Ini** dibuat scrollable.
   - Area **Jurnal Kegiatan Piket Hari Ini** dibuat scrollable.
   - Area **Kelola Riwayat Presensi Guru Piket** dibuat scrollable.
   - Tujuannya agar layar tidak terlalu panjang dan lebih nyaman di mobile maupun desktop.

## File yang berubah
- `public/monitoring-piket-realtime-icon.png`
- `src/components/icons/RealtimeMonitorLogo.tsx`
- `src/components/icons/index.ts`
- `src/components/layout/Sidebar.tsx`
- `src/features/attendance/AdminAttendanceDashboard.tsx`
- `scripts/verify_monitoring_icon_layout_r12.cjs`
- `docs/CHANGELOG_MONITORING_REALTIME_R12.md`

## Verifikasi lokal
Jalankan:

```bash
node scripts/verify_monitoring_icon_layout_r12.cjs
```

Verifikasi ini memeriksa bahwa:
- ikon menu sudah menggunakan aset kustom,
- toggle Grid/List tersedia,
- area utama monitoring memiliki scroll,
- file utama lolos transpile sintaks.

## Catatan
- Lint dan build penuh tetap perlu dijalankan di lingkungan proyek Anda.
- Patch ini tidak mengubah aturan akses admin, logika realtime Firestore, atau fitur edit/hapus presensi.
