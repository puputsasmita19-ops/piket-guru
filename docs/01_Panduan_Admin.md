# PANDUAN PENGGUNA: ADMINISTRATOR (ADMIN)
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Panduan ini disusun secara khusus untuk peran **Administrator** yang memegang otoritas penuh terhadap tata kelola sistem, manajemen pengguna, jadwal, pemantauan operasional, serta keamanan data sekolah.

---

## 1. Login Sistem
1. Buka peramban (browser) dan akses alamat web aplikasi Piket Guru.
2. Pada halaman utama login, masukkan **NIP** Administrator: `198503152010011002` (atau klik tombol cepat *Admin*).
3. Masukkan 6 digit **PIN Keamanan** (bawaan: `123456`).
4. Klik tombol **Masuk ke Sistem**.
5. Setelah berhasil, sistem akan mengarahkan Anda langsung ke halaman **Dashboard**.
   *Catatan Keamanan: Sistem dilengkapi proteksi lockout otomatis selama 15 menit jika salah memasukkan PIN sebanyak 5 kali berturut-turut.*

---

## 2. Dashboard Administrator
Dashboard menyajikan visibilitas waktu nyata (real-time) mengenai kondisi operasional sekolah hari ini:
* **Statistik Utama (KPI Cards)**:
  - Jumlah Petugas Hari Ini (Total Guru & Staf bertugas).
  - Kehadiran Masuk (Persentase dan jumlah petugas yang telah melakukan presensi masuk).
  - Jurnal Terisi (Jumlah buku piket yang sudah dibuat/diajukan).
  - Kejadian Dilaporkan (Akumulasi insiden aktif yang membutuhkan penanganan).
* **Radar Petugas Piket Hari Ini**: Daftar nama petugas, alokasi pos/ruangan, jam tugas, serta status kehadiran aktual (*Hadir Tepat Waktu, Terlambat, Belum Masuk*).
* **Radar Insiden & Perizinan**: Ringkasan laporan kejadian darurat, siswa terlambat, izin meninggalkan kelas, dan buku tamu aktif.

---

## 3. Master Data Sekolah
Akses menu **Master Data** pada bilah navigasi samping untuk mengelola referensi dasar:

### A. Data Guru (`teachers`)
* **Fungsi**: Menyimpan daftar resmi tenaga pendidik untuk alokasi jadwal piket dan presensi.
* **Cara Melihat**: Pilih tab **Data Guru**, daftar guru akan ditampilkan dalam bentuk tabel lengkap dengan status kepegawaian.
* **Cara Menambah**:
  1. Klik tombol **+ Tambah Guru**.
  2. Isi formulir: NIP, Nama Lengkap & Gelar, Mata Pelajaran, Pangkat/Golongan, Status Kepegawaian (PNS / PPPK / GTT / HONORER), Nomor Telepon/WhatsApp, dan Email.
  3. Klik **Simpan Data**.
* **Cara Mengubah**: Klik ikon pensil (**Edit**) pada baris guru yang bersangkutan, perbarui data, lalu klik simpan.
* **Cara Menghapus**: Klik ikon tempat sampah (**Hapus**), konfirmasi dialog penghapusan.
* **Validasi**: NIP wajib diisi dan unik; nomor telepon valid; nama lengkap tidak boleh kosong.
* **Dampak**: Data guru menjadi sumber referensi untuk modul Jadwal Piket, Presensi, dan Guru Pengganti (Inval).

### B. Data Staf / Tenaga Kependidikan (`staff`)
* **Fungsi**: Menyimpan data pegawai TU, satpam, pustakawan, dan teknisi lab.
* **Cara Melihat, Menambah, Mengubah, Menghapus**: Prosedur serupa dengan data guru, dengan pemilihan field khusus divisi kerja (*Tata Usaha, Keamanan/Satpam, Kebersihan, Sarpras, Perpustakaan, Laboratorium*).
* **Validasi**: NIP/NIK terisi, divisi wajib dipilih.
* **Dampak**: Memungkinkan penugasan staf non-guru pada jadwal pos pengawasan gerbang/keamanan.

### C. Data Ruang & Pos Piket (`rooms`)
* **Fungsi**: Mendefinisikan titik pos pantau dan gedung sekolah (misal: *Pos Gerbang Utama, Gedung Lantai 1, dsb.*).
* **Field**: Kode Ruang, Nama Pos/Ruang, Nama Gedung, Lantai, Kapasitas, Status Aktif.
* **Dampak**: Digunakan pada saat penyusunan jadwal dan pemetaan lokasi kejadian/insiden.

### D. Kategori Kejadian / Pelanggaran (`incidentCategories`)
* **Fungsi**: Klasifikasi tingkat urgensi dan jenis insiden di lingkungan sekolah.
* **Field**: Kode, Nama Kategori, Deskripsi, Tingkat Keparahan (*RENDAH, SEDANG, TINGGI, KRITIS*).
* **Dampak**: Menentukan tingkat notifikasi pada Pusat Siaga dan grafik analisis kejadian.

---

## 4. Manajemen Pengguna (`users`)
Akses menu **Pengguna Sistem** untuk tata kelola hak akses:
* **Membuat Akun Baru**:
  1. Klik tombol **+ Tambah Pengguna**.
  2. Masukkan NIP, Nama Lengkap, Alamat Email, Nomor WhatsApp, dan pilih **Peran (Role)**:
     - `ADMIN`: Akses penuh konfigurasi & audit.
     - `KEPALA_SEKOLAH`: Otorisasi persetujuan & monitoring eksekutif.
     - `GURU`: Pengisian operasional jurnal & presensi.
     - `TENAGA_KEPENDIDIKAN`: Presensi, buku tamu, perizinan, dan jurnal staf.
  3. Masukkan 6 digit PIN awal (standar: `123456`).
  4. Klik **Buat Pengguna**. Sistem otomatis meng-generate salt kriptografis dan menyimpan hash PIN.
* **Mengubah Pengguna**: Klik tombol **Edit** untuk memperbarui nama, nomor telepon, atau hak peran.
* **Reset PIN Pengguna**:
  1. Klik tombol **Reset PIN** pada kartu pengguna.
  2. Masukkan PIN baru 6 digit, klik konfirmasi. PIN langsung terenkripsi ulang ke database.
* **Mengaktifkan / Menonaktifkan Pengguna**:
  1. Ubah toggle status akun menjadi **Non-Aktif**.
  2. Pengguna yang dinonaktifkan akan langsung ditolak saat mencoba login ke sistem.

---

## 5. Tata Kelola Jadwal Piket (`schedules`)
Akses menu **Jadwal Piket**:
* **Membuat Jadwal Baru**:
  1. Klik tombol **+ Buat Jadwal Piket**.
  2. Pilih Petugas (Guru/Staf dari master data).
  3. Pilih Pos / Ruang piket.
  4. Pilih Hari tugas (SENIN s.d. SABTU) dan tentukan Tanggal (opsional jika bersifat jadwal insidental/spesifik).
  5. Masukkan Jam Mulai (contoh: `06:30`) dan Jam Selesai (contoh: `15:30`).
  6. Tambahkan keterangan/fokus tugas.
  7. Klik **Simpan Jadwal**.
* **Sistem Deteksi Bentrok (Conflict Detection)**:
  - Sistem secara otomatis memverifikasi database:
    - *Bentrok Petugas*: Jika guru yang sama telah dijadwalkan pada jam yang beririsan.
    - *Bentrok Pos*: Jika ruangan/pos yang sama telah dialokasikan untuk petugas lain pada jam yang sama.
  - Jika bentrok terdeteksi, sistem menampilkan dialog peringatan penolakan dan mencegah penyimpanan jadwal ganda.
* **Jadwal Pengganti (Inval)**:
  - Jika petugas berhalangan hadir, Admin dapat membuka menu **Guru Pengganti (Inval)** untuk menunjuk guru piket pengganti resmi yang tercatat di laporan.

---

## 6. Monitoring Presensi GPS
Akses menu **Presensi Piket**:
* Admin memiliki izin `attendance.view_all` untuk memantau kehadiran seluruh petugas.
* Tampilan menyajikan: Waktu Check-In, Waktu Check-Out, Nilai Akurasi GPS (dalam meter), Jarak dari Pusat Sekolah, dan Tinjauan Foto Swafoto (*Selfie*).
* Status presensi: *DALAM_LOKASI* (kehadiran sah), *DI_LUAR_LOKASI* (berada di luar radius batas sekolah), atau *GPS_ERROR*.

---

## 7. Monitoring & Kontrol Buku Piket
Akses menu **Buku Piket**:
* Memantau alur berkas harian melalui 5 tahapan:
  `DRAFT` ➔ `DIAJUKAN` ➔ `DIVERIFIKASI` ➔ `DISETUJUI` ➔ `DIKUNCI`.
* **Fitur Pembukaan Gembok Darurat (Unlock Journal)**:
  - Khusus Administrator: Jurnal yang telah berstatus `DIKUNCI` (Arsip Permanen) dapat dibuka kembali jika terdapat instruksi perbaikan data resmi.
  - Klik tombol **Buka Gembok (Unlock)** pada jurnal terkait.
  - Masukkan alasan pembukaan secara jelas.
  - Status jurnal akan kembali ke `DRAFT` dan peristiwa pembukaan gembok otomatis tercatat permanen pada Audit Trail.

---

## 8. Monitoring Kejadian & Insiden
Akses menu **Laporan Kejadian**:
* Melihat seluruh kejadian yang dilaporkan oleh guru piket di lapangan.
* Memperbarui status penanganan: `DILAPORKAN` ➔ `DALAM_PENANGANAN` ➔ `SELESAI`.
* Mengeskalasi insiden berstatus `KRITIS` ke pimpinan sekolah atau pihak berwenang.

---

## 9. Dokumentasi Foto
* Meninjau bukti foto kegiatan piket, swafoto absensi, dan dokumentasi visual insiden.
* Seluruh foto telah melalui kompresi kanvas otomatis sehingga ukuran berkas terjaga ramah penyimpanan (< 100 KB).

---

## 10. Modul Laporan & Cetak Lembar Dinas
Akses menu **Laporan**:
1. Pilih rentang tanggal (sistem menyediakan default bulan kalender berjalan).
2. Pilih kategori rekapitulasi: *Kehadiran Guru, Buku Piket, Buku Tamu, Siswa Terlambat, Rekap Insiden*.
3. Klik **Pratinjau Cetak** untuk membuka lembar kerja berformat kop dinas resmi, lengkap dengan tanda tangan Kepala Sekolah dan Koordinator Piket.
4. Tekan tombol **Cetak / PDF** untuk langsung mengirim dokumen ke mesin pencetak.

---

## 11. Ekspor & Impor Data
* **Ekspor CSV**: Menghasilkan berkas `.csv` dengan penanda UTF-8 BOM agar angka NIP dan teks bahasa Indonesia tidak rusak saat dibuka di Microsoft Excel.
* **Ekspor Excel (.xls)**: Menghasilkan berkas spreadsheet tabel lengkap dengan format tata letak rapi.
* **Ekspor JSON**: Menghasilkan struktur data mentah untuk kebutuhan arsip teknis.
* **Impor Data**: Tersedia pada modul pemulihan (*Restore*) untuk sinkronisasi cadangan resmi.

---

## 12. Backup Database (Pencadangan 1-Klik)
Akses menu **Pengaturan Sistem** ➔ Tab **Pencadangan & Pemulihan**:
1. Pastikan Anda berada dalam jaringan internet yang stabil.
2. Klik tombol **Unduh Cadangan Lengkap**.
3. Sistem akan membaca 16 koleksi database Firestore dan mengunduh satu berkas `.json` bernama `backup-piket-guru-[tanggal]-[jam].json`.
4. Simpan berkas ini pada media penyimpanan eksternal yang aman.

---

## 13. Restore Database (Pemulihan Bencana)
1. Pada menu **Pencadangan & Pemulihan**, klik **Pilih Berkas Cadangan (.json)**.
2. Pilih berkas backup resmi hasil unduhan sebelumnya.
3. Sistem akan memvalidasi integritas struktur berkas secara otomatis.
4. Jika berkas valid, muncul dialog modal konfirmasi pemulihan yang merinci jumlah dokumen per koleksi.
5. Klik tombol konfirmasi **Pulihkan Database Sekarang**.
6. Sistem memproses pemulihan data dan mencatat rekaman peristiwa pemulihan ke Audit Trail.

---

## 14. Pengaturan Aplikasi & Geofence Sekolah
Akses menu **Pengaturan Sistem** ➔ Tab **Profil & GPS**:
1. **Nama Sekolah & NPSN**: Sesuaikan identitas resmi sekolah.
2. **Koordinat GPS Sekolah**:
   - Masukkan Latitude dan Longitude sekolah secara manual, ATAU
   - Berdiri di titik tengah gerbang sekolah, lalu klik tombol **Deteksi Lokasi Perangkat Saya**.
3. **Radius Toleransi (Meter)**: Tentukan batas jarak presensi sah (standar: `100` meter).
4. **Jam Kerja Sekolah**: Tentukan batas jam awal piket (contoh: `06:30`) dan batas akhir piket (contoh: `15:30`).
5. Klik **Simpan Pengaturan**.

---

## 15. Logout Sistem
1. Klik kartu nama profil Administrator di bilah navigasi pojok kanan atas.
2. Klik tombol merah **Keluar (Logout)**.
3. Sesi aktif akan dibersihkan dari penyimpanan lokal peramban dan Anda akan dialihkan kembali ke gerbang login.
