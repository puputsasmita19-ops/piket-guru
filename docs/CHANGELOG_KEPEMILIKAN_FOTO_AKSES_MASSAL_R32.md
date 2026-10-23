# Piket Guru R32 — Kepemilikan Data, Foto Kejadian, Hak Akses Massal

## Ringkasan

1. **Hak edit untuk catatan operasional**
   - ID akun Firebase (`pelaporId`, `petugasId`, `petugasPiketId`, `authorId`, atau `createdById`) menjadi identitas penanggung jawab yang tidak bisa diganti oleh pengguna biasa.
   - Akun pencatat asli dan ADMIN dapat mengedit data. Pengguna lain tetap dapat *membaca* data sesuai hak akses masing-masing, tanpa tombol edit.
   - Berlaku pada Laporan Kejadian, Buku Piket, Buku Tamu, Siswa Terlambat, Izin Siswa, Guru Pengganti/Inval, Pengumuman, dan koleksi `documents`.
   - Master jadwal, pengguna, guru, siswa, ruang, dan pengaturan sekolah tetap dikelola Admin sebagaimana sebelumnya. Presensi GPS sudah memakai aturan pemilik/ADMIN.
   - Persetujuan Buku Piket oleh koordinator yang sudah diizinkan tetap bisa dilakukan, tetapi hanya boleh mengubah status persetujuan/catatan revisi, tidak isi laporan.
   - Arsip lama tanpa ID pemilik yang dapat diverifikasi **tetap hanya dapat diubah ADMIN**. Identitas berdasarkan kesamaan nama tidak diizinkan untuk menghindari pengambilan alih data.
   - Penulisan terbaru mempertahankan ID pemilik dan metadata pencipta saat edit, sekalipun Admin mengoreksi.

2. **Foto Laporan Kejadian pada HP**
   - Tampilan detail foto menggunakan `object-contain` dan tinggi gambar natural, bukan `object-cover` dengan batas tinggi.
   - Area pratinjau dapat digulir secara vertikal. Watermark/keterangan di bawah foto tidak terpotong oleh crop.

3. **Manajemen hak akses massal khusus ADMIN**
   - `Master Pengguna → Akun & Pengguna → Hak Akses Massal`.
   - Cari/pilih beberapa akun; pilih izin dan tindakan `Tambahkan` atau `Cabut`.
   - Pengaturan mempertahankan izin lain, tidak mengubah role atau identitas akun.
   - Per akun dilakukan transaksi Firestore membaca izin terkini, menulis perubahan dan audit pada satu transaksi.
   - Akun ADMIN, diri sendiri, akun nonaktif, dan pemilik wildcard `*` dikecualikan dari perubahan massal.
   - Izin efektif juga dipengaruhi oleh default role. Pencabutan izin eksplisit bukan selalu pencabutan akses yang diberikan oleh role bawaan.
   - Untuk keamanan, hak untuk mengelola pengguna, pengaturan sistem, dan backup tidak tersedia dalam menu massal (tetap dari editor individual Admin).

## Penting: aturan Firebase wajib di-deploy tersendiri

**Push GitHub / deployment Vercel hanya mengubah frontend dan API. Ia TIDAK menerapkan `firestore.rules`.**

Dari folder project lokal dan Firebase CLI yang terhubung ke project yang benar, jalankan:

```bash
npm ci
node scripts/verify_data_ownership_r32.cjs
npm run lint
npm run build
firebase login
firebase use
firebase deploy --only firestore:rules
```

Periksa ID proyek Firebase sebelum mengirim Rules. `firebase use` menampilkan project aktif; bila belum terkonfigurasi, gunakan `firebase deploy --only firestore:rules --project <ID_PROJECT_FIREBASE>`. **Jangan deploy rules ke project berbeda.**

Uji pada project staging atau akun uji lebih dulu: A membuat catatan, B tidak dapat mengedit catatan A, ADMIN dapat mengoreksi; pastikan approver Buku Piket masih dapat memverifikasi tanpa mengedit isi. Uji fitur presensi/QR dan screenshot foto sebelum go-live. Tidak ada migrasi otomatis data.

**Status pengujian lokal:** pengujian source R32 terarah lulus. Regresi R28 (26 pemeriksaan), R29 (28), dan R31 lulus. Lint/build penuh tidak dapat diselesaikan di lingkungan ini karena dependensi NPM tidak tersedia di cache (`npm ci --offline` gagal), sehingga Vercel dan Firebase Emulator masih harus diverifikasi.
