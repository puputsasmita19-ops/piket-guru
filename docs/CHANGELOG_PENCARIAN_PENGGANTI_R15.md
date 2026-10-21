# Perbaikan Pilihan Petugas Pengganti R15

Tanggal: 21 Oktober 2026

## Masalah
Pada form **Guru Piket Berhalangan Mendadak**, pilihan **Petugas Pengganti** menggunakan elemen `<select>` bawaan. Di Android, daftar nama panjang membuka pemilih hampir seluruh layar tanpa kolom pencarian, sehingga sulit menemukan guru tertentu.

## Perbaikan
- Diganti menjadi komponen `SearchableSelect` yang **sudah digunakan** pada fitur guru inval lainnya.
- Setelah mengetuk Petugas Pengganti, muncul dialog dengan kolom pencarian dan daftar yang dapat di-scroll pada mobile/desktop.
- Pencarian mendukung nama (termasuk nama parsial), role, ID login, NIP, dan NUPTK jika tersedia.
- Nama pengguna dan role ditampilkan terpisah agar lebih mudah dibaca pada layar kecil.
- Opsi **Belum ada — Menunggu Pengganti** dipertahankan.
- Saat proses menyimpan, pemilih dinonaktifkan.
- Filter pengguna aktif, aturan role, validasi bentrok, penyimpanan realtime, serta hak akses admin tetap memakai implementasi R14.

## Isi ZIP incremental
- `src/features/attendance/DutyCoverageDialog.tsx` — satu-satunya file aplikasi yang dimodifikasi.
- `scripts/verify_duty_replacement_search_r15.cjs` — verifikasi lokal.
- `docs/CHANGELOG_PENCARIAN_PENGGANTI_R15.md` — catatan perubahan.

Tidak diperlukan migrasi Firestore atau perubahan Firebase Rules.

## Pengujian
- `node scripts/verify_duty_replacement_search_r15.cjs`
- `node scripts/verify_duty_coverage_round14.cjs` (jika script R14 telah tersedia di repository)
- `npm run lint`
- `npm run build`

**Catatan:** Pemeriksaan terarah berbasis source dan simulasi layanan tidak menggantikan uji interaksi langsung pada browser Android. Uji form pada perangkat mobile setelah Vercel Ready.
