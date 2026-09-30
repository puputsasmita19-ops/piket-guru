```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                   Dokumen: 01 — BUKU PANDUAN PENGGUNA
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 01_Buku_Panduan_Pengguna
* **Klasifikasi**: PUBLIC / USER
* **Target Pembaca**: Dewan Guru, Tenaga Kependidikan, dan Kepala Sekolah

---

## DAFTAR ISI
1. Tentang Piket Guru
2. Tujuan Aplikasi
3. Persyaratan Penggunaan
4. Cara Login
5. Dashboard
6. Jadwal Piket
7. Presensi Mandiri (GPS & Swafoto)
8. Buku Piket Digital
9. Pencatatan Kejadian & Insiden
10. Dokumentasi Foto
11. Riwayat Operasional
12. Laporan & Rekapitulasi
13. Pengaturan Profil & Kredensial
14. Penggantian Tema (Light / Dark Mode)
15. Keluar dari Aplikasi (Logout)
16. Troubleshooting Dasar

---

## 1. TENTANG PIKET GURU
**Piket Guru v1.0.0** adalah platform aplikasi web progresif (PWA) yang dirancang khusus untuk mendigitalkan seluruh rangkaian kegiatan piket sekolah harian. Sistem ini menggantikan buku piket kertas konvensional dengan alur kerja modern yang mencakup pencatatan kehadiran berbasis radius lokasi (Geofencing GPS), verifikasi swafoto wajah waktu nyata, pencatatan tamu dan perizinan siswa, hingga pengesahan bertingkat langsung oleh Kepala Sekolah.

---

## 2. TUJUAN APLIKASI
1. **Akuntabilitas Kehadiran**: Menjamin kepastian fisik petugas piket berada di lingkungan sekolah melalui validasi koordinat satelit GPS dan swafoto.
2. **Efisiensi Administrasi**: Menghilangkan risiko buku fisik hilang, sobek, atau basah, serta menyediakan pencarian riwayat instan.
3. **Visibilitas Waktu Nyata**: Memungkinkan Kepala Sekolah dan manajemen memantau situasi KBM, ketertiban gerbang, dan kedisiplinan siswa kapan saja.
4. **Kepatuhan Kearsipan**: Memastikan jurnal piket terdokumentasi dan terkunci permanen setelah disahkan guna memenuhi standar audit dinas.

---

## 3. PERSYARATAN PENGGUNAAN
Sebelum menggunakan aplikasi, pastikan perangkat Anda memenuhi syarat berikut:
* **Gawai (Device)**: Smartphone (Android/iOS), Tablet, Laptop, atau Komputer Desktop.
* **Peramban Web (Browser)**: Google Chrome, Apple Safari, Mozilla Firefox, atau Microsoft Edge versi modern.
* **Izin Peramban (Permissions)**:
  - *Izin Lokasi (Geolocation)*: Wajib disetel "Izinkan / Allow" untuk validasi radius geofence sekolah.
  - *Izin Kamera (Camera)*: Wajib disetel "Izinkan / Allow" untuk pengambilan swafoto presensi.
* **Koneksi Jaringan**: Terhubung ke internet (Wi-Fi Sekolah atau Data Seluler). Fitur dasar tetap dapat diakses saat offline berkat dukungan Service Worker PWA.

---

## 4. CARA LOGIN
1. Buka tautan resmi aplikasi Piket Guru pada peramban gawai Anda.
2. Pada halaman awal login:
   - Masukkan **NIP** Anda (contoh akun bawaan dewan guru: `199008212015022003`).
   - Masukkan 6-digit **PIN Keamanan** (standar awal: `123456`).
3. Klik tombol **Masuk ke Sistem**.
4. Jika NIP dan PIN sesuai, Anda akan diarahkan langsung ke halaman **Dashboard**.
   *(Catatan Keamanan: Jika 5 kali salah memasukkan PIN berturut-turut, akun akan terkunci sementara selama 15 menit).*

---

## 5. DASHBOARD
Dashboard menyajikan ringkasan informasi penting hari ini:
* **Kartu Indikator Utama**:
  - *Petugas Hari Ini*: Menampilkan total guru dan staf yang terjadwal bertugas.
  - *Kehadiran*: Persentase petugas yang telah melakukan presensi masuk.
  - *Jurnal Terisi*: Jumlah buku piket yang sudah disusun atau diajukan.
  - *Kejadian*: Rekapitulasi insiden yang dilaporkan hari ini.
* **Radar Petugas Piket Hari Ini**: Daftar guru bertugas, alokasi pos jaga, jam dinas, dan status kehadiran aktual (*Hadir Tepat Waktu*, *Terlambat*, atau *Belum Masuk*).
* **Ringkasan Cepat**: Tinjauan siswa terlambat, buku tamu aktif, dan izin meninggalkan kelas.

---

## 6. JADWAL PIKET
1. Buka bilah navigasi samping, klik menu **Jadwal Piket**.
2. Pilih tab hari tugas (*Senin, Selasa, Rabu, Kamis, Jumat, Sabtu*).
3. Anda dapat melihat:
   - Nama petugas dan peran piket.
   - Pos atau ruangan tugas (misal: *Pos Utama & Gerbang Depan*, *Gedung Lantai 1*).
   - Jam mulai dan jam selesai dinas piket.
   - Status jadwal (*TERJADWAL*, *BERJALAN*, atau *SELESAI*).

---

## 7. PRESENSI MANDIRI (GEOFENCE GPS & SWAFOTO)
Presensi piket wajib dilakukan dua kali sehari: Presensi Masuk dan Presensi Pulang.

### Langkah Presensi Masuk (Check-In):
1. Pastikan Anda telah tiba di dalam kawasan sekolah.
2. Buka menu **Presensi Piket**.
3. Sistem secara otomatis mendeteksi koordinat GPS dan mengukur jarak Anda ke gerbang sekolah:
   - Jika jarak Anda &le; 100 meter, status tampil hijau: **DALAM_LOKASI**.
   - Tombol hijau **Presensi Masuk** akan aktif dan dapat diklik.
4. Klik tombol **Presensi Masuk**, jendela kamera akan muncul.
5. Arahkan kamera depan ke wajah Anda, lalu klik tombol **Potret Sekarang**.
6. Periksa pratinjau foto. Jika jelas, klik tombol **Gunakan Foto Ini**.
7. Sistem mengompresi foto secara otomatis (&lt; 100KB) dan menyimpan presensi masuk Anda.

### Langkah Presensi Pulang (Check-Out):
1. Pada akhir shift piket (setelah menyelesaikan pengisian buku piket), buka kembali menu **Presensi Piket**.
2. Pastikan posisi masih berada di area sekolah.
3. Klik tombol biru **Presensi Pulang**. Waktu kepulangan Anda resmi tercatat.

---

## 8. BUKU PIKET DIGITAL
Setiap petugas piket wajib menyusun satu berkas jurnal pada setiap shift tugas:
1. Buka menu **Buku Piket**.
2. Klik tombol **+ Buat Jurnal Hari Ini** (atau edit draft yang sudah tersimpan).
3. Lengkapi formulir evaluasi yang mencakup 5 parameter kondisi sekolah:
   - **Kondisi Keamanan**: Catatan pintu gerbang, pengawasan tamu, dan ketertiban umum.
   - **Kondisi Kebersihan**: Situasi kebersihan kelas, selasar, halaman, dan toilet.
   - **Kondisi Kelas & KBM**: Kelancaran KBM, kelas kosong, dan penugasan guru pengganti (inval).
   - **Kondisi Fasilitas**: Laporan sarana prasarana yang rusak atau perlu perbaikan.
   - **Kondisi Siswa**: Rekap kedisiplinan, seragam, dan penanganan siswa sakit di ruang UKS.
   - **Catatan Piket**: Kesimpulan umum dan saran untuk petugas hari berikutnya.
4. Klik **Simpan Draft** jika pengisian belum selesai.
5. Jika seluruh catatan telah lengkap, klik tombol **Ajukan Jurnal**. Status dokumen berubah menjadi `DIAJUKAN` untuk diverifikasi oleh pimpinan.

---

## 9. PENCATATAN KEJADIAN & INSIDEN
Jika terjadi peristiwa khusus selama jam piket (misal: perkelahian, kecelakaan olahraga, atau barang hilang):
1. Buka menu **Laporan Kejadian**.
2. Klik tombol **+ Laporkan Kejadian**.
3. Pilih Kategori Kejadian (*SISWA, FASILITAS, KEAMANAN, KEBERSIHAN, KEDISIPLINAN, KESEHATAN*).
4. Masukkan Waktu dan Lokasi spesifik kejadian di sekolah.
5. Tuliskan Uraian Kronologi peristiwa dan Tindakan Awal penanganan yang telah dilakukan.
6. Klik **Simpan Laporan**.

---

## 10. DOKUMENTASI FOTO
* Pengguna dapat melampirkan foto pada laporan kejadian, buku tamu, atau absensi.
* Sistem telah dilengkapi fitur kompresi kanvas otomatis sehingga ukuran berkas sangat ringan dan proses unggah berjalan instan tanpa menguras kuota internet.

---

## 11. RIWAYAT OPERASIONAL
Bapak/Ibu Guru dapat membuka riwayat presensi mandiri dan riwayat jurnal piket yang pernah dibuat sebelumnya melalui tab tabel di masing-masing menu untuk keperluan rekap angka kredit atau penilaian kinerja.

---

## 12. LAPORAN & REKAPITULASI (KHUSUS KEPALA SEKOLAH & ADMIN)
Bagi pengguna dengan peran Kepala Sekolah atau Admin:
1. Buka menu **Laporan**.
2. Pilih rentang tanggal rekapitulasi (standar: bulan kalender berjalan).
3. Pilih tab data: *Presensi Guru, Buku Piket, Buku Tamu, Siswa Terlambat, atau Insiden*.
4. Klik tombol **Cetak Laporan** untuk membuka pratinjau lembar dinas bertandatangan resmi siap cetak/PDF.
5. Klik **Unduh Excel (.xls)** atau **Unduh CSV** untuk mengolah data di spreadsheet.

---

## 13. PENGATURAN PROFIL & KREDENSIAL
1. Klik nama atau foto profil Anda di pojok kanan atas layar.
2. Anda dapat melihat informasi profil NIP, Nama Lengkap, Peran, Email, dan No. Telepon.
3. Anda dapat melakukan penggantian PIN keamanan 6 digit secara mandiri untuk menjaga kerahasiaan akun.

---

## 14. PENGGANTIAN TEMA (LIGHT / DARK MODE)
Aplikasi mendukung mode tampilan Terang (*Light*), Gelap (*Dark*), dan Otomatis Sistem (*System*).
* Klik ikon palet/matahari/bulan di bilah navigasi atas untuk berpindah tema secara instan.
* Preferensi tema Anda otomatis tersimpan di peramban dan tidak akan hilang saat dimuat ulang (*refresh*).

---

## 15. KELUAR DARI APLIKASI (LOGOUT)
1. Klik menu profil di pojok kanan atas.
2. Klik tombol merah **Keluar (Logout)**.
3. Sesi aktif akan dihapus dan Anda akan dialihkan kembali ke layar login.

---

## 16. TROUBLESHOOTING DASAR
* **Peringatan "Di Luar Lokasi"**: Pastikan Anda sudah berada di dalam lingkungan sekolah (radius < 100m) dan GPS HP disetel ke Akurasi Tinggi.
* **Kamera Hitam/Tidak Terbuka**: Pastikan izin kamera telah diberikan di peramban web Anda, atau gunakan tombol alternatif *"Pilih Foto dari Galeri"*.
* **Lupa PIN**: Hubungi Administrator IT Sekolah untuk melakukan reset PIN ke standar awal (`123456`).
