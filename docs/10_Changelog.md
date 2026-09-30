```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                         Dokumen: 10 — CHANGELOG
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 10_Changelog
* **Klasifikasi**: INTERNAL
* **Penanggung Jawab**: Tim Pengembang & QA Engineer

---

# PIKET GURU CHANGELOG

## v1.0.1 (Stable Patch & Bug Fix Release) — 2026-09-30

### Fixed
* **BUG-001 (Pusat Notifikasi & Bel Sekolah)**:
  - Menambahkan fitur interaktif "Tandai Semua Dibaca" dan penandaan individual per butir notifikasi.
  - Menambahkan tombol pratinjau "Uji Nada Bel Sekolah" langsung dari dropdown notifikasi.
* **BUG-002 (Jadwal Multi-Petugas)**:
  - Menambahkan tombol aksi langsung `+ Jadwal Multi-Petugas` pada bilah utama Jadwal Piket.
  - Memungkinkan alokasi banyak guru sekaligus pada hari yang sama dengan antarmuka checklist guru terpadu dan bulk saving Firestore.
* **BUG-003 (Responsivitas GPS Presensi)**:
  - Mengoptimasi `LocationService.getCurrentPosition` dengan progressive fallback 2000ms dan cache koordinat terakhir akurat.
  - Mengeliminasi jeda panjang saat memperbarui koordinat GPS presensi masuk.
* **BUG-004 (Database Siswa Terintegrasi)**:
  - Menampilkan tab `Data Siswa` secara penuh pada Master Data (NISN, Nama, Kelas, Gender, Kontak Ortu, Alamat, Status).
  - Menyediakan modal Tambah & Edit Siswa serta fitur auto-fill instan pada Formulir Siswa Terlambat dan Izin Keluar Sekolah.
* **BUG-005 (Pengaturan Izin & Hak Akses Spesifik Admin)**:
  - Memperbaiki persistensi izin khusus akun pada `StoredUserCredential` di Firestore dan modul otentikasi.
  - Menambahkan `PERMISSION_ALIAS_MAP` pada `checkUserPermission` sehingga konfigurasi hak akses granular oleh admin berfungsi 100%.
* **BUG-006 (Fitur Edit & Hapus Tenaga Kependidikan)**:
  - Menambahkan tombol Edit dan Hapus pada setiap baris data staf di tab Tenaga Kependidikan.
  - Menyediakan modal edit data staf lengkap dengan pencatatan jejak audit.
* **BUG-007 (Fitur Edit & Hapus Kategori Kejadian)**:
  - Menambahkan tombol Edit dan Hapus pada kartu Kategori Kejadian.
  - Menyediakan modal edit kategori insiden lengkap dengan tingkat keparahan (severity).
* **BUG-008 (Rentang Jam Awal & Akhir Shift Masuk/Pulang)**:
  - Menambahkan konfigurasi rentang presensi masuk (Jam Awal Buka & Jam Akhir Batas Masuk) dan rentang presensi pulang (Jam Awal & Jam Akhir) pada `SchoolSettings.workHours`.
* **BUG-009 (Akses Menu Saat Offline)**:
  - Memperbarui Service Worker (`sw.js`) dengan strategi runtime asset caching dan fallback SPA route offline.
  - Menambahkan indikator visual status jaringan Realtime Online / Offline (Lokal) pada Header aplikasi.

---

## v1.0.0 (Production Release) — 2026-09-30

### Added
* **Presensi Geofence GPS & Swafoto**:
  - Deteksi lokasi waktu nyata berbasis HTML5 Geolocation API dengan validasi radius toleransi 100 meter (*Haversine Formula*).
  - Kompresi foto kanvas off-screen otomatis (< 100 KB) untuk swafoto masuk dan kepulangan.
* **Alur Kerja Buku Piket Digital (5 Tahapan Formal)**:
  - Siklus status formal: `DRAFT` ➔ `DIAJUKAN` ➔ `DIVERIFIKASI` ➔ `DISETUJUI` ➔ `DIKUNCI`.
  - Formulir evaluasi komprehensif mencakup 5 parameter: Keamanan, Kebersihan, Ketertiban Kelas, Fasilitas, dan Siswa.
* **Pusat Komando & Bel Sekolah Digital**:
  - Simulator bel sekolah 3 nada harmonik berbasis *Web Audio API Oscillator* (Masuk, Istirahat, Pulang) tanpa berkas audio eksternal.
  - Panel tombol siaga darurat sekolah terdistribusi real-time.
* **Mode Kiosk TV Display**:
  - Tampilan layar penuh lobi otomatis rotasi per 8 detik dengan ticker teks pengumuman berjalan.
* **Modul Administrasi Piket Terintegrasi**:
  - Buku Tamu Digital dengan fitur check-in dan check-out.
  - Pencatatan Siswa Terlambat dan penerbitan izin masuk kelas.
  - Surat Izin Siswa Meninggalkan Sekolah.
  - Penugasan Guru Pengganti / Inval.
* **Pencadangan & Pemulihan Bencana (Disaster Recovery)**:
  - Pembuatan cadangan 1-klik untuk 16 koleksi database Firestore ke berkas JSON terstruktur.
  - Validasi integritas skema dan pemulihan data otomatis.
* **PWA & Dukungan Offline**:
  - Service worker caching (`sw.js`) dan web manifest untuk instalasi di perangkat seluler.

### Fixed
* **Pencegahan Galat Hak Akses Firestore (`Missing or insufficient permissions`)**:
  - Menghapus aturan otentikasi anonim yang tidak didukung dan menyelaraskan validasi tingkat aplikasi yang aman dan stabil.
* **Penyimpanan Foto Resolusi Tinggi**:
  - Mengeliminasi galat batas kuota 1MB Firestore melalui pereduksian resolusi gambar otomatis ke maksimal 800px.
* **Logika Deteksi Jadwal Bentrok**:
  - Memisahkan penanggalan spesifik dari template mingguan pada `ScheduleService.checkConflict`, mengeliminasi bentrok semu (*false conflict*).
* **Navigasi Riwayat Peramban (URL Hash)**:
  - Menyinkronkan hash URL (`/#schedules`, `/#reports`) agar memuat ulang halaman (F5) tetap mempertahankan tab aktif.

### Security
* **Enkripsi Kredensial Salted SHA-256**:
  - Mengganti verifikasi PIN teks polos menjadi hash SHA-256 dengan salt acak 16 karakter via Web Crypto API.
* **Proteksi Brute-Force Lockout**:
  - Penguncian akun otomatis selama 15 menit jika 5 kali berturut-turut gagal memasukkan PIN.
* **Audit Log Permanen (Immutable Forensics)**:
  - Aturan Firestore mengunci koleksi `auditLogs` (`allow update, delete: if false;`), menjamin jejak audit tidak dapat dimanipulasi atau dihapus.
* **Fine-Grained Ownership Guard**:
  - Guru hanya diizinkan mengedit draft jurnal yang ditugaskan kepada dirinya.

### Testing
* **Uji Kompilasi TypeScript**: `tsc --noEmit` berhasil dengan **0 Errors**.
* **Uji Linting & Validasi Skema**: Berhasil 100%.
* **Matriks Pengujian Regresi**: Telah dieksekusi terhadap 19 Bidang Fungsional, 4 Peran Pengguna, dan 8 Viewport Layar:
  - Total Skenario Diuji: **44 Skenario**
  - Lolos (*Passed*): **44**
  - Gagal (*Failed*): **0**
  - Tingkat Kelolosan (*Pass Rate*): **100%**

### Known Limitations
1. **Integrasi Langsung Google Drive API**: *PERLU KONFIRMASI ADMINISTRATOR* untuk penyediaan OAuth client token; penyimpanan media saat ini menggunakan Base64 terkompresi di Firestore.
2. **Kamera & Lokasi Memerlukan Protokol HTTPS**: Peramban modern mewajibkan koneksi aman (HTTPS/SSL) untuk mengakses kamera dan sensor GPS.
3. **Penurunan Akurasi GPS Dalam Ruangan**: Sinyal satelit GPS dapat menurun jika perangkat berada di dalam ruangan berdinding beton tebal tanpa ventilasi terbuka.
