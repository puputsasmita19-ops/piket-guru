# Piket Guru R23 — Penyempurnaan Edit Bel Darurat & Pusat Komando

Tanggal: 22 Oktober 2026

## Yang baru

Pengaturan R21 tetap dipertahankan: admin dapat mengubah nama/deskripsi Pusat Komando, nama empat bel manual, pesan siaga, kontak darurat, dan SOP. Patch R23 melengkapinya dengan editor **Jadwal Bel** yang sebelumnya masih berupa tujuh contoh waktu statis.

Menu: **Administrator → Pengaturan Sekolah → Bel & Darurat → Edit Pengaturan → Jadwal Bel**.

- Tambah/hapus sesi bel (maksimal 20).
- Edit jam dalam WIB, hari berlaku, nama dan deskripsi sesi, pilihan nada, status aktif/nonaktif.
- Tolak jam di luar format HH:mm, hari kosong, dan dua bel aktif yang bentrok pada hari/jam yang sama.
- Uji dengar hanya pada perangkat yang menjalankan tombol uji.
- Perubahan disimpan di `settings/school_config.commandCenterConfig` (Firestore) melalui transaction dan role ADMIN yang sudah ada.
- Tabel Jadwal Bel dan ringkasan Pusat Komando membaca konfigurasi Firebase yang sama secara realtime.
- Bila konfigurasi lama belum berisi `scheduledBells`, tujuh sesi contoh tetap dipakai sebagai default. Tidak diperlukan migrasi.
- Sinkronisasi jadwal memakai WIB, bukan timezone perangkat.

## Batas yang penting

**Jadwal Bel di versi ini adalah jadwal referensi dengan hitung mundur, bukan pemutar otomatis.** Mengubah jam atau mengaktifkan sesi TIDAK membuat speaker sekolah, browser lain, atau sirene berbunyi otomatis. Bel hanya terdengar ketika pengguna menekan tombol Putar / Uji Suara Lokal di perangkatnya. Siaran darurat masih memerlukan aksi dan konfirmasi operator, sama seperti R21.

Tidak ada perubahan Firestore Rules, lokasi GPS, presensi, atau hak akses.

## Isi ZIP incremental

- `src/types/commandCenterConfig.types.ts`
- `src/services/firebase/schoolSettingsService.ts`
- `src/features/settings/CommandCenterSettingsCard.tsx`
- `src/features/settings/BellEmergencyAutomationCard.tsx`
- `src/features/command-center/CommandCenterPreview.tsx`
- `scripts/verify_bell_schedule_r23.cjs`
- `docs/CHANGELOG_PENGATURAN_BEL_KOMANDO_R23.md`

## Pengujian lokal

- `node scripts/verify_bell_schedule_r23.cjs` — 25/25 lulus
- `node scripts/verify_command_center_settings_r21.cjs` — 26/26 lulus
- `node scripts/verify_build_exports_r16_2.cjs` — tidak ada impor/ekspor lokal yang hilang
- `tsc --noEmit --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck src/types/commandCenterConfig.types.ts` — lulus
- `npm run lint` dan `npm run build` — **belum lulus di lingkungan ini**, karena dependensi Firebase / @types dan Vite belum terpasang. Uji di lingkungan proyek / Vercel tetap diperlukan.

## Petunjuk deploy

1. Ekstrak ZIP ke root repository lokal Piket Guru, pertahankan struktur folder.
2. Pastikan perubahannya hanya berkas tercantum.
3. Jalankan `npm ci && npm run lint && npm run build` di komputer Anda bila tersedia.
4. Commit dan Push Origin melalui GitHub Desktop, periksa deployment baru sampai Vercel `Ready`.
5. Login sebagai admin, atur satu sesi baru (sementara nonaktif), simpan, cek halaman Pusat Komando, lalu uji aktifkan/nonaktifkan dan konflik jadwal.

Perhatian: jangan memicu siaran darurat nyata untuk uji pengaturan, cukup gunakan Uji Suara Lokal.
