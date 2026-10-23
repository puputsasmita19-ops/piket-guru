# R43 — Pengaturan Bel & Darurat: Alur Admin yang Lebih Jelas

## Masalah
- Enam tab dalam satu baris membutuhkan scroll horizontal dan tidak menunjukkan fungsi masing-masing.
- Formulir tampil dalam kondisi nonaktif, sehingga admin bingung apakah data bisa diedit.
- Tombol edit berada terpisah dari pilihan kategori; Simpan di ujung bawah formulir panjang.
- Tombol operasional darurat dan pengaturan kurang jelas pemisahannya.

## Perbaikan
- Ringkasan enam kategori dalam kartu klik langsung, dengan deskripsi tindakan pada masing-masing kategori.
- Formulir baru ditampilkan setelah kategori dipilih; tidak lagi menampilkan formulir nonaktif.
- Saat edit, selector kategori dalam grid desktop dan dropdown mobile, tidak scroll horizontal.
- Header kategori, tombol kembali, indikator perubahan belum disimpan, dan panel Simpan Perubahan/ Batal yang sticky.
- Peringatan sebelum membuang perubahan dan sebelum menutup tab browser saat ada perubahan belum disimpan.
- Bagian uji/operasional darurat dipisahkan dari pengaturan dengan penjelasan siaran nyata.
- Tetap terhubung dengan tautan pintas Atur dari kartu siaga dan jadwal bel.
- Tidak mengubah Firebase, payload konfigurasi, aturan autentikasi, nilai bawaan atau izin broadcast.

## Berkas
- `src/features/settings/CommandCenterSettingsCard.tsx`
- `src/features/settings/SettingsView.tsx`
- `scripts/verify_emergency_settings_ux_r43.cjs`
- `docs/CHANGELOG_BEL_DARURAT_UX_R43.md`

## Pengujian
- `node scripts/verify_emergency_settings_ux_r43.cjs`
- `node scripts/verify_command_center_settings_r21.cjs`
- `node scripts/verify_emergency_controls_r27.cjs`
- `node scripts/verify_command_center_custom_r39.cjs`
- `npm ci && npm run lint && npm run build` di lingkungan dengan dependensi lengkap.

## Catatan keselamatan
- Menekan tombol **Simpan Perubahan** hanya menyimpan konfigurasi; bukan menjalankan siaran.
- Fitur operasional darurat tetap memerlukan otorisasi dan konfirmasi asli; hindari uji aktivasi massal di sekolah yang sedang aktif.
