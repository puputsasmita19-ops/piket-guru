# STANDAR OPERASIONAL PROSEDUR (SOP)
## PENCADANGAN DAN PEMULIHAN DATABASE (BACKUP & RESTORE)

* **Nomor Dokumen**: SOP/IT/003-BCK-RST
* **Edisi / Revisi**: 01 / 00
* **Tanggal Efektif**: 30 September 2026
* **Status Aplikasi**: Production v1.0.0

---

> # PERINGATAN KEAMANAN TINGGI
> **TINDAKAN RESTORE DATABASE ADALAH OPERASI TEKNIS TINGKAT TINGGI YANG MENGGANTIKAN DATA AKTIF SISTEM. DILARANG MELAKUKAN PEMULIHAN TANPA INSTRUKSI FORMAL DAN PERSIAPAN CADANGAN TERAKHIR. KESALAHAN PENGGUNAAN BERKAS CADANGAN DAPAT MENGAKIBATKAN ANOMALI ATAU HILANGNYA DATA TERBARU.**

---

### A. PENCADANGAN DATABASE (BACKUP)

#### 1. Cakupan Data yang Dicadangkan
Modul pencadangan (`backupService.ts`) mencakup seluruh ekosistem basis data cloud sekolah yang terdiri dari **16 Koleksi Firestore**:
1. `users`: Kredensial akun pengguna, NIP, peran, dan hash PIN.
2. `teachers`: Master data profil guru dan mata pelajaran.
3. `staff`: Master data staf dan tenaga kependidikan.
4. `rooms`: Master data ruang dan pos piket sekolah.
5. `incidentCategories`: Referensi jenis dan bobot pelanggaran/insiden.
6. `schedules`: Jadwal penugasan piket harian dan berkala.
7. `attendance`: Rekaman presensi GPS, waktu masuk/pulang, dan foto.
8. `dutyBooks`: Jurnal buku piket harian beserta 5 parameter kondisi.
9. `incidents`: Catatan insiden, kronologi, dan tindakan penanganan.
10. `settings`: Profil sekolah, koordinat GPS geofence, dan jam kerja.
11. `auditLogs`: Riwayat jejak audit forensik aktivitas pengguna.
12. `announcements`: Data pengumuman dan ticker berjalan Kiosk.
13. `studentTardiness`: Rekapitulasi data siswa terlambat masuk.
14. `substitutions`: Data mutasi penugasan guru pengganti (inval).
15. `studentPermits`: Arsip surat izin siswa keluar sekolah.
16. `visitors`: Catatan buku tamu digital kedinasan dan umum.

#### 2. Waktu Pelaksanaan Pencadangan
* **Pencadangan Rutin Mingguan**: Dilakukan setiap hari Jumat sore setelah seluruh shift piket minggu berjalan selesai.
* **Pencadangan Bulanan**: Dilakukan pada hari kerja terakhir setiap akhir bulan sebelum penerbitan laporan dinas.
* **Pencadangan Pra-Pemeliharaan**: Wajib dilakukan sebelum Administrator melakukan perubahan konfigurasi sekolah, rotasi semester, atau eksekusi reset massal.

#### 3. Penanggung Jawab
Pencadangan hanya dapat dieksekusi oleh personel dengan peran **ADMINISTRATOR** yang memiliki izin `backup.create`.

#### 4. Prosedur Pembuatan Cadangan
1. Login menggunakan akun Administrator.
2. Buka menu **Pengaturan Sistem** ➔ Pilih tab **Pencadangan & Pemulihan**.
3. Pastikan koneksi internet stabil.
4. Klik tombol **Unduh Cadangan Lengkap**.
5. Sistem menyusun berkas JSON tunggal berstruktur:
   - Header schema: `version`, `app`, `timestamp`, `createdBy`.
   - Metadata: `schoolName`, `npsn`, `totalCollections`, `totalRecords`.
   - Data payload: 16 koleksi dokumen.
6. Berkas otomatis terunduh dengan format penamaan: `backup-piket-guru-YYYY-MM-DD-HH-mm.json`.

#### 5. Lokasi Penyimpanan & Retensi Berkas
* Berkas cadangan wajib disimpan minimal pada dua lokasi terpisah:
  1. *Penyimpanan Lokal*: Komputer server/laptop IT sekolah (folder terenkripsi).
  2. *Cloud Storage Kedinasan*: Google Drive resmi sekolah pada folder khusus arsip backup IT.
* **Masa Retensi**: Berkas cadangan mingguan disimpan minimal selama 3 bulan; berkas cadangan akhir semester/tahunan disimpan permanen.

#### 6. Cara Memverifikasi Berkas Cadangan
* Buka berkas JSON menggunakan text editor (Notepad / VS Code).
* Periksa baris awal berkas: pastikan properti `"app": "Piket Guru"` dan `"version": "1.0.0"` tercantum secara utuh, serta ukuran berkas lebih besar dari 10 KB.

---

### B. PEMULIHAN DATABASE (RESTORE)

#### 1. Kondisi Pelaksanaan Pemulihan
Pemulihan database hanya boleh dilakukan pada kondisi:
* Kerusakan integritas data akibat bencana alam atau kegagalan sistem.
* Terjadinya penghapusan data massal yang tidak disengaja oleh staf operasional.
* Migrasi pangkalan data ke lingkungan server/proyek baru.

#### 2. Langkah Persiapan Wajib
1. **Buat Cadangan Terkini (Emergency Snapshot)**: Sebelum memulihkan data lama, unduh cadangan kondisi saat ini agar data yang dibuat hari ini tidak hilang permanen.
2. Informasikan kepada Kepala Sekolah dan umumkan kepada seluruh guru agar tidak melakukan input data (presensi/jurnal) selama proses pemulihan berlangsung.

#### 3. Prosedur Verifikasi Berkas Sebelum Restore
Sistem telah dilengkapi fungsi validasi skema otomatis (`BackupService.validateBackupSchema`):
* Memeriksa apakah berkas merupakan format JSON yang valid.
* Memastikan keberadaan kunci `"app"`, `"version"`, `"timestamp"`, dan blok data utama.
* Jika berkas rusak atau berasal dari aplikasi lain, sistem akan memunculkan pesan galat penolakan dan membatalkan proses.

#### 4. Prosedur Eksekusi Pemulihan
1. Buka menu **Pengaturan Sistem** ➔ Tab **Pencadangan & Pemulihan**.
2. Pada bagian *Pemulihan Database*, klik tombol **Pilih Berkas Cadangan (.json)**.
3. Pilih berkas backup yang telah diverifikasi.
4. Sistem membuka jendela **Modal Konfirmasi Pemulihan Data**:
   - Menampilkan tanggal pembuatan berkas, nama admin pembuat cadangan, dan ringkasan jumlah dokumen yang akan dipulihkan.
5. Periksa kembali informasi dengan teliti.
6. Klik tombol merah **Pulihkan Database Sekarang**.
7. Sistem melakukan penulisan ulang dokumen ke Firestore secara bertahap.
8. Setelah selesai, banner hijau sukses akan muncul: *"Pemulihan database berhasil! [N] dokumen telah disinkronkan ke Firestore"*.

#### 5. Validasi Data Pasca-Restore
Setelah proses pemulihan selesai, Administrator wajib memeriksa:
* Menu **Master Data**: Pastikan daftar guru, staf, dan ruang tampil utuh.
* Menu **Jadwal Piket**: Pastikan alokasi jadwal aktif kembali normal.
* Menu **Presensi & Buku Piket**: Pastikan arsip jurnal sebelumnya telah kembali.
* Melakukan uji coba login menggunakan akun salah satu guru.

#### 6. Dokumentasi Kejadian Pemulihan
Setiap proses restore secara otomatis menginjeksi log peristiwa ke dalam koleksi `auditLogs` dengan tindakan `RESTORE`, mencakup:
* Identitas Administrator pelaksana.
* Stempel waktu pelaksanaan.
* Nama berkas cadangan dan jumlah dokumen yang berhasil dipulihkan.
