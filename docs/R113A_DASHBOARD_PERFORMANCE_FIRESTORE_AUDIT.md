# R113-A — Dashboard Performance & Firebase Audit

## Scope dan hasil audit source (31 Oktober 2026)

Source: aplikasi setelah R112 baseline login/GPS. R113-A merupakan **instrumen pengukuran dan audit**, bukan refactor besar jalur pembacaan Firestore. Semua aturan baca, status, pembatasan akses, offline queue, login, geofence, dan transaksi presensi tetap dipertahankan.

`src/features/dashboard/DashboardView.tsx` memasang **11 listener utama** (1 dokumen settings + 10 koleksi). Jika punya izin `SUBSTITUTIONS_VIEW`, terdapat **1 tambahan** untuk `substitutions` pada tanggal berjalan. Angka ini tidak termasuk `SmartCheckoutReminder`, `Header`, Notification Bell, banner darurat, dan listener di layar lain. Perubahan R113-A tidak menambah listener Firebase.

| Sumber | Cakupan query saat ini | Penggunaan | Prioritas peninjauan R113-B |
|---|---|---|---|
| `settings/school_config` | satu dokumen | pengaturan dashboard/pengingat | Pertahankan, evaluasi shared subscription lintas komponen |
| `schedules` | seluruh koleksi | jadwal hari ini/besok, jadwal personal | **Tinggi** — nilai potensi besarnya dataset dan cakupan query |
| `teachers` | seluruh koleksi | pencocokan petugas, master guru | **Tinggi** — ukur jumlah profil dan duplikasi lintas modul |
| `staff` | seluruh koleksi | pencocokan petugas | **Tinggi** — ukur pertumbuhan dan akses |
| `attendance` | `tanggal == todayISO` | statistik kehadiran | Pertahankan query harian |
| `dutyBooks` | `tanggal == todayISO` | status buku piket | Pertahankan query harian |
| `incidents` | `tanggal == todayISO` | kejadian harian | Pertahankan query harian |
| `announcements` | `isActive == true` | papan pengumuman | Tinjau pembatasan tanggal/retensi, jangan ubah otomatis |
| `studentTardiness` | `tanggal == todayISO` | statistik siswa terlambat | Pertahankan query harian |
| `studentPermits` | `tanggal == todayISO` | izin keluar hari ini | Pertahankan query harian |
| `visitors` | `tanggal == todayISO` | buku tamu hari ini | Pertahankan query harian |
| `substitutions` (opsional) | `tanggal == todayISO`, izin akses | inval/guru pengganti | Pertahankan query dan otorisasi |

### Potensi bottleneck berdasar kode, belum hasil benchmark lapangan

1. **Tiga koleksi tanpa pembatasan** (`schedules`, `teachers`, `staff`) dapat tumbuh seiring waktu dan memperbesar payload snapshot. Jumlah dokumen aktual perlu diukur.
2. **Render ulang dashboard** dapat terpicu oleh masing-masing callback snapshot karena menggunakan state lokal terpisah. Pembuatan `todaySchedules`, perhitungan statistik, sortir pengumuman, `flashSlides`, dan `dashboardSlides` terjadi kembali saat render. Jangan mulai memoization/pemisahan state sebelum mengetahui frekuensi nyata.
3. **Subscription paralel lintas komponen**: halaman utama punya listener sendiri, sementara `SmartCheckoutReminder` dan `Header` punya listener tambahan. Jumlah jaringan aktual tidak sama dengan jumlah panggilan karena layanan memakai `sharedLiveSource` untuk query identik dalam sesi. Audit R113-A hanya menghitung subscription milik `DashboardView`.
4. `AnnouncementService.bootstrapIfEmpty()` adalah fungsi **no-op** di mode produksi; panggilannya dihapus dari mount dashboard sebagai pembersihan aman.
5. `FirestoreService.subscribeToCollection` dapat menyajikan snapshot dari cache perangkat sebelum snapshot SDK server. Oleh karena itu *snapshot pertama* **tidak otomatis berarti unduhan server selesai** dan *jumlah dokumen terakhir* **bukan biaya read**.

## Diagnostik mobile (opsional)

URL: `https://piket-guru-ashen.vercel.app/?dashboard_diag=1`

Setelah masuk ke **Dashboard**, buka laci **Diagnostik Dashboard · R113-A** di kanan bawah. Panel tidak dimuat pada dashboard normal tanpa parameter ini. Tidak ada permintaan Firebase baru untuk audit.

Metrik yang dicatat selama halaman Dashboard dibuka:
- Perkiraan frame awal browser sesudah mount (bukan Web Vitals/LCP atau waktu log in).
- Waktu callback snapshot pertama.
- Waktu sampai `settings/school_config`, `schedules`, dan `announcements` masing-masing telah memberi callback pertama; cache termasuk.
- Banyaknya listener aktif; frekuensi callback untuk setiap sumber; ukuran array dari snapshot terakhir; jumlah error listener.
- Salin ringkasan waktu, **tanpa data pengguna, koordinat, nama, PIN, isi dokumen, atau UID**.

### Protokol uji HP

1. Gunakan akun Guru uji; buka Dashboard dengan `?dashboard_diag=1` di HP Android, jaringan normal.
2. Tunggu data terisi lalu klik **Salin ringkasan**. Catat waktu sumber inti dan jumlah dokumen `schedules`, `teachers`, `staff`.
3. Pindah ke menu lain dan kembali ke Dashboard; cek apakah listener dikembalikan dan metrik reset saat halaman di-mount ulang.
4. Coba kondisi Wi-Fi / seluler, masing-masing 3–5 kali. Catat juga apakah kalender dan pengumuman tetap akurat.
5. Logout, masuk dengan akun lain untuk menguji pemisahan sesi. Lakukan pengujian offline untuk memastikan cache tidak tertukar antara akun.

**Jangan menafsirkan `total callback snapshot` atau `jumlah dokumen` sebagai jumlah billable reads Firestore.** Untuk biaya sebenarnya gunakan metrik Cloud Firestore/Firebase Console.

## Kriteria diterima R113-A

- Semua listener dan data dashboard tetap tampil, hak akses tidak berubah, fallback offline tetap bekerja.
- Panel aktif hanya dengan flag URL, tidak memuat data sensitif, tidak memiliki penulisan Firestore.
- Tidak ada tambahan query Firestore dari diagnostik.
- Checksum 20 file baseline R112 tidak berubah dan suite regresi login/GPS tetap lulus.
- Build/Vercel Preview dan hasil pada perangkat asli perlu diuji secara terpisah.

## Langkah berikutnya (R113-B)

Berdasarkan **angka aktual** pada ringkasan R113-A, prioritaskan pembatasan dan segmentasi `schedules`, `teachers`, `staff` bila jumlah dokumen tinggi, serta pemisahan komputasi dari presentasi jika callback sering menyebabkan rerender. Jangan mematikan listener untuk izin/riwayat yang dibutuhkan realtime tanpa review ketergantungan dan Firestore Rules.
