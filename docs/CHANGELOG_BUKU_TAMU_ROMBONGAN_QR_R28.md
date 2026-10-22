# Piket Guru — R28: Buku Tamu Rombongan, Badge Otomatis, dan QR Mandiri

**Tanggal:** 22 Oktober 2026  
**Bentuk pembaruan:** ZIP incremental (hanya file baru/diubah)

## 1. Alur registrasi oleh petugas

1. Masuk melalui akun staff yang memiliki akses Buku Tamu.
2. Pilih **Buku Tamu → Catat Tamu Masuk**.
3. Isi **Nama Lengkap Tamu** pertama. Jika rombongan, pilih **+ Tambah Anggota** untuk menambahkan nama kedua dan seterusnya (maksimal 12 orang, termasuk tamu pertama).
4. Lengkapi instansi/asal, kategori, tujuan, dan keperluan. Nomor badge tidak dapat diketik manual.
5. Pilih **Check-In & Berikan Badge**.
6. Backend membuat **satu data kunjungan per orang** dan menerbitkan nomor badge unik secara atomik. Contoh untuk 22 Oktober 2026: `TAMU-20261022-0001`, `TAMU-20261022-0002`, dan seterusnya. Urutan di-reset per tanggal, tetapi format tanggal menjaga keunikan lintas hari.
7. Tiap nama memiliki nomor badge dan status check-out sendiri di daftar Buku Tamu. Label rombongan ditampilkan di kartu/tabel. Jika ada foto pengunjung yang diambil, bukti foto disimpan hanya untuk tamu utama.

**Jika offline:** data tetap mengikuti antrean/draf sebelumnya, tetapi nomor badge belum resmi terbit sampai sinkronisasi online berhasil. Jangan menyerahkan nomor badge sementara.

## 2. Alur QR untuk tamu mandiri

1. Petugas membuka **Buku Tamu → QR Tamu Mandiri & Verifikasi**.
2. Pilih **Buat QR Registrasi**. QR berlaku **8 jam**, dibuat sepenuhnya secara lokal dari tautan sesi server (tidak menggunakan layanan pembuat QR eksternal).
3. Tamu memindai QR melalui kamera ponsel dan mengisi formulir mandiri tanpa akun/login: satu atau beberapa nama, instansi, kategori, tujuan, WhatsApp (opsional), dan keperluan.
4. Pendaftaran muncul pada panel **Menunggu Verifikasi** untuk petugas; belum menjadi kunjungan resmi dan tidak mendapatkan badge otomatis.
5. Petugas memeriksa identitas secara langsung, kemudian memilih **Terima & Terbitkan Badge** atau **Tolak**. Penerimaan menulis record per orang dan mengalokasikan nomor badge dalam transaksi Firestore yang sama; daftar Buku Tamu diperbarui melalui listener realtime yang sudah ada.

**Pembatasan keamanan:**
- QR hanya dapat diterbitkan oleh akun petugas aktif yang tervalidasi melalui Firebase ID Token pada server.
- URL QR berisi token acak dan tidak mengandung informasi identitas tamu.
- Pendaftaran QR publik hanya dapat masuk melalui API backend ke koleksi privat `visitorSelfCheckinRequests`. Formulir tidak dapat membaca atau mengubah database tamu secara langsung.
- Token QR valid 8 jam, dibatasi 80 pendaftaran per sesi serta maksimal 6 per menit. Saat penuh/kedaluwarsa, petugas membuat QR baru.
- Hanya akun petugas aktif dapat membuka antrean dan menerima/menolak registrasi; seluruh persetujuan menggunakan transaksi backend.
- Data isian QR tidak dilog dalam request logger API.
- Tidak ada perubahan `firestore.rules`; koleksi teknis baru hanya ditulis/dibaca melalui Admin SDK backend yang sudah digunakan oleh sistem autentikasi.

## 3. File yang berubah/ditambahkan

- `src/types/visitor.types.ts`
- `src/utils/visitorRegistrationUtils.ts` (baru)
- `src/utils/visitorQrSvg.ts` (baru, kode QR lokal dengan atribusi MIT dari QRCode Kazuhiko Arase)
- `src/server/routes/visitorRegistrationRoutes.ts` (baru)
- `src/server/app.ts`
- `src/services/firebase/visitorService.ts`
- `src/features/visitors/VisitorFormModal.tsx`
- `src/features/visitors/VisitorPreview.tsx`
- `src/features/visitors/VisitorSelfCheckinPanel.tsx` (baru)
- `src/features/visitors/PublicVisitorCheckin.tsx` (baru)
- `src/App.tsx`
- `scripts/verify_visitor_registration_r28.cjs` (baru)
- `docs/CHANGELOG_BUKU_TAMU_ROMBONGAN_QR_R28.md` (baru)

## 4. Pemeriksaan yang telah dilakukan

- Pemeriksaan sintaks 11 file source yang diubah.
- Pemeriksaan helper nomor urut, format badge, batas maksimal jumlah rombongan, dan duplikasi nama.
- Struktur endpoint: registrasi petugas dengan transaksi nomor urut, QR terbatas, antrean privat, serta persetujuan petugas.
- QR yang dibuat berhasil dibaca kembali oleh OpenCV dengan URL yang persis sama.
- Pemeriksaan ekspor/impor lokal: 414 file source dan 3.061 nama impor/ekspor tersambung.

**Batas pengujian:** `npm run lint` dan `npm run build` penuh belum lulus di lingkungan ini karena dependensi NPM tidak terpasang lengkap. Pengujian transaksi Firestore nyata, ketahanan terhadap beban tinggi, dan deployment Vercel produksi **belum dilakukan**.

## 5. Langkah instalasi & penerimaan

1. Ekstrak patch R28 **ke root repository lokal**, timpa sesuai struktur folder.
2. Jalankan `npm ci`, `node scripts/verify_visitor_registration_r28.cjs`, `npm run lint`, lalu `npm run build` pada komputer yang memiliki akses NPM.
3. **Commit → Push origin** lewat GitHub Desktop, tunggu deployment Vercel **Ready**.
4. Pada data percobaan, uji satu tamu lalu satu rombongan (dua atau tiga orang), periksa nomor badge berurutan dan unik.
5. Buka dua akun petugas di perangkat berbeda untuk mencoba penyimpanan bersamaan dan pastikan nomor badge tidak ganda.
6. Buat QR lalu scan dengan HP yang belum login. Kirim data uji; pastikan **menunggu verifikasi**, kemudian uji **Terima** dan **Tolak**.
7. Uji link QR setelah kedaluwarsa dan pastikan tidak dapat digunakan lagi.
8. Pastikan hasil rekapan, status check-out, dan cetak badge per orang sesuai sebelum menggunakannya secara luas.

## 6. Lisensi komponen QR

Sebagian implementasi `src/utils/visitorQrSvg.ts` diadaptasi dari **QRCode for JavaScript** oleh **Kazuhiko Arase (2009)**, berlisensi MIT (http://www.d-project.com/; https://opensource.org/licenses/MIT). Tidak memerlukan CDN atau NPM tambahan. Simpan atribusi ini ketika mendistribusikan source.
