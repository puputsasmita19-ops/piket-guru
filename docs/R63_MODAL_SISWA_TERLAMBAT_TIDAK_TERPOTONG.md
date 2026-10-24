# Piket Guru R63 — Perbaikan final modal Buku Siswa Terlambat (mobile)

## Alasan R61/R62 tampak belum berhasil

Screenshot yang dilampirkan memperlihatkan tombol foto, penyesuaian, dan hapus masih sebaris dengan teks status. Padahal source R61 yang tersedia sudah memisahkan ketiga aksi tersebut ke baris sendiri. Ini mengindikasikan screenshot berasal dari tampilan lama atau HP masih memakai cache PWA lama; **tidak cukup bukti untuk menyatakan deployment R62 sudah terlihat di perangkat**.

Selain itu, R62 masih mengizinkan dua area gulir vertikal: `app-form-fields` dan `r62-tardy-selected-list`. Scroll focus dan lebar modal yang tidak eksplisit dapat membuat konten kartu terpotong atau sulit dijangkau pada perangkat tertentu.

## Apa yang dilakukan R63

1. Perluasan API komponen `Modal` dengan prop `className?`, **tanpa mengubah styling modal lain**.
2. Form Buku Siswa Terlambat memasang `className="r63-tardy-dialog"` pada Modal pertama saja.
3. Di mobile, modal memenuhi lebar dan tinggi layar, dengan header dan footer tetap terlihat.
4. Daftar Siswa Terpilih tidak lagi mempunyai scrollbar vertikal tersendiri; `app-form-fields` adalah satu-satunya area konten yang bergulir secara vertikal.
5. Pengaman scroll horizontal hanya pada form dan elemen terkait; gulir vertikal dan fokus form tetap dipertahankan.
6. Badge kecil `R63` ditampilkan di bawah tulisan **Daftar Siswa Terpilih** agar mudah memastikan PWA sudah memuat UI terbaru.
7. Fungsi foto, atur individual, hapus, pencarian, perhitungan, dan simpan batch tidak dimodifikasi.

## Berkas di ZIP

- `scripts/apply_r63_fullwidth_tardy.cjs`: memasang perubahan ke file TSX terbaru bila cocok.
- `scripts/r63_mobile_tardy_transform.cjs`: transformasi file yang diaudit; menolak pola berbeda.
- `scripts/test_r63_fullwidth_tardy.cjs`: regresi struktur dan sintaks.
- `src/features/student-tardiness/StudentTardyMobileR63.css`: CSS khusus modal.
- `docs/R63_MODAL_SISWA_TERLAMBAT_TIDAK_TERPOTONG.md`: dokumen ini.

## Petunjuk pemasangan sesudah R62

1. Salin ZIP ke root repo Piket Guru. Jangan timpa TSX dengan sumber R62 lama.
2. Dari GitHub Desktop buka terminal dan jalankan:
   ```bash
   node scripts/apply_r63_fullwidth_tardy.cjs --dry-run
   node scripts/apply_r63_fullwidth_tardy.cjs
   npm ci
   node scripts/test_r63_fullwidth_tardy.cjs
   npm run lint
   npm run build
   ```
3. Jangan push jika `R63 STOPPED SAFELY`, lint atau build gagal.
4. Commit semua file hasil perubahan, termasuk **`src/components/common/Modal.tsx`** dan **`src/features/student-tardiness/StudentTardyFormModal.tsx`**, selain CSS, skrip, dan dokumen.
5. Push origin, periksa deployment Vercel **Ready**. Di HP tutup aplikasi/PWA, buka ulang, dan gunakan tombol **Perbarui** jika tersedia.
6. Buka Buku Siswa Terlambat dan pilih siswa. **Pastikan label `R63` terlihat** pada header Daftar Siswa Terpilih. Jika tidak, perangkat belum membuka UI baru (cache PWA atau deploy belum benar).
7. Uji lebar 320/360/390/430 piksel, scroll daftar 5+ siswa, Atur, Foto, Hapus, Jam Tiba Individual, dan simpan menggunakan data uji.

## Pengujian yang dilakukan

- Instalasi melalui patcher pada salinan R62 yang tersedia: berhasil; parsing TSX Modal + Form: lulus; pemasangan kedua ditolak.
- Simulasi tata letak Chromium: viewport 320, 360, 390, 430, 768 px tanpa elemen keluar dari layar, saat panel penyesuaian dibuka. **Ini simulasi tata letak, bukan build aplikasi lengkap.**
- Build penuh repository pengguna dan uji HP nyata **belum dilakukan**. Repository R62 terbaru yang sedang berjalan di Vercel tidak tersedia di sesi ini; patcher akan menolak jika source berbeda.

## Apabila setelah R63 masih terpotong

Jika badge R63 muncul namun isi tetap terpotong, ambil screenshot baru **yang menampilkan tepi kiri dan kanan layar secara utuh** beserta model HP / versi browser, dan lampirkan berkas `src/features/student-tardiness/StudentTardyFormModal.tsx`, `src/components/common/Modal.tsx`, dan `src/index.css` terbaru. Ini diperlukan untuk membedakan bug CSS build aktual dari masalah cache atau viewport perangkat.
