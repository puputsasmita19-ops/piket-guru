# STANDAR OPERASIONAL PROSEDUR (SOP)
## PRESENSI GURU DAN TENAGA KEPENDIDIKAN

* **Nomor Dokumen**: SOP/PIKET/001-PRES
* **Edisi / Revisi**: 01 / 00
* **Tanggal Efektif**: 30 September 2026
* **Status Aplikasi**: Production v1.0.0

---

### A. TUJUAN
1. Menjamin kepastian dan akuntabilitas kehadiran fisik guru dan staf yang ditugaskan piket di lingkungan sekolah.
2. Mencegah manipulasi waktu dan lokasi kehadiran melalui pembuktian koordinat Geofence GPS dan swafoto wajah waktu nyata (*real-time facial selfie*).
3. Menyediakan data kehadiran yang valid, transparan, dan terintegrasi langsung dengan pelaporan dinas serta jurnal piket harian.

---

### B. RUANG LINGKUP
SOP ini berlaku bagi seluruh Guru (PNS, PPPK, GTT, Honorer) serta Tenaga Kependidikan (TU, Staf Keamanan/Satpam, Perpustakaan, dan Teknisi) yang tercantum dalam jadwal piket resmi sekolah.

---

### C. PENGGUNA
1. **Guru Piket**: Pelaksana presensi mandiri.
2. **Tenaga Kependidikan**: Pelaksana presensi mandiri.
3. **Administrator**: Pengawas sistem, penata kelola geofence, dan penindaklanjut kendala teknis.
4. **Kepala Sekolah**: Peninjau dan verifikator rekapitulasi kehadiran resmi.

---

### D. PERSYARATAN
Sebelum melakukan presensi, pengguna wajib memastikan:
1. Membawa gawai (*smartphone*, tablet, atau laptop) yang memiliki kamera aktif dan fitur GPS / Layanan Lokasi.
2. Peramban web (*Google Chrome, Mozilla Firefox, Apple Safari, atau Edge*) telah diberikan **Izin Lokasi (Location Permission)** dan **Izin Kamera (Camera Permission)**.
3. Perangkat telah terhubung ke jaringan internet (Data Seluler atau Wi-Fi Sekolah).
4. Pengguna sudah berada secara fisik di dalam kawasan lingkungan sekolah.

---

### E. PROSEDUR PRESENSI MASUK
1. Pengguna membuka peramban web dan mengakses aplikasi Piket Guru pada tautan resmi sekolah.
2. Pengguna memasukkan NIP dan 6 digit PIN pribadi untuk login ke sistem.
3. Pada bilah navigasi samping, klik menu **Presensi Piket**.
4. Sistem secara otomatis mendeteksi koordinat GPS, menghitung jarak perangkat ke titik pusat sekolah, dan menampilkan status jarak pada kartu HUD di layar.
5. Apabila pengguna berada di dalam radius toleransi sekolah (jarak ≤ 100 meter), tombol hijau **Presensi Masuk** akan aktif. Klik tombol tersebut.
6. Jendela modal kamera akan muncul di layar. Posisikan wajah pengguna di depan kamera dengan pencahayaan yang cukup, lalu klik tombol **Potret Sekarang**.
7. Tinjau foto yang diambil. Jika tampak jelas dan tidak buram, klik **Gunakan Foto Ini**.
8. Sistem mengompresi foto secara otomatis, mengunci koordinat GPS, mencatat jam masuk, dan menyimpan rekaman ke database Firestore dengan status **DALAM_LOKASI**.

---

### F. PROSEDUR PRESENSI PULANG
1. Di akhir jam kedinasan piket (sesuai jam selesai shift pada jadwal), pengguna kembali membuka menu **Presensi Piket**.
2. Pengguna memastikan posisi masih berada di area sekolah.
3. Klik tombol biru **Presensi Pulang (Check-Out)**.
4. Sistem mencatat jam kepulangan secara akurat dan mengubah status sesi presensi hari tersebut menjadi selesai.

---

### G. KETENTUAN GEOFENCE GPS (IMPLEMENTASI AKTUAL)
Berdasarkan implementasi teknis pada modul `locationService.ts`:
* **Pusat Koordinat Sekolah**: Ditentukan pada konfigurasi `settings/school_config` (`schoolLat` dan `schoolLng`).
* **Metode Perhitungan Jarak**: Menggunakan algoritma *Haversine Formula* yang menghitung kelengkungan bumi untuk menghasilkan jarak presisi dalam satuan meter.
* **Batas Toleransi Radius**: Standar bawaan adalah **100 meter** (`allowedRadiusMeters`). Jarak > 100 meter akan ditolak dengan status *DI_LUAR_LOKASI*.
* **Akurasi GPS (Accuracy)**: Nilai akurasi dilaporkan langsung oleh peramban dalam satuan meter. Nilai akurasi yang ideal adalah < 30 meter.
* **Status Presensi**:
  - `DALAM_LOKASI`: Jarak pengguna ≤ batas radius yang diizinkan (Presensi Sah).
  - `DI_LUAR_LOKASI`: Jarak pengguna > batas radius sekolah (Tombol Presensi Terkunci).
  - `GPS_ERROR`: Perangkat gagal mendapatkan sinyal satelit lokasi.
  - `AKURASI_RENDAH`: Sinyal lokasi terlalu lemah (> 100m deviasi).

---

### H. JIKA GPS BERMASALAH
1. Pastikan fitur **Lokasi / GPS** pada gawai dalam posisi AKTIF (*ON*).
2. Pada pengaturan HP Android/iOS, ubah mode akurasi lokasi menjadi **Akurasi Tinggi / Google Location Accuracy**.
3. Buka pengaturan peramban: *Pengaturan Situs ➔ Lokasi ➔ Izinkan untuk domain aplikasi ini*.
4. Jika berada di dalam ruangan berdinding beton tebal, bergeserlah mendekati jendela atau pintu terbuka selama beberapa detik agar sinyal GPS satelit terkunci.
5. Muat ulang halaman peramban (*Refresh / F5*).

---

### I. JIKA KONEKSI INTERNET BERMASALAH
1. Aplikasi telah dilengkapi teknologi **Progressive Web App (PWA) & Service Worker Cache**.
2. Apabila internet terputus sesaat, peramban akan memunculkan status *Koneksi Offline*.
3. Pengguna disarankan menghubungkan perangkat ke jaringan Wi-Fi sekolah atau menunggu hingga sinyal seluler kembali stabil, lalu menekan tombol presensi kembali.

---

### J. JIKA PRESENSI GAGAL
Apabila presensi tetap gagal dilakukan:
1. Catat pesan peringatan yang tampil di layar (misal: *Jarak 145 meter dari sekolah*).
2. Lakukan tangkapan layar (*screenshot*) sebagai bukti kendala.
3. Laporkan segera secara lisan kepada Koordinator Piket atau Administrator IT Sekolah.

---

### K. KOREKSI PRESENSI
* **Ketersediaan Fitur**: Tidak ditemukan fitur edit mandiri presensi oleh Guru dalam source code demi menjaga integritas data.
* **Mekanisme Koreksi**: Jika guru hadir bertugas namun terkendala gawai rusak/baterai habis, koreksi status kehadiran dilakukan secara terpusat oleh **Administrator** melalui penyesuaian catatan piket dan penulisan keterangan pada jurnal harian, yang diverifikasi oleh Kepala Sekolah.

---

### L. BUKTI PRESENSI
Setiap data presensi yang berhasil tersimpan memuat metadata otentik:
1. ID Pengguna & Nama Lengkap Petugas.
2. Tanggal, Jam Masuk, dan Jam Pulang (WIB).
3. Koordinat Latitude dan Longitude tempat presensi dilakukan.
4. Nilai deviasi akurasi sensor dan jarak meter dari gerbang sekolah.
5. Berkas swafoto terkompresi kanvas resmi.

---

### M. CATATAN
1. Dilarang keras menitipkan presensi atau memanipulasi koordinat lokasi melalui aplikasi pemalsu lokasi (*Fake GPS*).
2. Rekaman presensi menjadi dasar resmi dalam penyusunan Laporan Kinerja Bulanan Sekolah dan Surat Keterangan Menjalankan Tugas (SKMT).
