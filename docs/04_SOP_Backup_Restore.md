```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                    Dokumen: 04 — SOP BACKUP & RESTORE
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 04_SOP_Backup_Restore
* **Klasifikasi**: ADMIN / TECHNICAL
* **Penanggung Jawab**: Administrator IT Sekolah & Kepala Sekolah

---

> # PERINGATAN RESMI ADMINISTRATIF
> **OPERASI RESTORE DATABASE ADALAH TINDAKAN TINGKAT TINGGI YANG MENGGANTIKAN DATA AKTIF SISTEM. TINDAKAN INI TIDAK BOLEH DILAKUKAN SEMBARANGAN KARENA DAPAT MEMENGARUHI DATA PRODUKSI. WAJIB DIDAHULUI DENGAN PENCADANGAN SNAPSHOT DARURAT TERKINI DAN DISPOSISI TERTULIS KEPALA SEKOLAH.**

---

# STANDAR OPERASIONAL PROSEDUR (SOP)
## PENCADANGAN DAN PEMULIHAN PANGKALAN DATA (DISASTER RECOVERY)

---

### A. TUJUAN
1. Menjamin kesinambungan operasional sistem informasi piket sekolah dari potensi kehilangan data akibat kerusakan gawai, kesalahan manusia, maupun gangguan server awan (*cloud*).
2. Menyediakan panduan baku teknis pencadangan berkala 1-klik untuk seluruh 16 koleksi database Firestore.
3. Memberikan prosedur pemulihan data (*restore*) yang terverifikasi dan aman tanpa merusak integritas sistem.

---

### B. RUANG LINGKUP
SOP ini mencakup seluruh data transaksi dan master yang berada di dalam basis data Google Cloud Firestore aplikasi Piket Guru, mencakup 16 koleksi data:
1. `users`, 2. `teachers`, 3. `staff`, 4. `rooms`, 5. `incidentCategories`, 6. `schedules`, 7. `attendance`, 8. `dutyBooks`, 9. `incidents`, 10. `settings`, 11. `auditLogs`, 12. `announcements`, 13. `studentTardiness`, 14. `substitutions`, 15. `studentPermits`, dan 16. `visitors`.

---

### C. TANGGUNG JAWAB
* **Pelaksana Utama**: Administrator IT Sekolah (pemilik izin `backup.create` dan `backup.restore`).
* **Pengawas & Otorisator**: Kepala Sekolah.

---

### D. JADWAL BACKUP
* **Pencadangan Rutin Mingguan**: Dilakukan setiap hari Jumat pukul 16.00 WIB setelah seluruh aktivitas pembelajaran dan piket minggu berjalan selesai.
* **Pencadangan Rutin Bulanan**: Dilakukan pada hari kerja terakhir setiap akhir bulan sebelum penerbitan laporan dinas resmi.
* **Pencadangan Pra-Pemeliharaan**: Wajib dilakukan sebelum Admin melakukan rotasi jadwal semester baru atau pengubahan parameter geofence.

---

### E. PROSEDUR BACKUP
1. Login menggunakan akun Administrator.
2. Buka menu **Pengaturan Sistem** ➔ Pilih tab **Pencadangan & Pemulihan**.
3. Pastikan koneksi internet stabil (disarankan minimal kecepatan 5 Mbps).
4. Klik tombol **Unduh Cadangan Lengkap**.
5. Sistem secara otomatis membaca 16 koleksi Firestore dan mengunduh berkas tunggal berformat `.json` dengan pola penamaan:
   `backup-piket-guru-YYYY-MM-DD-HH-mm.json`.

---

### F. VERIFIKASI BACKUP
Setelah berkas cadangan terunduh, Administrator wajib memverifikasi:
1. Ukuran berkas tidak boleh 0 KB (berkas utuh minimal berukuran 10 KB).
2. Buka berkas dengan text editor (Notepad / VS Code) dan pastikan header memuat kunci:
   `"app": "Piket Guru"`, `"version": "1.0.0"`, `"timestamp"`, serta blok array data 16 koleksi.

---

### G. PENYIMPANAN BACKUP
Berkas cadangan wajib disimpan secara redundant pada:
1. Penyimpanan Lokal: Komputer Server / Laptop IT Sekolah (folder khusus terenkripsi).
2. Penyimpanan Awan Resmi: Google Drive dinas sekolah pada folder `PIKET_GURU_ARSIP/01_CADANGAN_DATABASE/`.

---

### H. RETENSI
* Berkas cadangan mingguan disimpan sekurang-kurangnya selama **3 bulan**.
* Berkas cadangan akhir semester dan tahunan disimpan secara **permanen**.

---

### I. PROSEDUR RESTORE
1. Terbitkan pengumuman darurat agar seluruh guru tidak melakukan transaksi input (presensi/jurnal) selama proses restore.
2. **Langkah Wajib**: Buat cadangan data saat ini (*Emergency Snapshot*) dengan mengklik *Unduh Cadangan Lengkap*.
3. Pada tab Pencadangan & Pemulihan, klik **Pilih Berkas Cadangan (.json)**.
4. Pilih berkas backup resmi yang sah.
5. Sistem menjalankan fungsi `validateBackupSchema`. Jika berkas valid, muncul jendela **Modal Konfirmasi Pemulihan Data** yang menampilkan tanggal pembuatan, pembuat cadangan, dan jumlah dokumen per koleksi.
6. Periksa rincian data dengan saksama.
7. Klik tombol merah **Pulihkan Database Sekarang**.
8. Tunggu hingga proses sinkronisasi Firestore selesai dan banner sukses berwarna hijau muncul di layar.

---

### J. VALIDASI SETELAH RESTORE
Administrator wajib melakukan pemeriksaan pasca-pemulihan:
1. Memeriksa menu Master Data (Guru, Staf, Ruang) untuk memastikan data utuh.
2. Memeriksa menu Jadwal dan Presensi piket.
3. Melakukan uji coba login menggunakan akun guru.

---

### K. DOKUMENTASI RESTORE
Sistem secara otomatis menginjeksi log aksi `RESTORE` ke dalam koleksi `auditLogs` yang memuat identitas Admin, waktu pelaksanaan, dan nama berkas yang dipulihkan sebagai bukti audit forensik.

---

### L. KONDISI DARURAT
Jika terjadi kegagalan koneksi saat proses restore berlangsung, segera refresh halaman, periksa log audit, dan ulangi proses restore menggunakan berkas backup cadangan yang sama. Jika kendala berlanjut, hubungi penyedia layanan cloud.
