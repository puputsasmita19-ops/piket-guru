# DOKUMENTASI KEAMANAN: ATURAN CLOUD FIRESTORE (SECURITY RULES)
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Dokumen ini menjelaskan implementasi aturan keamanan Firestore (`firestore.rules`) yang aktif pada basis data cloud institusi sekolah (`ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192`).

---

### 1. PRINSIP KEAMANAN BASIS DATA
Aplikasi dirancang untuk melayani lingkungan operasional sekolah yang terdiri atas:
1. **Layar Publik & Lobi Kiosk**: Memerlukan akses baca waktu nyata terhadap profil instansi, running text pengumuman, dan jadwal guru piket hari ini tanpa meminta pengguna Smart TV lobi untuk melakukan login berulang.
2. **Klien Pengguna Terotentikasi (Guru, Staf, Kepala Sekolah, Admin)**: Menjalankan transaksi presensi, pencatatan tamu, pengisian jurnal, dan rekapitulasi data yang diverifikasi melalui lapisan otentikasi aplikasi (*Application-Level RBAC Engine*).
3. **Audit Log Forensik yang Kebal Manipulasi (Immutable Audit Trail)**: Mengunci seluruh operasi `update` dan `delete` pada tingkat mesin Firestore, menjamin tidak ada pengguna atau peretas yang dapat menghapus jejak audit aktivitas sistem.

---

### 2. MATRIKS ATURAN AKSES PER KOLEKSI (FIRESTORE SECURITY MATRIX)

Berikut adalah ringkasan aturan hak akses per koleksi dokumen pada Firestore:

| Nama Koleksi Firestore | Baca (*Read*) | Tambah (*Create*) | Perbarui (*Update*) | Hapus (*Delete*) | Prinsip Keamanan & Penegakan |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `/settings/{settingId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Akses baca publik untuk Kiosk TV dan konfigurasi aplikasi; pembaruan dibatasi via RBAC Admin pada UI. |
| `/users/{userId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Akses baca NIP untuk otentikasi login; hash PIN terlindungi enkripsi salted SHA-256. |
| `/teachers/{teacherId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Referensi master dewan guru pengajar. |
| `/staff/{staffId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Referensi master pegawai dan staf kependidikan. |
| `/rooms/{roomId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Master data pos dan ruangan sekolah. |
| `/incidentCategories/{id}`| Diizinkan | Diizinkan | Diizinkan | Diizinkan | Klasifikasi jenis dan tingkat urgensi insiden. |
| `/schedules/{scheduleId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Publik untuk tampilan jadwal lobi Kiosk TV; pembuatan/penghapusan dikendalikan Admin. |
| `/attendance/{attendanceId}`| Diizinkan | Diizinkan | Diizinkan | Diizinkan | Presensi mandiri guru; validasi jarak geofence diverifikasi pada level aplikasi. |
| `/dutyBooks/{dutyBookId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Jurnal piket harian; hak edit dibatasi berdasarkan kepemilikan guru (`petugasId`). |
| `/incidents/{incidentId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Laporan kejadian dan riwayat penanganan lapangan. |
| `/documents/{docId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Metadata dokumen dan berkas arsip pendukung. |
| `/announcements/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Ticker pengumuman untuk papan display Kiosk TV. |
| `/studentTardiness/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Rekaman siswa terlambat masuk sekolah. |
| `/substitutions/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Penugasan mutasi guru pengganti (inval). |
| `/studentPermits/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Buku izin siswa meninggalkan kelas. |
| `/visitors/{visitorId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Buku tamu digital resepsionis dan gerbang. |
| `/auditLogs/{logId}` | **Diizinkan** | **Diizinkan** | **DITOLAK (false)** | **DITOLAK (false)** | **KEBAL HAPUS/UBAH (IMMUTABLE)**: Tidak ada pengguna yang dapat mengubah atau menghapus jejak log audit. |
| `/backups/{backupId}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Snapshot cadangan database darurat. |
| `/emergencies/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Sinyal darurat sekolah terdistribusi real-time. |
| `/emergency_history/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Riwayat pengaktifan sirine darurat. |
| `/database_snapshots/{id}` | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Arsip snapshot pemulihan bencana. |

---

### 3. PENEGAKAN KEAMANAN BERLAPIS (DEFENSE-IN-DEPTH)
Keamanan aplikasi tidak hanya bertumpu pada aturan Firestore, melainkan menerapkan model pertahanan berlapis:
1. **Lapisan Database (Firestore Engine)**:
   - Menjamin bahwa riwayat audit (`auditLogs`) dikunci permanen: siapapun yang mengirim permintaan HTTP DELETE atau UPDATE ke koleksi log audit akan ditolak secara mutlak oleh kernel Firestore.
2. **Lapisan Layanan Data (`firestoreService.ts`)**:
   - Melakukan pembersihan data (*payload sanitization*), menghapus field yang bernilai `undefined`, memvalidasi tipe data sebelum transaksi dikirim ke cloud.
3. **Lapisan Otorisasi Antarmuka (`permissions.ts` & `AuthContext.tsx`)**:
   - Memvalidasi peran dan hak akses pengguna sebelum merender tombol aksi (misal: tombol *Setujui Jurnal* hanya muncul untuk peran Kepala Sekolah).
   - Mengalihkan rute secara paksa apabila terjadi manipulasi URL oleh pengguna tanpa wewenang.
