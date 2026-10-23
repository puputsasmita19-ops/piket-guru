# R45 — Perapihan UI Logo, Shortcut Mobile, dan Header Pusat Komando

Tanggal: 2026-10-24

## Perubahan
1. **Logo aplikasi diperbarui**
   - Mengganti `public/icon.svg` dengan logo modern-minimalis yang lebih jelas saat tampil di tab browser.
   - Menyamakan fallback logo di header, login, preview branding, dan layar kiosk agar konsisten dengan tema modern soft UI.

2. **Icon/logo visual disesuaikan dengan tema**
   - Penyempurnaan gaya ikon header modul melalui `src/modern-soft.css` agar tampil lebih modern, minimalis, dan selaras dengan tampilan baru.

3. **Shortcut mobile dibuat lebih efisien**
   - Memperkecil tinggi tile, padding, radius, dan jarak antar kartu pada dashboard mobile.
   - Tujuan: tampilan lebih ergonomis dan tidak terlalu boros ruang.

4. **Tombol "Edit Bel & Komando" diperjelas**
   - Menambahkan tombol putih yang kontras di header Pusat Komando.
   - Tombol hanya tampil untuk admin/kepala sekolah dan akan membuka tab pengaturan Bel.

5. **Header Pusat Komando diperkaya**
   - Judul dan deskripsi sekarang membaca konfigurasi yang tersimpan.
   - Menampilkan badge lokasi posko/komando bila tersedia.

## File yang diubah
- `public/icon.svg`
- `src/components/layout/Header.tsx`
- `src/features/auth/LoginPage.tsx`
- `src/features/settings/SettingsView.tsx`
- `src/features/kiosk/PublicKioskDisplay.tsx`
- `src/features/command-center/CommandCenterPreview.tsx`
- `src/modern-soft.css`
