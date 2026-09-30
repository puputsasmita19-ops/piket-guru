```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                        Dokumen: 02 — SOP PRESENSI
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 02_SOP_Presensi
* **Klasifikasi**: INTERNAL
* **Penanggung Jawab**: Wakil Kepala Sekolah / Koordinator Piket & Administrator IT

---

# STANDAR OPERASIONAL PROSEDUR (SOP)
## PRESENSI GURU DAN TENAGA KEPENDIDIKAN BERBASIS GEOFENCE GPS & SWAFOTO

---

### A. IDENTITAS SOP
* **Nomor SOP**: SOP/PIKET/001-PRES
* **Tanggal Berlaku**: 30 September 2026
* **Revisi Ke-**: 00 (Final Production)
* **Kategori**: Kedinasan & Penjaminan Mutu Operasional Sekolah

---

### B. TUJUAN
1. Menjamin kehadiran fisik guru dan tenaga kependidikan yang bertugas piket secara akuntabel, transparan, dan tepat waktu.
2. Mencegah manipulasi waktu dan lokasi presensi melalui pembuktian koordinat satelit GPS dan swafoto wajah waktu nyata (*real-time selfie*).
3. Menyediakan data kehadiran digital terintegrasi yang menjadi dasar penyusunan Laporan Kinerja Bulanan dan Surat Keterangan Menjalankan Tugas (SKMT).

---

### C. RUANG LINGKUP
SOP ini mengikat seluruh Guru (PNS, PPPK, GTT, Honorer) serta Tenaga Kependidikan (Staf TU, Satpam/Keamanan, Perpustakaan, Laboratorium) yang tercantum dalam jadwal piket resmi sekolah.

---

### D. PENGGUNA
1. **Guru Piket**: Pelaksana presensi mandiri.
2. **Tenaga Kependidikan**: Pelaksana presensi mandiri.
3. **Koordinator Piket**: Pemantau kedisiplinan kehadiran shift.
4. **Administrator IT**: Pengelola titik koordinat geofence dan pendukung teknis.
5. **Kepala Sekolah**: Peninjau dan verifikator rekapitulasi kehadiran resmi.

---

### E. PERSYARATAN
Sebelum melakukan presensi, pengguna wajib memastikan:
1. Membawa gawai (*smartphone*, tablet, atau laptop) dengan kamera aktif dan sensor GPS.
2. Peramban web telah diberikan izin akses lokasi (*Allow Geolocation*) dan izin kamera (*Allow Camera*).
3. Terhubung ke jaringan internet (Data Seluler atau Wi-Fi Sekolah).
4. Posisi fisik pengguna telah berada di dalam lingkungan sekolah saat menekan tombol presensi.

---

### F. PROSEDUR PRESENSI MASUK (CHECK-IN)
1. Petugas tiba di lingkungan sekolah sebelum jam piket dimulai sesuai jadwal.
2. Buka aplikasi Piket Guru pada peramban web dan lakukan login dengan NIP dan PIN.
3. Masuk ke menu **Presensi Piket**.
4. Sistem secara otomatis mendeteksi posisi koordinat GPS dan menghitung jarak ke gerbang sekolah.
5. Jika jarak &le; 100 meter, status tampil hijau (**DALAM_LOKASI**) dan tombol hijau **Presensi Masuk** aktif. Klik tombol tersebut.
6. Jendela kamera terbuka. Posisikan wajah di depan lensa dengan pencahayaan cukup, lalu klik **Potret Sekarang**.
7. Periksa hasil potret. Jika wajah tampak jelas, klik **Gunakan Foto Ini**.
8. Sistem mengompresi foto kanvas (&lt; 100KB) dan menyimpan rekaman ke koleksi `attendance` di Firestore.

---

### G. PROSEDUR PRESENSI PULANG (CHECK-OUT)
1. Setelah seluruh jam tugas piket selesai dan pengisian buku piket diajukan, buka kembali menu **Presensi Piket**.
2. Pastikan posisi fisik masih berada di dalam kawasan sekolah.
3. Klik tombol biru **Presensi Pulang**.
4. Waktu kepulangan resmi dicatat dan sesi piket dinyatakan selesai.

---

### H. KETENTUAN GEOFENCE GPS (IMPLEMENTASI AKTUAL)
* **Koordinat Sekolah**: Ditentukan pada konfigurasi `settings/school_config` (`schoolLat` dan `schoolLng`).
* **Algoritma Perhitungan**: Algoritma matematis *Haversine Formula* yang menghitung kelengkungan permukaan bumi guna menghasilkan jarak aktual dalam satuan meter.
* **Toleransi Akurasi Sensor**: Direkomendasikan akurasi deviasi GPS peramban &le; 30 meter.

---

### I. KETENTUAN RADIUS
* **Radius Standar**: Maksimal **100 meter** dari titik koordinat gerbang sekolah (`allowedRadiusMeters`).
* **Status Presensi**:
  - `DALAM_LOKASI`: Jarak &le; 100 meter (Presensi Diterima Sah).
  - `DI_LUAR_LOKASI`: Jarak &gt; 100 meter (Tombol Presensi Terkunci / Ditampilkan Peringatan).
  - `GPS_ERROR`: Perangkat gagal mengakses modul satelit lokasi.
  - `AKURASI_RENDAH`: Sinyal lokasi terlalu lemah (&gt; 100 meter deviasi).

---

### J. PENANGANAN GPS TIDAK AKURAT
1. Buka pengaturan gawai, pastikan opsi **Mode Akurasi Tinggi (Google Location Accuracy)** aktif.
2. Matikan dan nyalakan kembali tombol Lokasi/GPS atau aktifkan sejenak Mode Pesawat (*Airplane Mode*).
3. Bergeserlah mendekati jendela, pintu terbuka, atau lapangan jika berada di dalam gedung berdinding beton tebal.
4. Muat ulang halaman peramban (*Refresh / F5*).

---

### K. PENANGANAN INTERNET BERMASALAH
1. Aplikasi dilengkapi Progressive Web App (PWA) Service Worker Cache (`sw.js`).
2. Jika sinyal terputus sesaat, banner *Mode Offline* akan tampil. Hubungkan ke jaringan Wi-Fi sekolah alternatif atau hotspot rekan kerja, lalu ulangi penekanan tombol presensi saat koneksi stabil kembali.

---

### L. PENANGANAN PRESENSI GAGAL
1. Jika presensi gagal karena error izin atau peramban membeku, bersihkan cache peramban atau gunakan peramban alternatif (Google Chrome disarankan).
2. Lakukan tangkapan layar (*screenshot*) pesan galat sebagai bukti.
3. Laporkan kendala kepada Koordinator Piket atau Administrator IT.

---

### M. KOREKSI PRESENSI
* **Ketentuan Sistem**: Tidak ditemukan fitur edit mandiri catatan presensi oleh Guru dalam source code demi menjaga integritas data dan mencegah kecurangan.
* **Prosedur Koreksi**: Jika guru hadir namun gawai rusak atau kehabisan baterai, penyesuaian catatan dilakukan secara administratif oleh **Administrator** dan dicantumkan keterangan tertulis pada Buku Piket yang diverifikasi Kepala Sekolah.

---

### N. DOKUMENTASI & BUKTI KEHADIRAN
Setiap rekaman presensi memuat bukti otentik:
1. ID Pengguna & Nama Lengkap Petugas.
2. Tanggal, Jam Masuk, dan Jam Pulang (WIB).
3. Koordinat Latitude, Longitude, dan Jarak Meter Aktual.
4. Nilai deviasi akurasi sensor gawai.
5. Berkas swafoto wajah terkompresi kanvas resmi.

---

### O. PENANGGUNG JAWAB
1. **Teknis**: Administrator IT Sekolah.
2. **Operasional Harian**: Koordinator Piket Sekolah.
3. **Pengesahan Akhir**: Kepala Sekolah.
