# R113-B — Smart Dashboard Data Loading

## Dasar pengukuran R113-A (Chrome Android, 31 Oktober 2026)
- Kerangka dashboard: 287 ms.
- Snapshot pertama: 315 ms; tiga sumber inti siap: 322 ms.
- Listener aktif di DashboardView: 11.
- Dokumen snapshot: 83 = `schedules` 42, `teachers` 40, `settings/school_config` 1, dan koleksi lainnya 0 saat pengukuran.
- Angka snapshot bisa berasal dari cache, **bukan** catatan biaya baca Firestore.

## Optimasi yang diterapkan

1. **Master guru/staf untuk akun aktif saja pada dashboard awal.** Daripada subscribe koleksi `teachers` dan `staff` lengkap, query sekarang `where('userId','==', currentUser.id)` dengan cache query khusus akun. Berfungsi untuk pemetaan ID master lama (`teacher.id` / `staff.id`) ke identitas login yang digunakan oleh `isScheduleMatchingUser` dan Buku Piket pribadi. State master diikat ke UID agar snapshot dari sesi sebelumnya tidak tampil setelah pergantian akun.
2. **Master lengkap baru dibaca realtime saat modal Guru Bertugas Hari Ini/Besok dibuka**, untuk pemetaan foto pada jadwal lama. Kedua listener master lengkap dilepas saat modal ditutup. Pencarian profil pengguna tetap dibatasi per batch R92, serta baru dimulai setelah dua sumber master siap.
3. **Memoisasi roster hari ini/besok dan jadwal pribadi**, sehingga snapshot lain seperti presensi atau pengumuman tidak perlu menghitung ulang pemetaan jadwal setiap kali.
4. Label audit R113-A kini membedakan `teachers:linked`, `staff:linked` (dashboard biasa) dan `teachers:roster`, `staff:roster` (modal).

## Yang sengaja tidak diubah

- Listener `schedules` tetap mengambil koleksi lengkap (42 dokumen pada audit) karena jadwal berulang mingguan, pembatalan/pengganti bertanggal, jadwal pribadi mendatang, dan roster besok tidak bisa dipenuhi secara aman hanya dengan query `tanggal == hari_ini`.
- Listener tanggal untuk presensi, buku piket, insiden, terlambat, izin dan buku tamu tetap memakai filter tanggal.
- Backend/Firestore Rules, GPS/geofence, login PIN/rate limiter, dan Vercel region `sin1` tidak diubah.
- Tidak menambahkan query atau listener baru pada dashboard normal; dua listener master lengkap hanya saat modal dibuka.

## Ekspektasi dan batasan

- Berdasarkan dataset audit sebelumnya, jumlah dokumen snapshot *dashboard awal* berpotensi turun dari 83 ke sekitar 43–45 jika akun aktif memiliki 0–2 master yang terhubung, **bukan jaminan**. Jumlah dokumen nyata bergantung pada UID dan cache.
- Kecepatan dashboard 287–322 ms saat R113-A sudah sangat baik; target R113-B adalah efisiensi pembacaan, bukan menjanjikan lebih cepat dari angka itu.
- Pada pembukaan modal pertama, foto avatar mungkin menyusul setelah dua master terbaca; daftar nama dan tugas tetap langsung tersedia.
- Query equality `userId` memakai indeks field tunggal Firestore standar; jika proyek menonaktifkan indeks otomatis untuk field itu, periksa indeks di konsol Firebase sebelum deployment.

## Penerapan

1. Pastikan kode sebelumnya telah menerapkan baseline R112 dan patch R113-A.
2. Ekstrak ZIP incremental R113-B ke root repository, menimpa file yang sesuai.
3. Jalankan:

```bash
node scripts/test_r113b_smart_dashboard_loading.mjs
node scripts/test_r113a_dashboard_performance_audit.mjs
node scripts/test_r92_roster_lazy_avatar.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
npm ci
npm run lint
npm run build
```

4. Deploy ke **Vercel Preview** dan uji memakai akun Guru dan Admin: dashboard, jadwal pribadi hari ini/besok/mendatang, modal Guru Bertugas Hari Ini/Besok, foto avatar legacy, dan perubahan realtime jadwal. Tutup modal, pastikan listener master penuh berhenti.
5. Pada HP, buka `https://piket-guru-ashen.vercel.app/?dashboard_diag=1`, login, salin ringkasan. Seharusnya ada baris `teachers:linked` dan `staff:linked` untuk dashboard normal; baris `teachers:roster` dan `staff:roster` baru bertambah saat modal dibuka.
6. Bila ada gangguan mapping jadwal guru legacy, rollback file R113-B ke versi R113-A (tanpa mengubah baseline login/GPS), kemudian telusuri nilai `userId` di master yang berkaitan. Jangan mengganti Firestore Rules atau menghapus data.

## Validasi lokal

- `test_r113b_smart_dashboard_loading.mjs`: 29/29 lulus.
- `test_r113a_dashboard_performance_audit.mjs` (adaptasi pemeriksaan listener modal bersyarat): 19/19 lulus.
- `test_r92_roster_lazy_avatar.mjs`: 25/25 lulus.
- Pemeriksaan baseline R112: 20/20 checksum dan 13/13 skrip regresi lulus.
- `npm run lint` gagal di lingkungan paket ini karena `node_modules` React/Firebase dan dependensi proyek lain belum terpasang. Tes berbasis `esbuild`/browser dan build Vercel perlu dijalankan di environment dengan `npm ci`.
