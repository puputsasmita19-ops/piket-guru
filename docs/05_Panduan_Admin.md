```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                       Dokumen: 05 — PANDUAN ADMIN
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 05_Panduan_Admin
* **Klasifikasi**: ADMIN
* **Penanggung Jawab**: Administrator IT Sekolah

---

## 1. LOGIN ADMIN
* **TUJUAN**: Mengotentikasi Administrator untuk mengakses seluruh fungsi manajerial dan konfigurasi sistem.
* **LANGKAH**:
  1. Akses alamat web aplikasi Piket Guru pada peramban.
  2. Masukkan NIP: `198503152010011002`.
  3. Masukkan 6-digit PIN: `123456`.
  4. Klik tombol **Masuk ke Sistem**.
* **HASIL**: Sesi terverifikasi dengan role `ADMIN` dan dialihkan ke Dashboard.
* **CATATAN**: Akun otomatis terkunci selama 15 menit jika 5 kali berturut-turut salah memasukkan PIN.

---

## 2. DASHBOARD
* **TUJUAN**: Memantau ringkasan metrik kehadiran, pos tugas hari ini, dan insiden aktif secara real-time.
* **LANGKAH**: Buka menu **Dashboard** pada bilah navigasi kiri.
* **HASIL**: Tampil 4 kartu KPI, tabel radar guru piket hari ini, rekap tamu, dan radar insiden.
* **CATATAN**: Data terhubung dengan listener real-time Firestore tanpa perlu refresh manual.

---

## 3. MANAJEMEN USER (`users`)
* **TUJUAN**: Mengelola akun pengguna, hak akses peran (RBAC), dan status aktifasi akun.
* **LANGKAH**:
  1. Buka menu **Pengguna Sistem**.
  2. Klik **+ Tambah Pengguna**, isi NIP, Nama Lengkap, Peran, Email, Telepon, dan PIN awal.
  3. Untuk reset PIN pengguna: klik tombol **Reset PIN** pada kartu pengguna, masukkan PIN baru 6 digit, lalu simpan.
  4. Untuk non-aktifkan: geser toggle status akun menjadi non-aktif.
* **HASIL**: Akun pengguna terdaftar dengan salt kriptografis unik dan hash SHA-256.
* **CATATAN**: Pengguna non-aktif ditolak secara otomatis saat mencoba login.

---

## 4. MANAJEMEN GURU (`teachers`)
* **TUJUAN**: Mengelola master data profil dewan guru pengajar.
* **LANGKAH**: Buka menu **Master Data** ➔ Tab **Data Guru** ➔ Klik **+ Tambah Guru** (isi NIP, nama, mata pelajaran, pangkat golongan, status kepegawaian).
* **HASIL**: Guru baru tersimpan di database dan tersedia dalam daftar pembuat jadwal.
* **CATATAN**: NIP wajib unik dan tidak boleh ganda.

---

## 5. MANAJEMEN TENDIK (`staff`)
* **TUJUAN**: Mengelola data pegawai tata usaha, satpam, dan tenaga kependidikan.
* **LANGKAH**: Buka menu **Master Data** ➔ Tab **Data Staf** ➔ Klik **+ Tambah Staf** (pilih divisi: TU, Satpam, Sarpras, Perpustakaan, Lab).
* **HASIL**: Staf terdaftar untuk penugasan pos keamanan gerbang dan lobi.
* **CATATAN**: Relasi akun dapat ditautkan melalui field `userId`.

---

## 6. MASTER RUANG & POS PIKET (`rooms`)
* **TUJUAN**: Mendefinisikan titik pos pantau dan blok gedung sekolah.
* **LANGKAH**: Buka menu **Master Data** ➔ Tab **Data Ruang/Pos** ➔ Klik **+ Tambah Pos** (isi kode pos, nama pos, gedung, lantai).
* **HASIL**: Pos jaga terdaftar dan dapat dipilih saat membuat jadwal piket.
* **CATATAN**: Status non-aktif menyembunyikan pos dari pilihan pembuatan jadwal.

---

## 7. JADWAL PIKET (`schedules`)
* **TUJUAN**: Menyusun alokasi tugas piket harian dan mingguan bebas bentrok.
* **LANGKAH**:
  1. Buka menu **Jadwal Piket** ➔ Klik **+ Buat Jadwal Piket**.
  2. Pilih Petugas, Pos Jaga, Hari tugas (Senin–Sabtu), dan rentang jam (misal: 06:30–15:30).
  3. Klik **Simpan Jadwal**.
* **HASIL**: Jadwal tersimpan dan langsung tampil pada radar piket serta layar TV Kiosk.
* **CATATAN**: Sistem *Conflict Detection* otomatis menolak jadwal jika petugas atau pos yang sama dialokasikan pada jam beririsan.

---

## 8. MONITORING PRESENSI (`attendance`)
* **TUJUAN**: Memantau kehadiran fisik seluruh guru piket berdasarkan koordinat GPS dan swafoto.
* **LANGKAH**: Buka menu **Presensi Piket** untuk meninjau tabel presensi seluruh petugas.
* **HASIL**: Terlihat waktu check-in, check-out, jarak meter dari gerbang sekolah, akurasi sensor, dan foto selfie.
* **CATATAN**: Admin memiliki hak `attendance.view_all` untuk memantau seluruh guru.

---

## 9. MONITORING BUKU PIKET (`dutyBooks`)
* **TUJUAN**: Mengawasi alur dokumen buku piket dan membuka gembok darurat (Emergency Unlock).
* **LANGKAH**:
  1. Buka menu **Buku Piket**.
  2. Untuk membuka jurnal terkunci: klik tombol **Buka Gembok (Unlock)** pada jurnal berstatus `DIKUNCI`.
  3. Masukkan alasan tertulis pada dialog prompt, lalu klik konfirmasi.
* **HASIL**: Status jurnal kembali ke `DRAFT` dan alasan tercatat permanen pada Audit Trail.
* **CATATAN**: Fitur ini khusus hak Administrator (`dutybook.unlock`).

---

## 10. MONITORING KEJADIAN (`incidents`)
* **TUJUAN**: Meninjau laporan peristiwa dan insiden ketertiban siswa serta penanganannya.
* **LANGKAH**: Buka menu **Laporan Kejadian**, periksa tingkat keparahan (Rendah/Sedang/Tinggi/Kritis), dan perbarui status penanganan menjadi `SELESAI`.
* **HASIL**: Status insiden terbarui dan tercermin pada metrik radar insiden.
* **CATATAN**: Insiden kritis dapat dieskalasi langsung ke Kepala Sekolah.

---

## 11. DOKUMENTASI MEDIA
* **TUJUAN**: Mengarsipkan foto-foto kegiatan piket dan dokumentasi barang bukti.
* **LANGKAH**: Buka menu **Dokumentasi**, pratinjau foto kegiatan, atau hapus media yang tidak relevan.
* **HASIL**: Galeri foto tertata rapi dengan stempel waktu dan identitas pengunggah.
* **CATATAN**: Seluruh foto telah melalui kompresi otomatis (< 100KB).

---

## 12. LAPORAN DINAS
* **TUJUAN**: Menerbitkan rekapitulasi kehadiran, keterlambatan siswa, dan buku piket resmi.
* **LANGKAH**: Buka menu **Laporan**, tentukan rentang tanggal, klik **Pratinjau Cetak**, lalu cetak dokumen berformat kop surat resmi dinas.
* **HASIL**: Lembar kerja siap disahkan Kepala Sekolah.
* **CATATAN**: Cetak mendukung penyimpanan langsung ke format PDF melalui peramban.

---

## 13. IMPORT DATA
* **TUJUAN**: Mengimpor pangkalan data cadangan ke sistem (*Restore*).
* **LANGKAH**: Buka menu Pengaturan ➔ Tab Pencadangan ➔ Pilih Berkas Cadangan (.json) ➔ Konfirmasi Restore.
* **HASIL**: Data Firestore dipulihkan sesuai isi berkas cadangan.
* **CATATAN**: Selalu buat backup snapshot terkini sebelum menjalankan import.

---

## 14. EXPORT DATA
* **TUJUAN**: Mengekspor data laporan ke format Microsoft Excel (.xls), CSV (UTF-8 BOM), dan JSON.
* **LANGKAH**: Buka menu Laporan ➔ Klik tombol **Unduh Format Excel** atau **Unduh CSV**.
* **HASIL**: Berkas spreadsheet terunduh ke perangkat pengguna dengan format tabel rapi.
* **CATATAN**: Penanda UTF-8 BOM menjamin karakter khusus dan nomor NIP tidak rusak di Excel.

---

## 15. BACKUP DATABASE
* **TUJUAN**: Menghasilkan salinan cadangan lengkap 16 koleksi database Firestore.
* **LANGKAH**: Buka menu Pengaturan ➔ Tab Pencadangan ➔ Klik **Unduh Cadangan Lengkap**.
* **HASIL**: Berkas `backup-piket-guru-*.json` terunduh instan.
* **CATATAN**: Jadwalkan rutin setiap Jumat sore dan akhir bulan.

---

## 16. RESTORE DATABASE
* **TUJUAN**: Memulihkan pangkalan data sekolah saat terjadi bencana atau kegagalan sistem.
* **LANGKAH**: Buka menu Pengaturan ➔ Tab Pencadangan ➔ Unggah berkas JSON resmi ➔ Verifikasi rincian ➔ Klik **Pulihkan Database Sekarang**.
* **HASIL**: Dokumen dipulihkan dan peristiwa tercatat di log audit.
* **CATATAN**: Hanya dieksekusi atas perintah tertulis Kepala Sekolah.

---

## 17. PENGATURAN PROFIL & GEOFENCE
* **TUJUAN**: Mengonfigurasi identitas sekolah, koordinat GPS sekolah, dan radius presensi.
* **LANGKAH**:
  1. Buka menu **Pengaturan** ➔ Tab **Profil & GPS**.
  2. Masukkan Latitude & Longitude sekolah (atau klik *Deteksi Lokasi Perangkat*).
  3. Masukkan Radius Toleransi (misal: 100 meter) dan jam buka/tutup piket.
  4. Klik **Simpan Pengaturan**.
* **HASIL**: Batas geofence diperbarui untuk seluruh pengguna.
* **CATATAN**: Perubahan geofence langsung berdampak pada seluruh presensi guru.

---

## 18. STRUKTUR RBAC
* **TUJUAN**: Menegakkan pemisahan tugas (*Segregation of Duties*) pada 4 tingkatan peran pengguna.
* **LANGKAH**: Pantau matriks otorisasi pada tab Keamanan Siber untuk memastikan tidak ada peran yang memiliki hak akses berlebih.
* **HASIL**: Tata kelola akses sistem terjaga aman.
* **CATATAN**: Administrator memegang wildcard permission `['*']`.

---

## 19. AUDIT LOG FORENSIK (`auditLogs`)
* **TUJUAN**: Memeriksa rekam jejak digital aktivitas pengguna dan mendeteksi anomali operasional.
* **LANGKAH**: Buka menu Pengaturan ➔ Tab **Audit Forensik** ➔ Tinjau tabel riwayat (filter berdasarkan modul/tindakan).
* **HASIL**: Tampil stempel waktu presisi, identitas pelaku aksi, modul terdampak, dan rincian aktivitas.
* **CATATAN**: Koleksi `auditLogs` dilindungi aturan Firestore kebal edit dan kebal hapus permanen.

---

## 20. LOGOUT
* **TUJUAN**: Mengakhiri sesi kerja Administrator secara aman.
* **LANGKAH**: Klik nama profil Admin di pojok kanan atas ➔ Klik tombol **Keluar (Logout)**.
* **HASIL**: Token sesi dihapus dari memori peramban dan dialihkan ke gerbang login.
* **CATATAN**: Selalu biasakan logout saat meninggalkan meja kerja.
