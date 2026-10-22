# Piket Guru R27 — Pengaturan per fitur Bel & Darurat

Tanggal: 22 Oktober 2026

## Tujuan
Menyatukan pintasan pengaturan dengan setiap kartu darurat dan memudahkan admin menyesuaikan isi serta petunjuk operasional untuk tiap jenis kejadian. Perubahan tidak menyalakan sirene, mengubah Firebase Rules, atau menjadwalkan siaran darurat.

## Fitur baru
1. Pengaturan per kejadian untuk **Gempa Bumi**, **Kebakaran / Asap**, **Siaga Keamanan**, **Evakuasi**, dan **Siaran Khusus**:
   - Nama tombol siaga
   - Deskripsi singkat pada kartu
   - Judul dan pesan siaran yang diusulkan dalam dialog konfirmasi
   - Checklist singkat untuk operator sebelum mengonfirmasi siaran
   - Kontak rujukan (menggunakan empat kontak resmi yang dapat diedit pada tab Kontak & SOP)
2. Setiap kartu siaga memiliki tombol **Atur** khusus admin yang membawa pengguna ke bagian pengaturan kejadian terkait.
3. Jadwal bel memiliki tombol **Atur Jadwal** yang membuka editor masing-masing sesi (jam WIB, hari, nada, nama, aktif/nonaktif); fungsi ini tetap referensi, bukan bel otomatis.
4. Dialog *Tinjau Siaga* kini menampilkan checklist dan kontak rujukan, tanpa melakukan panggilan otomatis. Aksi **Siarkan Sekarang Juga** tetap terpisah dan eksplisit.
5. Konfigurasi lama otomatis mendapatkan nilai bawaan untuk semua bidang baru; perubahan yang disimpan admin disinkronkan menggunakan `SchoolSettingsService.saveCommandCenterConfig` dengan transaksi, role ADMIN, dan catatan audit seperti R21/R23.

## File yang diperbarui (incremental)
- `src/types/commandCenterConfig.types.ts`
- `src/features/settings/CommandCenterSettingsCard.tsx`
- `src/features/settings/BellEmergencyAutomationCard.tsx`
- `src/features/settings/SettingsView.tsx`
- `scripts/verify_emergency_controls_r27.cjs`
- `scripts/verify_command_center_settings_r21.cjs` (penyesuaian pemeriksaan regresi lama)
- `docs/CHANGELOG_BEL_DARURAT_PER_FITUR_R27.md`

## Verifikasi lokal
- `node scripts/verify_emergency_controls_r27.cjs` — 26/26 lulus.
- `node scripts/verify_command_center_settings_r21.cjs` — 26/26 lulus.
- `node scripts/verify_bell_schedule_r23.cjs` — 25/25 lulus.
- `node scripts/verify_build_exports_r16_2.cjs` — 409 file, 3049 impor lokal lulus.
- `npm run lint` — dicoba, gagal karena dependensi tidak terpasang lengkap (`firebase`, `@types/node`, dll).
- `npm run build` — dicoba, gagal karena `vite` tidak ditemukan di lingkungan pengujian.

## Cara pemakaian
1. Masuk menggunakan akun Administrator.
2. Buka **Pengaturan Sekolah → Bel & Darurat**.
3. Pada kartu darurat, ketuk **Atur**; editor akan membuka jenis kejadian tersebut. Atau gunakan **Atur Jadwal** untuk bel.
4. Sesuaikan nilai dengan kondisi sekolah. Periksa kontak dan SOP bersama penanggung jawab sekolah.
5. Klik **Simpan Semua Pengaturan**. Menyimpan konfigurasi tidak mengaktifkan siaran.
6. Untuk siaran nyata, operator masih perlu membuka **Tinjau Siaga**, memeriksa arahan, lalu menekan **Siarkan Sekarang Juga** secara sadar.

> Penting: Simulasikan dengan membaca konfigurasi / uji suara lokal pada perangkat sendiri. Jangan menekan **Siarkan Sekarang Juga** di lingkungan produksi untuk sekadar mencoba editor.
