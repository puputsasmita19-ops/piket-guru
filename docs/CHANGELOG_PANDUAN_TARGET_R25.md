# Patch Panduan Penggunaan R25

Tanggal: 2026-10-22

## Ringkasan
Patch ini memperbaiki panduan interaktif agar **bagian yang dijelaskan benar-benar terlihat** pada desktop maupun mobile.

## Masalah yang diperbaiki
1. **Desktop langkah "Saat internet terputus"**
   - Sebelumnya ikon koneksi di header tidak ikut masuk area sorot, sehingga pengguna tidak tahu bagian mana yang sedang dijelaskan.

2. **Mobile langkah "Kamera Swafoto"**
   - Saat tombol swafoto tidak tampil (misalnya setelah presensi masuk), panduan tidak memberi penunjuk visual yang cukup.

3. **Mobile langkah "Saat internet terputus"**
   - Ikon koneksi di header atas belum mendapat sorotan yang jelas.

## Perubahan utama
- Target panduan kini **mendukung elemen di header** seperti ikon koneksi.
- Ikon koneksi ditargetkan langsung ke **tombol header**, bukan hanya pembungkusnya.
- Langkah **Swafoto** kini memiliki target cadangan yang tetap terlihat:
  - tombol swafoto,
  - area swafoto,
  - area aksi presensi,
  - status presensi selesai.
- Elemen target diberi atribut `data-guide-active-target="true"` selama langkah aktif.
- Ditambahkan **sorotan langsung pada elemen target** berupa ring dan animasi halus, sehingga target lebih mudah dikenali.
- Teks panduan kini menjelaskan secara eksplisit **bagian yang sedang disorot**.

## File yang berubah
- `src/components/guide/InteractiveGuideTour.tsx`
- `src/index.css`
- `scripts/verify_guide_targets_r25.cjs`
- `docs/CHANGELOG_PANDUAN_TARGET_R25.md`

## Verifikasi lokal
Jalankan:

```bash
node scripts/verify_guide_targets_r25.cjs
```

## Catatan
Patch ini hanya memperbaiki perilaku panduan visual. Mekanisme presensi, GPS, data offline, Firebase realtime, dan hak akses tidak diubah.
