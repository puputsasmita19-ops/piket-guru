# Piket Guru R62 — Fix Terpotong di Form Buku Siswa Terlambat Mobile

## Kegagalan yang diperbaiki

Pada gambar masalah, teks nama, status jam tiba, serta panel penyesuaian terlihat terpotong dari sisi kiri. Ini dapat terjadi jika kontainer formulir modal bisa bergeser secara horizontal, meski kartu sudah dibenahi pada R61. Dropdown pencarian pada layar sempit juga mudah tertutup oleh kontainer scroll.

## R62

- Batasi `app-form-fields` untuk **form siswa terlambat saja** dengan CSS yang tidak memengaruhi modal lain. `width/max-width:100%`, `min-width:0`, `box-sizing:border-box`, dan `overflow-x:hidden`.
- Pada pergantian siswa atau expand/collapse panel, posisikan `scrollLeft = 0` untuk area picker, bidang form dan body modal, tanpa mengubah posisi scroll vertikal.
- Pada mobile, hasil pencarian menggunakan posisi normal (tidak absolute) sehingga tidak terpotong oleh area scroll modal.
- Ubah baris pilihan siswa dari `<div onMouseDown>` menjadi `<button type=button onClick>`, dapat disentuh, digunakan keyboard, dan tidak melakukan submit form.
- Nama siswa, kelas, dan identitas orang tua dalam hasil pencarian dapat membungkus baris.
- Kartu siswa terpilih dan tombol Foto / Atur / Hapus dibatasi ke lebar perangkat; tombol minimal 44px di layar sempit.
- Tidak mengubah penghitungan keterlambatan, upload foto, presensi, Firestore Rules, penyimpanan batch, draf offline, atau akses pengguna.

## Instalasi setelah R61 dan verifikasi R60

1. Ekstrak isi ZIP di **root repository Piket Guru**, jangan pada `src` langsung. Berkas CSS baru harus berada di `src/features/student-tardiness/StudentTardyMobileR62.css`.
2. GitHub Desktop → Repository → Open in Terminal.
3. `node scripts/apply_r62_mobile_student_picker.cjs --dry-run` — harus menampilkan **R62 DRY RUN PASSED** sebelum diterapkan.
4. `node scripts/apply_r62_mobile_student_picker.cjs` — memodifikasi hanya `src/features/student-tardiness/StudentTardyFormModal.tsx`.
5. `npm ci` (jika dependency belum terpasang), lalu `node scripts/test_r62_mobile_student_picker.cjs`, `npm run lint`, dan `npm run build`.
6. Jika lulus, GitHub Desktop Commit & Push, lalu Vercel Ready.
7. Uji viewport 320/360/390/430 piksel: ketik siswa bernama panjang, pilih, expand Atur, isi jam tiba individual, ambil foto, tutup, pilih lagi, hapus, simpan batch data uji. Pastikan sisi kiri dan kanan terlihat utuh serta tidak perlu geser horizontal.

Jika muncul **R62 STOPPED SAFELY**, *jangan* memaksa atau menimpa komponen dengan versi lama; kirim file `src/features/student-tardiness/StudentTardyFormModal.tsx` dari repository saat ini untuk patch yang sesuai. Skrip tidak menulis perubahan parsial.

## Validasi

Patcher dan tes struktur diuji pada fixture R61 yang tersedia; belum teruji terhadap source R61 produksi atau perangkat fisik. Build penuh tidak dapat diverifikasi tanpa instalasi dependency lengkap.
