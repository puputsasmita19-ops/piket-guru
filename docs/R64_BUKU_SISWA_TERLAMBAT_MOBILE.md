# R64 — Perbaikan kartu siswa terpilih (tidak terpotong di HP)

Tanggal: 24 Oktober 2026. Berlaku pada source Piket Guru asli atau yang sudah menerima R61, R62, atau R63 **selama pola komponen belum berubah**.

## Penyebab yang paling mungkin

Screenshot HP terbaru memperlihatkan **tombol kamera, sesuaikan, dan hapus masih sebaris dengan status**. Ini adalah struktur tampilan **sebelum R61**. Versi R63 seharusnya menunjukkan badge kecil `R63` setelah "Daftar Siswa Terpilih" tetapi badge itu **tidak ada dalam screenshot terbaru**. Belum terbukti bahwa source R63 benar-benar sudah terbawa ke hasil build atau diterima PWA di HP.

Pada source asli, `.overflow-y-auto` dalam daftar siswa menjadikan overflow-x efektif `auto` juga. Konten header dengan banyak tombol memiliki lebar intrinsik melebihi kartu. Browser kemudian dapat menggulir **horizontal di dalam daftar** saat tombol difokuskan. Akibatnya awal nama dan status terpotong dari kiri dan tombol mengambang keluar. Bukan bug lebar modal semata.

## Isi perbaikan

- Struktur JSX untuk kartu terpilih diubah ke tiga baris terpisah: identitas, status + frekuensi, tombol Foto / Atur / Hapus. Semua handler tetap digunakan.
- Menghapus `overflow-y-auto` dan tinggi maksimum dari daftar pilihan siswa **hanya di form ini**; scroll vertikal mengikuti formulir induk. Menghindari scroll horizontal tersembunyi.
- Setiap nama dapat membungkus; tombol dipastikan 44 px, 3 kolom sama lebar di HP.
- Efek scrollLeft=0 terbatas pada elemen pemilih dan daftar siswa ketika memilih/expand siswa.
- Penanda versi `R64` permanen di dekat teks "Daftar Siswa Terpilih" untuk pemeriksaan deployment/PWA.
- Tidak mengubah data atau backend Firebase, presensi, validasi keterlambatan, hak akses, upload foto, dan fitur di menu lain.

## Pemasangan wajib, jangan lewati langkah patcher

1. Ekstrak ZIP ke **root repo yang sedang digunakan untuk Vercel**. Jika file bernama `.zip` hanya di-commit ke GitHub, kode aplikasinya **tidak berubah**.
2. Untuk Windows, Anda bisa **klik dua kali `APPLY-R64-WINDOWS.cmd`** dari root repository. File tersebut menjalankan dry-run, pemasangan, dan tes otomatis. Atau gunakan perintah Node berikut bila ingin menjalankan manual. Pastikan file CSS berada di `src/features/student-tardiness/`.
3. Jalankan di root repo:

```sh
node scripts/r64_fix_student_card.cjs --dry-run
node scripts/r64_fix_student_card.cjs
node scripts/test_r64_mobile_tardy.cjs
npm run lint
npm run build
```

4. GitHub Desktop → **Changes** HARUS memperlihatkan **`src/features/student-tardiness/StudentTardyFormModal.tsx`** sebagai file **Modified** dan `StudentTardyMobileR64.css` sebagai file **Added**, selain skrip/dokumen. Jika TSX tidak terlihat berubah, **JANGAN PUSH**; patch belum diaplikasikan atau dilakukan di repo/folder berbeda.
5. Setelah semua tes lulus, commit dan Push origin. Verifikasi URL/branch/commit deployment Vercel cocok dengan repository yang Anda push. Tunggu Vercel `Ready`.
6. Di HP, buka ulang tab/PWA. Perbarui PWA bila ada notifikasi; bila perlu tes melalui tab samaran baru (tanpa menghapus cache/data antrean offline). Jangan sembarang menghapus data situs karena draf offline mungkin masih belum sinkron.
7. **Tulisan `R64` HARUS TERLIHAT** di samping judul "Daftar Siswa Terpilih". Jika tidak ada, HP masih memakai UI lama/branch berbeda, atau file TSX tidak masuk build. Jangan membuat patch CSS baru sebelum masalah deployment ini diselesaikan.
8. Uji di layar 320/360/390 px: siswa bernama panjang; status panjang; 2–5 siswa; Foto, Atur, Hapus; panel Jam Tiba Individual; Simpan dengan data uji. Pastikan tidak ada konten awal yang menghilang.

## Batas pengujian

Pengujian kode dilakukan pada source arsip lama dan contoh hasil patch R61–R63 yang tersedia. **Belum dijalankan terhadap repo Vercel aktual** karena repo setelah R63 tidak terlampir dalam percakapan ini. Patcher sengaja berhenti jika pola source tidak sama. Pengujian visual yang menyertai paket memakai mock statis, bukan aplikasi React produksi. `npm run lint` dan `npm run build` harus dijalankan di repository terbaru yang dependensinya lengkap sebelum push.

## Kalau masih bermasalah

Jika `R64` tampil tetapi terpotong, kirim **tiga file aktual** dari repository Anda: `src/features/student-tardiness/StudentTardyFormModal.tsx`, `src/index.css`, dan `src/components/common/DialogForm.tsx` plus screenshot terbaru. Jika `R64` tidak tampil, kirim screenshot halaman Vercel Deployment yang menunjukkan commit SHA dan GitHub Desktop Changes, sehingga masalah jalur deploy dapat diperiksa dulu.
