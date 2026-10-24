# Piket Guru R66 — Layout Rekap Foto dalam PDF

Tanggal: 24 Oktober 2026.

## Masalah
Foto dan keterangan pada lampiran Rekap Foto PDF kurang seimbang, terutama di mode 4 foto per halaman. Pengukuran lama memakai tinggi keterangan tetap (19 mm), tidak menyesuaikan judul, identitas, tanggal, serta petugas.

## Perbaikan
- Mengukur jumlah baris keterangan dengan font PDF sebelum menempatkan foto.
- Menyediakan area foto yang menyesuaikan ukuran keterangan, dengan proporsi asli gambar (contain) dan pembatas tipis antarfoto.
- Foto dan keterangan tetap berada dalam satu kartu; keterangan yang sangat panjang memberikan pesan solusi (pilih 2 foto) alih-alih tumpang tindih.
- Halaman terakhir menggunakan jumlah baris sesuai foto yang tersisa, bukan dua baris kosong pada mode 4-up.
- Default menjadi **2 foto per halaman** agar mudah dibaca; **4 foto per halaman** masih tersedia sebagai opsi ringkas.
- Penanda teks `Layout R66` muncul pada penjelasan di modal Pratinjau Dokumentasi Foto.
- Tetap menghormati kop, margin, orientasi, ukuran kertas, logo, tanda tangan, penomoran, tanggal, dan pemfilteran yang sudah ada.
- Tidak mengubah foto di Google Drive, data Firestore, hak akses, atau fungsi laporan lainnya.

## File yang berubah
- `src/utils/reportPdf.ts`
- `src/features/reports/PhotoRecapPrintModal.tsx`
- `scripts/verify_photo_recap_r66.cjs` (baru)
- `docs/CHANGELOG_REKAP_FOTO_R66.md` (baru)

## Instalasi
1. Repository Piket Guru telah menggunakan R65.
2. Ekstrak **isi** ZIP R66 ke root repository, jangan memasukkan folder `R66` tambahan. Timpa file pada path yang sama.
3. Di GitHub Desktop, wajib terlihat dua file `src/utils/reportPdf.ts` dan `src/features/reports/PhotoRecapPrintModal.tsx` sebagai `Modified` (jika belum dikomit).
4. Jalankan dari root repository: `node scripts/verify_photo_recap_r66.cjs`, `npm run lint`, dan `npm run build`.
5. Commit, Push origin, cek Vercel Ready lalu masuk Laporan & Rekap > Rekap Foto > Pratinjau.
6. Pastikan penjelasan `Layout R66` terlihat. Coba PDF 2 foto dan 4 foto per halaman menggunakan teks singkat/panjang, orientasi tegak dan mendatar, serta tanda tangan aktif/nonaktif.
7. Jika kode laporan Anda telah dimodifikasi secara mandiri sejak R57, bandingkan diff sebelum menimpa file. File sumber untuk patch ini berasal dari source arsip yang tersedia, bukan clone R65 produksi.

## Pengujian
- 26/26 pemeriksaan sintaks dan geometri generator pada mock PDF lulus: containment foto, posisi keterangan, 2/4 foto, halaman terakhir, tanda tangan, kasus deskripsi panjang.
- Tidak ada pengujian end-to-end jsPDF pada browser, build Vercel, Firebase produksi, atau printer nyata. `npm run lint/build` harus diperiksa di repository lengkap pengguna.
