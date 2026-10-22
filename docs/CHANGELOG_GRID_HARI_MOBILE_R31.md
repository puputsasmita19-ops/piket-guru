# Piket Guru R31 — Grid Pilihan Hari pada Mobile

22 Oktober 2026

## Tujuan
Pada layar HP, tujuh tombol pilihan hari sekarang langsung terlihat tanpa menggeser ke kiri/kanan. Tampilan desktop tetap berbentuk baris mendatar.

## Perubahan
- Mobile (< 768 piksel): 4 hari pada baris pertama (Senin–Kamis), 3 hari pada baris kedua (Jumat–Minggu).
- Setiap tombol memiliki area tekan setinggi 56 piksel.
- Nama hari tetap lengkap, jumlah jadwal tetap terlihat, dan hari ini ditandai dengan label kecil **HARI INI**.
- Hari yang dipilih memiliki warna berbeda dengan `aria-pressed` bagi aksesibilitas dan indikator fokus keyboard.
- Tidak ada perubahan pada pembacaan realtime, query Firestore, status jadwal, role, ataupun logika memilih tanggal dari R30.

## Isi patch incremental
- `src/features/schedules/SchedulePreview.tsx` — komponen yang diperbaiki.
- `scripts/verify_schedule_day_grid_r31.cjs` — pemeriksaan source dan pembagian tombol.
- `docs/CHANGELOG_GRID_HARI_MOBILE_R31.md` — catatan perubahan ini.

## Pemeriksaan
```bash
npm ci
node scripts/verify_schedule_day_grid_r31.cjs
node scripts/verify_schedule_mobile_r30.cjs
npm run lint
npm run build
```

Jika semua berhasil, Commit lalu Push melalui GitHub Desktop dan periksa Vercel sampai Ready.

**Batas pengujian:** Pemeriksaan source / viewport tidak menggantikan pengujian langsung di HP. Build/lint penuh harus dijalankan pada lingkungan dengan dependensi terpasang.
