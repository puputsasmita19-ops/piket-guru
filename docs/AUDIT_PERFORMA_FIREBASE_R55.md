# Piket Guru R55 — Audit Performa & Optimasi Realtime

Tanggal: 24 Oktober 2026. Basis: source R54 (termasuk modul Monitoring R51 dan paginasi R54).

## Temuan dari source

| Prioritas | Modul | Temuan | Dampak | Tindakan R55 |
| --- | --- | --- | --- | --- |
| Tinggi | Monitoring Piket Realtime Admin | Listener riwayat default satu bulan langsung aktif saat membuka halaman, padahal Admin dapat hanya melihat metrik hari ini. | Membuka query tambahan dan memproses hasil riwayat yang belum diminta. | Listener riwayat **hanya dipasang saat tombol Buka Riwayat Presensi ditekan**; ditutup ketika panel ditutup atau halaman ditinggalkan. |
| Sedang | Monitoring Piket Realtime Admin | Pencarian presensi pada setiap jadwal menggunakan `.find`, kemudian pengecekan presensi tambahan menggunakan `.some` atas semua baris. | Pekerjaan CPU naik seiring jumlah jadwal × presensi. | Mengindeks record berdasarkan `userId` dan nama; pengecekan tambahan memakai `Set`, mempertahankan prioritas pencocokan dan urutan. |
| Rendah | FirestoreService | Pembacaan realtime identik sudah dibagikan melalui `sharedLiveSource` dan pemisahan sesi pengguna. | Sudah membantu menekan koneksi berulang. | **Dipertahankan**; tidak mengubah lapisan dasar yang sensitif. |
| Rendah | Dashboard & modul operasional | Sebagian besar listener riwayat sudah menggunakan filter tanggal; modul besar memakai React lazy import. | Sudah lebih hemat dibanding membaca seluruh data setiap kali. | **Dipertahankan**. |
| Perlu audit berikutnya | Master Data/Settings | Beberapa kategori koleksi dipantau bersama walau tab belum dibuka (mis. 520 siswa). | Potensi overhead pembacaan dan rendering saat masuk menu Admin. | Belum diubah R55 karena jumlah badge, pemilihan siswa, dan modal bergantung data tersebut; perlu perubahan terpisah dengan tes integrasi. |

## Perubahan kode

- `src/features/attendance/AdminAttendanceDashboard.tsx` — tombol Buka/Tutup Riwayat Presensi; pemasangan/pelepasan listener berdasarkan pilihan Admin; metrik hari ini tetap realtime.
- `src/utils/adminMonitorRows.ts` (baru) — fungsi penggabungan jadwal dan presensi berbasis indeks sekali jalan.
- `scripts/verify_realtime_perf_r55.cjs` (baru) — pengujian sintaks, pembandingan hasil algoritme R54/R55, keberadaan kontrol dan pembatasan Admin.

## Dampak dan batas klaim

- Saat panel Riwayat tertutup, **satu listener historis terpisah tidak dimulai** pada halaman Monitoring Admin. Pembacaan aktual yang dihemat bergantung pada data bulan tersebut dan cache SDK, serta jumlah pengguna yang membuka Monitoring.
- Query presensi **hari ini** dan Buku Piket **hari ini** tetap aktif demi realtime. Buka panel riwayat bila ingin mengedit/hapus presensi lama dengan audit Admin.
- Pengukuran CPU sintetis di mesin pengujian, 1.000 jadwal dan 1.300 presensi, per iterasi: algoritme R54 ~10,4 ms, R55 ~0,6 ms (20 repetisi setelah warm-up). Ini **bukan** metrik HP/produksi dan bukan jaminan persentase peningkatan perangkat nyata.
- Belum ada pengukuran read/write/billing Firebase produksi, latency jaringan, maupun pengujian beban banyak perangkat. Jangan menyimpulkan penghematan tagihan pasti tanpa pengukuran Firebase Console.

## Verifikasi

- `NODE_PATH=$(npm root -g) node scripts/verify_realtime_perf_r55.cjs`: **21/21 PASS** di lingkungan pengujian. Setelah `npm ci`, cukup jalankan `node scripts/verify_realtime_perf_r55.cjs`.
- `node scripts/verify_monitoring_r51.cjs`: **23/23 PASS**.
- `node scripts/verify_master_pagination_r54.cjs`: **25/25 PASS**.
- `npm ci --offline --no-audit --no-fund --ignore-scripts`: **BLOCKED** — paket `yargs-parser@21.1.1` tidak ada di cache NPM.
- `npm run lint`: **NOT VERIFIED** — dependensi proyek hilang.
- `npm run build`: **NOT VERIFIED** — `vite: not found` karena dependensi proyek belum terpasang.

## Cara pemasangan

Ekstrak ZIP incremental di root proyek R54. Timpa/isi tiga berkas pada `src/` dan `scripts/`, beserta dokumen ini di `docs/`. Di komputer terhubung internet jalankan:

```
npm ci
node scripts/verify_realtime_perf_r55.cjs
node scripts/verify_monitoring_r51.cjs
node scripts/verify_master_pagination_r54.cjs
npm run lint
npm run build
```

Lalu Commit dan Push di GitHub Desktop. Tunggu Vercel Ready. Uji dengan akun Admin pada menu Monitoring: pertama tampil metrik hari ini; pilih **Buka Riwayat Presensi** untuk memuat dan mengedit data lama; pilih **Tutup Riwayat** untuk menghentikan listener riwayat. Uji ulang setelah ganti periode, berganti menu, dan login akun tanpa hak Admin.

## Prioritas lanjutan setelah R55

1. Ukur Firebase reads per sesi Monitoring/Dashboard lewat metrik Firebase Console.
2. Pilih satu modul admin berat (Master Data/Settings) untuk mengubah listener menjadi per tab, tanpa menghilangkan badge hitungan atau hak akses.
3. Uji beban **di emulator/staging dengan data sintetis** sebelum menguji 20–50 pengguna produksi.
4. Periksa indeks Firestore dan query menggunakan Firebase Query Explain bila tersedia. Hindari penggantian query produksi tanpa memeriksa rules dan indeks.

Referensi resmi: https://firebase.google.com/docs/firestore/real-time_queries_at_scale dan https://firebase.google.com/docs/firestore/best-practices
