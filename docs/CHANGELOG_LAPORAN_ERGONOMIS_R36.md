# Piket Guru R36 — Navigasi Laporan & Rekap yang Lebih Ergonomis

## Permintaan
- Memperjelas perjalanan dari **Laporan Data → Rekap Foto → kembali ke laporan**.
- Membuat pilihan **Presensi Guru, Insiden Kejadian, Buku Piket, dan kategori lainnya** lebih nyaman di HP dan desktop.
- Menjaga fitur ekspor, filter, arsip foto, migrasi Google Drive, dan hak akses.

## Perubahan
1. **Satu navigasi utama** berisi dua pilihan: `Laporan Data` dan `Rekap Foto`. Tombol dan dropdown foto duplikat sebelumnya dihapus.
2. **Kembali dengan konteks:** setelah membuka Rekap Foto, menekan `Laporan Data` mengembalikan pengguna ke **kategori data terakhir**, bukan selalu Presensi Guru.
3. **Kategori rekap ditata sebagai grid responsif:** 2 kolom HP, 3 kolom tablet, 4 kolom desktop, tanpa keharusan menggulir tab mendatar. Seluruh 7 kategori dilengkapi jumlah data dan penanda aktif.
4. **Filter periode** dan rentang tanggal dirapikan agar tidak memaksa layout melebar di HP.
5. **Filter modul foto** berubah menjadi grid responsif dengan target sentuh lebih nyaman.
6. Tombol `Pratinjau / Unduh PDF Foto` **nonaktif sampai pengguna memilih foto**.
7. Teks orientasi halaman `Menampilkan: ...` dan panduan menggeser tabel lebar pada HP ditambahkan.

## Perilaku yang dipertahankan
- Delapan jenis data/report (`Presensi Guru`, `Insiden Kejadian`, `Jurnal Buku Piket`, `Keterlambatan Siswa`, `Izin Siswa`, `Guru Pengganti`, `Buku Tamu`, dan `Rekap Foto`).
- Filter tanggal & pencarian, total, unduh/cetak, serta detail/migrasi foto ke Drive tetap memakai layanan sebelumnya.
- Tidak mengubah aturan Firebase, izin, API, maupun skema database.

## File dalam ZIP incremental
- `src/features/reports/ReportsPreview.tsx` (file aplikasi yang berubah)
- `scripts/verify_reports_navigation_r36.cjs` (pengujian terarah)
- `docs/CHANGELOG_LAPORAN_ERGONOMIS_R36.md` (catatan)

## Verifikasi lokal
Jalankan di root repository:

```bash
node scripts/verify_reports_navigation_r36.cjs
npm run lint
npm run build
```

Pemeriksaan terarah memeriksa struktur JSX/TSX dan fitur navigasi yang dipertahankan. Perlu menguji deployment pada Vercel untuk memastikan build dan pengalaman nyata di HP.

## Uji setelah deployment
1. Buka **Laporan Data → Insiden Kejadian**, kemudian tekan **Rekap Foto → Laporan Data**. Seharusnya kembali ke **Insiden Kejadian**.
2. Coba seluruh 7 kategori pada HP dalam tampilan 2 kolom dan di desktop.
3. Ubah Bulanan/Mingguan/Rentang Khusus; pastikan data kategori tetap sesuai periode.
4. Di mode foto, tombol PDF tidak aktif sebelum ada foto dipilih. Pilih beberapa foto dan jalankan pratinjau.
5. Buka satu foto Buku Tamu, cek status/migrasi Drive dari patch R35.
