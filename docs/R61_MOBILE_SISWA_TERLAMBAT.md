# Piket Guru R61 — Perbaikan Input Buku Siswa Terlambat (Mobile)

24 Oktober 2026. Fokus: kenyamanan input layar kecil (320–390 px) berdasarkan screenshot pemilihan siswa.

## Masalah pada source acuan

Kartu siswa terpilih menempatkan nama, identitas kelas/ortu, teks status yang dapat panjang, badge frekuensi, dan tombol foto/atur/hapus dalam satu layout `flex` horizontal. Tombol dapat terjepit, teks terpotong, dan sulit disentuh di HP. Panel individual juga terlalu sempit karena daftar dibatasi `max-h-72`.

## Perbaikan R61

- Nama dan kelas/nomor orang tua pada baris informasi yang dapat dibungkus, bukan satu baris panjang.
- Status keterlambatan (termasuk ketika jam belum dipilih) dipindahkan ke baris badge fleksibel; `Ke-1` tetap di sebelahnya bila muat.
- Tombol **Foto**, **Atur**, **Hapus** tampil dengan label jelas dan area sentuh minimum 44px. Desktop tetap memakai tata letak horizontal dengan tombol tidak melebar.
- `Atur` menampilkan penyesuaian individu dengan header yang bisa membungkus, tombol Reset yang mudah ditekan, serta input jam/alasan/pembinaan berukuran minimal 44px.
- Daftar siswa menggunakan scroll vertikal terbatas 62% tinggi viewport pada mobile agar kartu yang dibuka tidak langsung terlalu pendek dan tidak menimbulkan scroll horizontal.
- Form utama diberi ukuran dan celah aman pada HP. Heading batas jam tidak lagi dipaksakan satu baris.
- Tidak mengubah nama fungsi handler, state, validasi keterlambatan, foto bertanda watermark, save batch, Firebase Rules, offline queue, atau hak akses.

## Pemasangan (basis R60 yang sudah diterapkan)

Berkas dari ZIP ini adalah **patcher dan pengujian saja**, bukan pengganti keseluruhan source usang. Pastikan ZIP diekstrak dari root GitHub repository dengan struktur `scripts/...` dan `docs/...` yang sama.

1. GitHub Desktop: **Repository > Open in Terminal** pada root `piket-guru`.
2. Jalankan `node scripts/apply_r61_mobile_tardy.cjs --dry-run`.
3. **Hanya jika** muncul `R61 DRY RUN PASSED`, jalankan `node scripts/apply_r61_mobile_tardy.cjs`.
4. Jalankan `npm ci` jika perlu, `node scripts/test_r61_mobile_tardy.cjs`, `npm run lint`, `npm run build`.
5. Buka GitHub Desktop: periksa perubahan. Seharusnya hanya `src/features/student-tardiness/StudentTardyFormModal.tsx` (selain file baru skrip/docs). Commit lalu Push dan pastikan Vercel Ready.
6. Pada HP atau simulasi viewport 320, 360, 390, 430px: buka **Buku Siswa Terlambat**, pilih nama siswa panjang, coba badge tanpa waktu dan dengan waktu, Foto, Atur, Reset, Hapus, pilih beberapa siswa, lalu validasi konfirmasi dan simpan satu data uji.
7. Periksa mobile horizontal scroll: seluruh tombol Foto/Atur/Hapus harus muat dalam kartu dan tidak ada scrollbar horizontal modal. Input jam individual, alasan dan pembinaan harus dapat disentuh tanpa harus zoom.

## Pengaman

Patcher menghitung SHA-256 **hanya pada header kartu acuan**. Jika kode R60 asli Anda sudah berbeda pada bagian itu, patcher menolak seluruh perubahan dengan `R61 STOPPED SAFELY`; **jangan** menyalin source lama untuk memaksanya. Upload satu file `StudentTardyFormModal.tsx` terbaru agar saya dapat menyusun penyesuaian tanpa kehilangan perubahan yang telah Anda terapkan.

Patcher tidak mengedit file saat `--dry-run`, mempersiapkan seluruh konten sebelum menulis, dan menolak penerapan ulang.

## Hasil verifikasi lokal

- R61 pada source acuan lama: `29/29` pengujian integrasi struktur dan parsing TSX.
- `--dry-run` dan pemasangan pada fixture kompatibel: lulus.
- Pemasangan ulang: ditolak dengan aman.
- Perbedaan header acuan: dihentikan dengan aman (uji fixture).
- Belum melakukan `npm ci`/lint/build menyeluruh pada **repository R60 terbaru**. Tidak ada pengukuran interaksi HP fisik maupun Firebase produksi. Jangan menyatakan semua regresi lulus sampai diuji pada repository Anda.
