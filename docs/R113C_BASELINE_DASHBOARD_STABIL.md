# STABLE-DASHBOARD-R113C — Baseline Dashboard Stabil

**Ditetapkan:** 31 Oktober 2026. **Sumber:** repository setelah patch R113-C. **Baseline pendamping:** STABLE-LOGIN-GPS-R112 (tidak diubah).

## Cakupan

- Struktur `DashboardView` dan data loading R113-B/B2.
- Memoization statistik, Quick Actions, modal terbuka, dan Flash Info gestures R113-C.
- Instrumentasi diagnostik dashboard tanpa pembacaan Firebase tambahan.
- Region Vercel `sin1` dan Firestore Jakarta `asia-southeast2` mengacu pada baseline R112.

## Pengamatan yang telah dilaporkan dari HP (bukan pengukuran otomatis)

- R113-C: kerangka dashboard **289 ms**; semua sumber menerima snapshot awal **604 ms**; **11** listener aktif; **44** dokumen pada snapshot; **21** callback (cache + server mungkin menyumbang callback tambahan).
- R112 login/GPS: login rata-rata **2,15 detik** dari tiga uji HP; GPS sekitar **sedikit di atas 2 detik** sebelum pengukuran ulang R112.
- Angka di atas bukan SLA atau jaminan pada jaringan/perangkat lain. Snapshot dari cache tidak berarti pengambilan server selesai dalam waktu yang sama.

## Pemeriksaan baseline

```sh
node scripts/verify_baseline_dashboard_r113c.mjs --check
node scripts/verify_baseline_dashboard_r113c.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
```

Checksum mendeteksi **perubahan** file, bukan otomatis menilai perubahan itu salah. Bila ada perubahan yang disengaja pada file acuan, lakukan review regresi dan buat baseline baru; jangan diam-diam mengganti checksum historis. Pemeriksaan ini tidak membuat Git tag atau deployment produksi.

## Kriteria penerimaan pada HP

- Scroll dashboard stabil, navigasi Beranda/Jadwal/Presensi normal.
- Flash Info merespons geser horizontal tanpa menghalangi scroll vertikal.
- Modal guru bertugas menampilkan nama/foto yang sesuai.
- Tidak ada regresi loading dan akurasi status dashboard; login/GPS baseline tetap lulus.
