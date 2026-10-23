# R44 — Fix scrolling editor Bel & Darurat

## Gejala
Di Pengaturan Sekolah > Bel & Darurat, panel "Batal / Simpan Perubahan" dapat bergeser, menempel, dan menumpuk di atas keterangan jadwal bel ketika halaman digulir.

## Akar masalah
R43 menggunakan `sticky top-16 sm:top-20` untuk panel aksi di bagian atas editor. Ini berbenturan secara visual dengan header aplikasi yang juga memakai sticky dan konten formulir di bawahnya.

## Perbaikan
- Panel **Simpan Perubahan** ditempatkan **sesudah semua kolom formulir** dalam alur scroll normal, sehingga tidak lagi mengambang/menutupi konten.
- Status perubahan dan tombol **Batal/Simpan** tetap ada dengan tata letak responsif.
- Shortcut dari Pusat Komando tetap bisa membuka bagian editor, namun pergeseran fokus tidak lagi dianimasikan dengan `smooth` ketika header sticky aktif.
- Bel manual, jadwal referensi, jenis siaga, kontak/SOP, hak akses, fungsi simpan Firebase, dan proteksi data belum disimpan **tidak diubah**.

## Hanya file yang berubah
1. `src/features/settings/CommandCenterSettingsCard.tsx`
2. `scripts/verify_emergency_settings_ux_r43.cjs` (regresi R43 disesuaikan dengan perubahan desain sengaja)
3. `scripts/verify_emergency_scroll_r44.cjs`
4. `docs/CHANGELOG_BEL_DARURAT_SCROLL_R44.md`

## Pengujian lokal
```bash
node scripts/verify_emergency_scroll_r44.cjs
node scripts/verify_emergency_settings_ux_r43.cjs
npm run lint
npm run build
```

## Pengujian manual setelah deploy
- Buka **Pengaturan Sekolah > Bel & Darurat > Jadwal Bel** sebagai Admin.
- Gulir ke bawah dan ke atas berkali-kali, termasuk saat HP berorientasi potret.
- Tidak boleh ada panel Simpan yang menimpa keterangan atau daftar jadwal.
- Ubah nama sesi (tanpa memainkan sirene), gulir ke akhir, simpan, lalu cek Firebase realtime.
- Coba Batal saat ada perubahan untuk menguji konfirmasi.

Tidak ada migrasi atau perubahan Firestore Rules. Tidak menyalakan sirene saat menyimpan.
