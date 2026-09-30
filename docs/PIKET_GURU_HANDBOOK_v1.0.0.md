# BUKU PANDUAN UTAMA (MASTER HANDBOOK)
# PIKET GURU DIGITAL SEKOLAH v1.0.0

*Aplikasi Manajemen Jadwal, Presensi Geofence, Buku Piket Digital, dan Administrasi Ketertiban Sekolah Terpadu*

---

## DAFTAR ISI
1. Tentang Aplikasi
2. Tujuan Pengembangan
3. Fitur Utama Sistem
4. Peran Pengguna (User Roles)
5. Panduan Singkat Administrator
6. Panduan Singkat Kepala Sekolah
7. Panduan Singkat Guru Piket
8. Panduan Singkat Tenaga Kependidikan
9. Standar Operasional Presensi
10. Standar Operasional Pengelolaan Buku Piket
11. Standar Operasional Backup & Restore
12. Panduan Troubleshooting & Penanganan Error
13. Arsitektur Struktur Database
14. Matriks Otorisasi RBAC
15. Sistem Keamanan & Kriptografi
16. Status Integrasi Google Drive
17. Ringkasan Konfigurasi Produksi
18. Catatan Perilisan (Changelog)
19. Keterbatasan Sistem (Known Limitations)
20. Kontak Administrator & Dukungan Teknis

---

## 1. TENTANG APLIKASI
**Piket Guru Digital v1.0.0** adalah platform tata kelola kedinasan piket sekolah berbasis web modern yang mentransformasikan pembukuan jurnal piket fisik menjadi sistem digital yang aman, transparan, dan akuntabel. Aplikasi ini mengintegrasikan presensi berbasis titik koordinat GPS (*Geofencing*), swafoto wajah anti-kecurangan, buku tamu digital, penanganan siswa terlambat, sirine kedaruratan, hingga pengesahan bertingkat langsung oleh pimpinan sekolah.

---

## 2. TUJUAN PENGEMBANGAN
1. **Meningkatkan Disiplin & Akuntabilitas**: Memastikan kehadiran fisik guru di pos piket sesuai alokasi waktu dan radius sekolah.
2. **Efisiensi Administrasi**: Menghilangkan tumpukan buku jurnal kertas yang rentan hilang, rusak, atau terlambat diarsipkan.
3. **Penyajian Data Waktu Nyata (Real-Time)**: Memberikan Kepala Sekolah visibilitas langsung terhadap dinamika KBM dan ketertiban sekolah hari ini.
4. **Kepatuhan Audit & Kearsipan**: Menyediakan rekam jejak digital forensik (*immutable audit trail*) yang memenuhi standar pelaporan dinas pendidikan.

---

## 3. FITUR UTAMA SISTEM
* **Presensi Geofence & Kamera Swafoto**: Validasi jarak radius 100m dari gerbang sekolah dan potret selfie terkompresi otomatis.
* **Buku Piket Digital (5 Tahapan Formal)**: Siklus validasi berjenjang: *Draft ➔ Diajukan ➔ Diverifikasi ➔ Disetujui ➔ Dikunci (Arsip Permanen)*.
* **Pusat Komando & Bel Sekolah Digital**: Sintesis audio Web Audio API untuk bel sekolah 3 nada harmonik (Masuk, Istirahat, Pulang) dan panel alarm darurat.
* **Mode Kiosk TV Display**: Papan informasi layar penuh otomatis rotasi untuk Smart TV di lobi utama sekolah.
* **Administrasi Piket Lengkap**: Buku Tamu Digital, Izin Keluar Siswa, Siswa Terlambat, dan Penugasan Guru Inval.
* **Laporan & Ekspor Serbaguna**: Cetak lembar dinas bertandatangan resmi, ekspor Excel (.xls), CSV ber-BOM UTF-8, dan JSON.
* **Pencadangan Bencana (Disaster Recovery)**: Backup 1-klik untuk 16 koleksi Firestore ke berkas arsip terenkripsi.

---

## 4. PERAN PENGGUNA (USER ROLES)
Sistem memiliki 4 peran operasional utama:
1. **ADMIN**: Pemegang otoritas tertinggi konfigurasi sistem, geofence, manajemen pengguna, dan pencadangan.
2. **KEPALA_SEKOLAH**: Otoritas pengawasan eksekutif, verifikator akhir jurnal piket, dan pengesahan laporan dinas.
3. **GURU**: Pelaksana piket, presensi GPS, pengisian jurnal, pencatatan insiden, dan monitoring KBM.
4. **TENAGA_KEPENDIDIKAN**: Staf pelaksana gerbang/lobi, presensi, buku tamu digital, dan siswa terlambat.

---

## 5. PANDUAN ADMINISTRATOR
* **Login**: Masukkan NIP `198503152010011002`, PIN `123456`.
* **Master Data**: Kelola data Guru, Staf, Ruangan/Pos, dan Kategori Kejadian.
* **Jadwal Piket**: Susun penugasan mingguan dengan perlindungan *Conflict Detection* (mencegah bentrok guru/ruang).
* **Buka Gembok (Unlock Journal)**: Buka kembali jurnal berstatus `DIKUNCI` dengan kewajiban mengisi alasan forensik.
* **Pencadangan**: Lakukan unduh cadangan database mingguan melalui menu *Pengaturan ➔ Pencadangan*.

---

## 6. PANDUAN KEPALA SEKOLAH
* **Login**: Masukkan NIP `197605122000032001`, PIN `123456`.
* **Monitoring Kehadiran**: Pantau ketepatan waktu guru piket dan foto kehadiran fisik.
* **Pengesahan Jurnal**: Buka menu *Buku Piket*, tinjau jurnal berstatus `DIAJUKAN`, lalu klik tombol hijau **Setujui Jurnal**. Dokumen otomatis menjadi arsip permanen.
* **Cetak Laporan**: Buka menu *Laporan*, pilih rentang bulan berjalan, lalu klik **Cetak Laporan** untuk lembar dinas resmi.

---

## 7. PANDUAN GURU PIKET
* **Login**: Masukkan NIP Guru (contoh: `199008212015022003`), PIN `123456`.
* **Presensi Masuk**: Tiba di sekolah, buka menu *Presensi*, klik tombol hijau **Presensi Masuk**, ambil swafoto wajah, dan konfirmasi.
* **Mengisi Jurnal**: Pada akhir shift, isi 5 parameter kondisi sekolah di menu *Buku Piket*, lalu klik **Ajukan Jurnal**.
* **Presensi Pulang**: Buka menu *Presensi*, klik tombol biru **Presensi Pulang**.

---

## 8. PANDUAN TENAGA KEPENDIDIKAN
* **Login**: Masukkan NIP Staf (contoh: `198902142014031002`), PIN `123456`.
* **Buku Tamu**: Catat tamu masuk dengan identitas dan keperluan, klik *Check-Out* saat tamu meninggalkan sekolah.
* **Siswa Terlambat**: Catat nama siswa di gerbang, catat alasan dan pembinaan awal, lalu klik *Izinkan Masuk Kelas*.

---

## 9. STANDAR OPERASIONAL PRESENSI
* **Radius Geofence**: Maksimal 100 meter dari titik tengah koordinat sekolah.
* **Algoritma**: *Haversine Formula* menghitung kelengkungan bumi untuk menghasilkan jarak meter aktual.
* **Swafoto**: Wajib menyertakan wajah petugas; berkas otomatis dikompresi kanvas ke ukuran < 100 KB.

---

## 10. STANDAR OPERASIONAL PENGELOLAAN BUKU PIKET
* **Siklus Status**: `DRAFT` ➔ `DIAJUKAN` ➔ `DIVERIFIKASI` ➔ `DISETUJUI` ➔ `DIKUNCI`.
* **Proteksi Kepemilikan**: Guru hanya dapat menyunting draft yang ditugaskan kepada dirinya.
* **Integritas Arsip**: Setelah disetujui Kepala Sekolah, data menjadi *Read-Only* permanen.

---

## 11. STANDAR OPERASIONAL BACKUP & RESTORE
* **Pencadangan**: Dilakukan rutin setiap Jumat sore dan akhir bulan ke format `.json`.
* **Pemulihan (Restore)**: Dilakukan saat keadaan darurat; sistem memvalidasi skema berkas sebelum menyuntikkan dokumen ke Firestore.

---

## 12. PANDUAN TROUBLESHOOTING & PENANGANAN ERROR
* **Lupa PIN**: Hubungi Admin untuk reset PIN 6 digit ke nilai awal (`123456`).
* **Akun Terkunci (5x Salah)**: Tunggu 15 menit masa lockout berakhir.
* **GPS Di Luar Radius**: Pastikan HP berada di lingkungan sekolah dan peramban telah diberikan izin lokasi (*Allow Location*).
* **Kamera Gagal Dibuka**: Gunakan tombol alternatif *"Pilih Foto dari Perangkat"*.

---

## 13. STRUKTUR DATABASE (16 KOLEKSI UTAMA)
Basis data Firestore menampung: `settings`, `users`, `teachers`, `staff`, `rooms`, `incidentCategories`, `schedules`, `attendance`, `dutyBooks`, `incidents`, `documents`, `announcements`, `studentTardiness`, `substitutions`, `studentPermits`, `visitors`, dan `auditLogs`.

---

## 14. MATRIKS OTORISASI RBAC
Hak akses dikendalikan secara ketat pada 4 tingkatan peran melalui fungsi otorisasi `checkUserPermission` di lapisan antarmuka dan interseptor rute.

---

## 15. SISTEM KEAMANAN & KRIPTOGRAFI
* **Hashing Kredensial**: Menggunakan *Salted SHA-256* dengan nilai salt heksadesimal 16 karakter unik.
* **Immutable Audit Trail**: Aturan Firestore mengunci koleksi `auditLogs` (`allow update, delete: if false;`), menjamin jejak aktivitas tidak dapat dimusnahkan.

---

## 16. STATUS INTEGRASI GOOGLE DRIVE
* **Status Saat Ini**: *Tidak ditemukan dalam source code — perlu dikonfirmasi oleh administrator.*
* **Penanganan Media**: Berkas gambar diproses kanvas off-screen dan disimpan dalam bentuk Base64 Data URI terkompresi di Firestore.

---

## 17. KONFIGURASI PRODUKSI
* **Stack**: TypeScript, React 19, Vite, Tailwind CSS v4, Google Cloud Firestore.
* **PWA**: Didukung Service Worker (`sw.js`) dan Web App Manifest (`manifest.json`).

---

## 18. CATATAN PERILISAN (CHANGELOG)
* Rilis v1.0.0 resmi diluncurkan pada 30 September 2026 setelah melewati audit keamanan, perbaikan celah permission, kompresi kanvas, dan uji regresi 44 skenario dengan tingkat kelolosan 100%.

---

## 19. KETERBATASAN SISTEM (KNOWN LIMITATIONS)
1. Integrasi Google Drive belum terhubung melalui OAuth API otomatis.
2. Fitur kamera dan lokasi mewajibkan koneksi aman (HTTPS / SSL).
3. Akurasi sinyal satelit GPS menurun pada ruangan tertutup beton tebal.

---

## 20. KONTAK ADMINISTRATOR & DUKUNGAN TEKNIS
* **Administrator IT Sekolah**: Ruang Pusat Data & Server / Tata Usaha
* **Surel Resmi IT**: `it-support@sekolah.sch.id`
* **Layanan WhatsApp Bantuan**: `0812-3456-7890` (Jam Dinas: 06.30 – 16.00 WIB)
