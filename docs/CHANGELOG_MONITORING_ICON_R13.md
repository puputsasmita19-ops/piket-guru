# Patch Ikon Monitoring Realtime Ergonomis (R13)

Tanggal: 2026-10-21

## Ringkasan
Patch ini merevisi ikon **Monitoring Piket Realtime** agar lebih ergonomis dan konsisten dengan ikon menu lain. Ikon tidak lagi dirender sebagai gambar mentah, melainkan sebagai **ikon vektor** yang mengikuti sistem ikon aplikasi.

## Perubahan utama
1. **Ikon dibuat konsisten dengan ikon aplikasi lain**
   - Komponen `RealtimeMonitorLogo` diubah dari `<img>` menjadi ikon vektor berbasis `createAppIcon`.
   - Ikon kini mengikuti `currentColor`, sehingga warna aktif/inaktif menu, hover, dan highlight akan otomatis serasi dengan menu lainnya.

2. **Nuansa visual tetap relevan**
   - Ikon baru tetap merepresentasikan monitoring realtime, dengan bentuk monitor dan garis aktivitas/pulse di dalamnya.

3. **Header dashboard diperhalus**
   - Ikon pada judul halaman monitoring juga diperbarui agar tampil seperti ikon lain, bukan seperti gambar terpisah.

## File yang berubah
- `src/components/icons/RealtimeMonitorLogo.tsx`
- `src/features/attendance/AdminAttendanceDashboard.tsx`
- `scripts/verify_monitoring_icon_ergonomic_r13.cjs`
- `docs/CHANGELOG_MONITORING_ICON_R13.md`

## Verifikasi lokal
Jalankan:

```bash
node scripts/verify_monitoring_icon_ergonomic_r13.cjs
```

Verifikasi ini memeriksa bahwa:
- ikon monitoring realtime sudah memakai `createAppIcon`,
- ikon tidak lagi memakai `<img>`,
- sidebar dan header dashboard tetap menggunakan ikon yang sama.

## Catatan
- File aset PNG sebelumnya masih boleh tetap ada di repository karena tidak mengganggu, tetapi sudah tidak dipakai oleh komponen ikon.
- Patch ini tidak mengubah menu, hak akses, data realtime, atau fitur grid/list/scroll pada dashboard monitoring.
