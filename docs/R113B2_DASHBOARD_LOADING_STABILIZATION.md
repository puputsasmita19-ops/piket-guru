# R113-B2 — Dashboard Loading Stabilization

**Basis:** Repository setelah R113-B, baseline `STABLE-LOGIN-GPS-R112`.

## Kenapa ada patch ini?
Hasil diagnostik HP pada 31 Oktober 2026 (masing-masing baru satu sampel):

| Metrik | R113-A | R113-B |
|---|---:|---:|
| Frame dashboard | 287 ms | 913 ms |
| Snapshot pertama | 315 ms | 1.396 ms |
| Metrik historis tiga sumber (settings, schedules, announcements) | 322 ms | 2.157 ms |
| Listener | 11 | 11 |
| Jumlah dokumen snapshot | 83 | 44 |

R113-B berhasil membatasi master guru tanpa merusak jadwal. Tetapi dua pengukuran tersebut **belum** memastikan penyebab perlambatan. Perubahan jaringan, cache/offline, waktu login, dan kondisi perangkat tidak diisolasi. Karena itu R113-B2 tidak menyatakan adanya peningkatan terukur sebelum tes HP.

## Perubahan yang dibuat

1. Tetap pasang **8 listener prioritas** pada saat DashboardView mount: pengaturan sekolah, jadwal, master guru/staf terkait, presensi hari ini, pengumuman, buku piket, dan insiden.
2. Pasang **3 listener statistik non-kritis** (`studentTardiness`, `studentPermits`, `visitors`) setelah kesempatan render pertama. Pada Chrome/Android, `requestIdleCallback` membatasi tunggu hingga **300 ms setelah frame**; browser lain menggunakan fallback `setTimeout` segera setelah frame. Listener **tetap realtime** setelah didaftarkan dan tetap memakai `where('tanggal', '==', todayISO)`.
3. Kurangi urgensi render pembaruan statistik tersebut memakai `React.startTransition` tanpa mengubah sumber atau frekuensi query.
4. Selama snapshot sekunder belum diterima, tampilkan *skeleton loading* pada kartu bersangkutan, bukan angka nol yang belum terbukti. Jika listener gagal, tampilkan *Belum tersambung*.
5. Bersihkan pending frame/idle/timer dan unsubscribe observer saat pindah akun/tanggal/halaman. Status loading statistik dikunci ke kombinasi UID dan tanggal WIB.
6. Diagnostik `?dashboard_diag=1` tetap opsional, kini menampilkan:
   - **3 sumber historis siap** = settings + schedules + announcements (metrik asli R113-A, untuk perbandingan);
   - **3 sumber personal siap** = settings + schedules + teachers:linked;
   - **Observer sekunder mulai** dan **semua sumber awal siap** (11 listener).

**Bukan perubahan:** data jadwal tidak difilter ulang, tidak ada `firestore.rules` baru, tidak ada perubahan autentikasi/GPS/region Vercel `sin1`, tidak menambahkan pembacaan Firestore.

## Pengujian lokal

```bash
node scripts/test_r113b2_dashboard_loading_stabilization.mjs
node scripts/test_r113b_smart_dashboard_loading.mjs
node scripts/test_r113a_dashboard_performance_audit.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
npm ci
npm run lint
npm run build
```

Hasil tersedia: **R113-B2 21/21 PASS, R113-B 29/29 PASS, R113-A 19/19 PASS, baseline R112 13/13 skrip PASS, checksum 20/20 cocok**, kompilasi `tsc --noEmit --strict` untuk dua helper TypeScript independen PASS. **Full `npm run lint` dan `npm run build` belum dijalankan** (React/Firebase dependencies tidak terpasang di lingkungan penyusunan patch). Perlu pengujian UI browser/HP setelah deploy.

## Pengujian mobile yang wajib

1. Deploy lebih dahulu ke Vercel Preview, pastikan **API/region `sin1`** tetap benar.
2. Di Chrome Android, kunjungi `https://piket-guru-ashen.vercel.app/?dashboard_diag=1` setelah versi produksi terbaru Ready (jangan digunakan jika masih preview lain). Uji **minimal 3 kali**, bandingkan Wi-Fi dan 4G secara terpisah.
3. Catat **frame awal**, **snapshot pertama**, **3 sumber historis**, **3 sumber personal**, **observer sekunder mulai**, **semua sumber siap**, **listener 11**, dan **dokumen ~44** (sesuai data aktual pengguna; bisa berubah).
4. Periksa kartu statistik Siswa Terlambat, Izin Keluar Kelas, dan Buku Tamu: tidak boleh langsung menunjukkan angka 0 sebelum sumber menerima data; setelah snapshot, nilai harus benar. Bila jaringan terganggu, tidak boleh mengklaim 0 seolah data lengkap.
5. Uji modal **Guru Bertugas Hari Ini/Besok**, pengumuman mendesak, buku piket, presensi, serta perpindahan akun dan pergantian tanggal; jangan ada data akun sebelumnya tersisa.
6. Cek login PIN (baseline ±2,15 detik hasil sebelumnya), GPS (sekitar 2 detik lebih sedikit), serta status Check-In/Out.

**Batasan interpretasi:** semua waktu dihitung relatif terhadap mount komponen DashboardView, bukan klik PIN, dan snapshot dapat berasal dari cache SDK/offline maupun server. Dari alat ini belum dapat dibedakan sumber cache/server; jumlah dokumen snapshot bukan billed reads. Kenaikan/penurunan satu sampel tidak cukup untuk mengklaim regresi maupun perbaikan.

## Rollback
Jika muncul kendala, kembalikan **empat file yang dimodifikasi** (`DashboardView.tsx`, `DashboardStatistics.tsx`, `DashboardAuditPanel.tsx`, `dashboardPerformanceAudit.ts`) ke versi R113-B. Helper dan skrip baru bersifat tambahan. Setelah rollback, tes baseline R112 harus tetap lulus.
