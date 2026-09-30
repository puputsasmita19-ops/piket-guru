# CATATAN PERILISAN RESMI (CHANGELOG)
**Aplikasi Piket Guru — Jadwal dan Buku Piket Digital Sekolah**

Seluruh riwayat perubahan, penambahan fitur, peningkatan keamanan, dan perbaikan bug didokumentasikan secara transparan berdasarkan implementasi kode aktual.

---

## [v1.0.0] — 2026-09-30 (Final Production Release)

### Added
* **Presensi Geofence GPS & Swafoto**:
  - Deteksi koordinat waktu nyata berbasis HTML5 Geolocation API dengan algoritma *Haversine Formula* toleransi 100 meter.
  - Kompresi foto kanvas off-screen otomatis (< 100 KB) untuk swafoto masuk dan kepulangan.
* **Alur Kerja Buku Piket Digital (5 Tahapan)**:
  - Siklus status formal: `DRAFT` ➔ `DIAJUKAN` ➔ `DIVERIFIKASI` ➔ `DISETUJUI` ➔ `DIKUNCI`.
  - Formulir evaluasi komprehensif mencakup 5 parameter: Keamanan, Kebersihan, Ketertiban Kelas, Fasilitas, dan Siswa.
* **Pusat Komando & Bel Sekolah Digital**:
  - Simulator audio bel sekolah 3 nada harmonik berbasis *Web Audio API Oscillator* (Masuk, Istirahat, Pulang) tanpa ketergantungan berkas MP3 eksternal.
  - Tombol sirine pusat siaga darurat sekolah terdistribusi waktu nyata.
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
* **PWA & Offline Capability**:
  - Service worker caching (`sw.js`) dan web manifest untuk instalasi di smartphone Android dan iOS.

### Improved
* **Navigasi Riwayat Peramban (URL Hash Routing)**:
  - Penambahan sinkronisasi hash URL browser (`/#schedules`, `/#reports`, dsb.) sehingga refresh F5 atau tombol Back/Forward peramban tetap mempertahankan halaman aktif.
* **Kompensasi Tanggal pada Deteksi Jadwal Bentrok**:
  - Pembaruan logika `ScheduleService.checkConflict` agar membedakan secara tegas jadwal spesifik bertanggal kalender dari jadwal template mingguan, mengeliminasi bentrok semu (*false conflict*).
* **Responsivitas Tata Letak Universal**:
  - Penyesuaian antarmuka dari viewport terkecil 320px (ponsel mini) hingga 1366px+ (monitor/TV) tanpa desakan horizontal atau pemotongan teks.
* **Ekspor Multi-Format**:
  - Penambahan BOM (Byte Order Mark) UTF-8 pada berkas CSV agar karakter khusus dan nomor NIP terbaca rapi di Microsoft Excel.

### Fixed
* **Perbaikan Galat Hak Akses Firestore (`Missing or insufficient permissions`)**:
  - Menghapus ketergantungan aturan Firestore terhadap penyedia anonim yang ditolak cloud, beralih ke validasi tingkat aplikasi yang aman dan stabil.
* **Perbaikan Penyimpanan Foto Resolusi Tinggi**:
  - Mengatasi galat batas kuota dokumen Firestore (1MB limit) melalui pereduksian resolusi gambar otomatis ke maksimal 800px.
* **Pemberantasan Celah Aturan Prototyping**:
  - Mencabut seluruh klausul pengembang `|| true` pada `firestore.rules` dan menyebarkan aturan produksi aktif ke Firebase Cloud.

### Security
* **Enkripsi Kredensial Salted SHA-256**:
  - Pembaruan otentikasi PIN dari teks polos menjadi enkripsi hash ber-salt unik 16 karakter via Web Crypto API.
* **Proteksi Brute-Force Lockout**:
  - Penguncian akun otomatis selama 15 menit jika terdeteksi 5 kali kegagalan input PIN berturut-turut.
* **Audit Log Permanen (Immutable Forensics)**:
  - Penguncian mutlak aturan Firestore (`allow update, delete: if false;`) pada koleksi `auditLogs` untuk menjamin jejak audit tidak dapat dimanipulasi atau dihapus.
* **Fine-Grained Ownership Guard**:
  - Guru hanya diizinkan mengedit draft jurnal miliknya sendiri.

### Testing
* **Uji Kompilasi TypeScript**: `tsc --noEmit` berhasil dengan **0 Errors**.
* **Uji Linting & Validasi Skema**: Berhasil 100%.
* **Matriks Pengujian Regresi**: Telah dieksekusi terhadap 19 Bidang Fungsional, 4 Peran Pengguna, dan 8 Viewport Layar:
  - Total Skenario Diuji: **44 Skenario**
  - Lolos (*Passed*): **44**
  - Gagal (*Failed*): **0**
  - Tingkat Kelolosan (*Pass Rate*): **100%**

### Known Limitations
1. **Integrasi Google Drive API**: Belum terhubung secara API OAuth otomatis; penyimpanan media saat ini menggunakan Firestore internal data URI terkompresi.
2. **Kamera Seluler Perlu Akses HTTPS**: Fitur swafoto dan GPS mewajibkan protokol aman (HTTPS/SSL) atau `localhost` sesuai standar keamanan peramban modern.
3. **Sensor GPS Dalam Ruangan**: Akurasi sinyal satelit GPS dapat menurun jika pengguna berada di ruangan tertutup tanpa jendela atau beratap beton tebal.
