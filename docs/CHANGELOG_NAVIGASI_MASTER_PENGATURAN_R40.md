# Piket Guru R40 — Navigasi Master Data & Pengaturan Sekolah

Tanggal: 23 Oktober 2026

## Tujuan
Menghilangkan kebutuhan menggeser kategori ke samping pada tampilan Admin desktop, dan menjaga navigasi tetap nyaman di layar mobile.

## Perubahan

### Master Data & Pengguna
- Kategori Master Data menjadi grid responsif: 2 kolom di HP, 3 di tablet, 4 di desktop lebar.
- Semua 8 kategori tersedia langsung. Nama panjang boleh membungkus, tidak dipotong.
- Angka jumlah data, ikon, dan penanda kategori aktif dipertahankan.
- Tombol utama **Akun & Pengguna / Master Data & Audit** diperbaiki agar tidak berhimpitan di HP.

### Pengaturan Sekolah
- Header dan navigasi dibuat menempati baris terpisah agar ruang kategori tidak sesak.
- Desktop/tablet: semua kategori tampil dalam grid 3, 4, atau 5 kolom menurut lebar layar. Tidak ada scroll horizontal untuk memilih kategori.
- Mobile: tersedia pilihan kategori native yang ringkas dan mudah disentuh; semua kategori tetap dapat diakses.
- Satu konfigurasi dipakai untuk pilihan mobile dan grid desktop, sehingga nama, urutan, dan pembatasan kategori khusus Admin tidak berbeda.
- Panel pengaturan, aksi Simpan, dan kebijakan hak akses tidak diubah.

## Berkas yang berubah
- `src/features/master/MasterDataTabs.tsx`
- `src/features/users/UsersPreview.tsx`
- `src/features/settings/SettingsView.tsx`
- `scripts/verify_navigation_layout_r40.cjs`
- `docs/CHANGELOG_NAVIGASI_MASTER_PENGATURAN_R40.md`

## Pemeriksaan
Setelah `npm ci`, jalankan:

```bash
node scripts/verify_navigation_layout_r40.cjs
npm run lint
npm run build
```

Pemeriksaan script adalah pengujian statis dan sintaks, bukan pengganti uji visual aktual atau build produksi. Setelah pemasangan, cek kedua menu pada Android serta desktop, dan pastikan tab khusus Admin tetap tidak muncul untuk non-Admin.

Tidak ada perubahan API, Firestore Rules, data sekolah, atau skema database.
