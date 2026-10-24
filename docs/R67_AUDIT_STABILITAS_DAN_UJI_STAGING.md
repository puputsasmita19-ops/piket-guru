# Piket Guru R67 — Audit awal stabilitas, bug multi-klik, dan rencana pengujian banyak pengguna

**Basis perubahan langsung:** `StudentTardyFormModal.tsx` yang berasal dari paket R65 dan dilaporkan berhasil diterapkan. R66 mengubah modul laporan foto terpisah; paket ini tidak menyentuh file R66.

## Perbaikan yang terbukti dapat diterapkan sekarang

1. **Pemilihan siswa dobel ketika jaringan lambat:** simpan ID siswa yang sedang diambil frekuensinya dalam `pendingStudentIdsRef` (synchronous guard) dan periksa kembali `prev` sebelum menambah.
2. **Double-submit online dan offline dari satu tab/perangkat:** `submitInFlightRef` menolak klik ganda selama penyimpanan, tanpa mengubah mekanisme `batchRequestId`/antrian lama.
3. **Respons frekuensi terlambat:** cegah callback modal lama menambahkan siswa setelah dialog ditutup; tangani perubahan tanggal sambil membaca jumlah terlambat; saat refresh frekuensi selesai jangan menimpa daftar siswa yang dihapus atau kustomisasi yang diubah setelah permintaan dimulai.
4. **Error koneksi tidak tertangani:** tangkap error saat memuat master siswa dan saat memperbarui frekuensi bulanan. Data pengguna, dokumen sekolah, dan Firestore Rules tidak diubah.
5. **Visibilitas versi:** ganti badge R65 menjadi `R67` pada form yang sama, sehingga perubahan yang benar-benar ter-deploy bisa dicek melalui HP.

## Risiko prioritas tinggi yang BELUM dapat dinyatakan selesai

- **Duplikasi dua perangkat untuk siswa dan tanggal yang sama.** Pada arsip source lama, `saveBatchTardyStudents()` memanggil `getForDates()` lalu mengecek `existingRecords.find()` sebelum membuat ID dokumen dari `batchRequestId + studentId`. Dua perangkat dengan batch ID berlainan dapat membaca kondisi kosong pada waktu yang sama, kemudian membuat dua ID berbeda. Perbaikan UI R67 tidak mencegah kondisi ini. Backend/Roles terkini harus diuji di Firestore Emulator dan desain *unique key* siswa+tanggal atau transaksi pengunci harus diverifikasi sebelum produksi.
- **Cross-device presensi masuk/pulang, saldo antrean offline, pergantian sesi:** belum diuji dengan source backend R66 terkini dan Firestore Rules aktif.
- **Read/write Firebase dan beban 50 pengguna nyata:** simulasi localhost R60 tidak setara dengan tes Vercel/Firebase staging. Belum ada bukti latency produksi, p95, kuota/billing, ataupun Core Web Vitals aktual.
- **Build lengkap:** tidak dapat dijalankan terhadap repository R66 terbaru di lingkungan pembuat karena source lengkap, lockfile dan dependensi production tidak tersedia.

## Pengujian yang sudah dijalankan di lingkungan pembuat

- 13/13 pengujian perilaku R67 pada fungsi TSX yang benar-benar diambil dari file source; uji double-tap, error/retry, form session stale, tanggal berubah, dan ganda online/offline.
- 26/26 pengujian sintetis R66 generator PDF dari paket terpisah.
- 20/20 diagnostik R60, 5/5 probe kesehatan, 7/7 ringkasan log.
- Simulasi R60 dengan 50 pengguna sintetis pada **server tiruan lokal**: 100 operasi logis, 200 permintaan klien, 0 kegagalan final, 0 operasi duplikat pada mock. Ini bukan sertifikasi Firebase produksi.

## Pengujian lokal Windows sebelum push

1. Cadangkan/commit R66 terakhir di GitHub Desktop; simpan semua draft offline penting.
2. Salin isi ZIP R67 ke root repository `piket-guru`; **hanya** `StudentTardyFormModal.tsx` menggantikan file aplikasi yang ada. Bandingkan perubahan di GitHub Desktop sebelum Commit.
3. Pastikan proyek memiliki `package-lock.json`. Buka CMD di root dan jalankan `npm ci` jika dependensi belum terpasang.
4. Jalankan `RUN_R67_CHECK_WINDOWS.cmd`, atau `node scripts/check_r67_local.cjs`. Pengecekan R67, regresi R66 bila tersedia, `npm run lint`, dan `npm run build` **harus semuanya lulus**.
5. Jika gagal, hentikan push dan periksa pesan error. Jangan ganti aturan Firebase atau menghapus IndexedDB untuk memperbaiki error build.

## Uji staging — wajib sebelum menyatakan siap multi-user

- Gunakan proyek Firebase **staging terpisah** dan Vercel Preview; jangan pakai akun/berkas anak sekolah asli. Seed minimal 50 pengguna sintetis dan data uji.
- **A: 20 guru login bersama**: autentikasi tidak looping, salah role tetap ditolak; periksa log error API/Vercel.
- **B: 50 guru presensi masuk dan pulang** pada tanggal/jadwal uji; tidak boleh ada dua presensi aktif untuk akun yang sama dan hari sama; timestamp akurat.
- **C: dua perangkat mencatat keterlambatan untuk siswa uji yang sama, tanggal sama, detik sama**; idealnya hanya satu catatan dan upaya kedua ditolak/dianggap idempotent. Jika muncul dua catatan: STOP, perbaiki backend transaksi atau aturan unique-key sebelum produksi.
- **D: offline → online**: simpan laporan dan foto dengan gangguan jaringan berulang, akun beralih, dua tab, klik cepat; tidak boleh kehilangan data atau ada duplikasi.
- **E: hak akses**: Guru tidak dapat mengubah catatan Guru lain, Admin dapat koreksi dengan audit. Jalankan Firebase Emulator menggunakan Rules aktual staging.
- **F: media & laporan**: upload foto 10–30 KB thumbnail profil dan dokumentasi, buka Rekap Foto R66 2-up/4-up, ekspor PDF dengan keterangan panjang.
- **G: UI mobile**: layar 320, 360, 390, 430 px untuk formulir R67 dan navigasi; jangan ada kartu terpotong atau scroll horizontal.
- **H: stabilitas**: log gagal/sukses, HTTP 429/5xx, latensi p50/p95, jumlah Firebase reads/writes, konsentrasi API requests, jumlah listener aktif, serta error JS.

## Kriteria GO/NO-GO

- **GO untuk pilot staging** hanya jika lint, build, tes R67/R66, auth/firestore rules, dan tes server terintegrasi lulus.
- **GO untuk produksi dengan beban tinggi** hanya jika skenario staging di atas lolos dan hasil monitoring error/performa terdokumentasi.
- **NO-GO** jika terdapat duplikasi lintas perangkat, kehilangan antrean, pelanggaran role, gagal build, atau foto privat bisa diakses tanpa izin.

## Catatan penting

R67 adalah perbaikan terarah untuk source nyata modul formulir yang telah diterima, **bukan klaim bahwa seluruh 200+ berkas repository R66 sudah diaudit atau bebas bug**. Untuk audit menyeluruh, diperlukan ZIP source repository terbaru (tanpa `.env`, JSON kunci service account, PIN atau data siswa) sehingga build, rules emulator, server routes, dan uji integrasi bisa dikerjakan pada satu revision yang konsisten.
