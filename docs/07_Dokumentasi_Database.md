```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                   Dokumen: 07 — DOKUMENTASI DATABASE
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 07_Dokumentasi_Database
* **Klasifikasi**: TECHNICAL / CONFIDENTIAL
* **Tipe Basis Data**: NoSQL Document Database (Google Cloud Firestore)
* **Instance ID**: `ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192`

---

## 1. ENTITY RELATIONSHIP DIAGRAM (ERD KONSEPTUAL)

```
[ users ]
   │ 1:1
   ├───> [ teachers ] (Master Dewan Guru)
   │ 1:1
   ├───> [ staff ] (Master Tenaga Kependidikan)
   │ 1:N
   ├───> [ schedules ] (Jadwal Penugasan Piket)
   │        │
   │        ├── 1:N ──> [ attendance ] (Presensi GPS & Swafoto)
   │        │
   │        ├── 1:N ──> [ dutyBooks ] (Jurnal Piket Harian 5 Kondisi)
   │        │
   │        └── 1:N ──> [ incidents ] (Laporan Kejadian & Insiden)
   │
   └── 1:N ──> [ auditLogs ] (Audit Trail Forensik Kebal Hapus)
```

### Alur Keterkaitan Operasional (Operational Flow):
```
PENGGUNA (USER)
       ↓
JADWAL PENUGASAN (SCHEDULE)
       ↓
PRESENSI MANDIRI (ATTENDANCE) ──> BUKTI SWAFOTO
       ↓
PENGISIAN JURNAL (DUTY BOOK)  ──> PENCATATAN INSIDEN (INCIDENTS)
       ↓
DOKUMENTASI MEDIA (DOCUMENTS) ──> REKAP LAPORAN (REPORTS)
```

---

## 2. SPESIFIKASI KOLEKSI DOKUMEN FIRESTORE

### A. Koleksi `settings` (Dokumen: `school_config`)
* **Fungsi**: Konfigurasi identitas sekolah, koordinat GPS, dan jam dinas.
* **Fields**:
  - `id` (string, required): ID konstan `'school_config'`.
  - `schoolName` (string, required): Nama sekolah.
  - `npsn` (string, required): Nomor Pokok Sekolah Nasional.
  - `address` (string, required): Alamat instansi.
  - `schoolLat` (number, required): Koordinat lintang sekolah (contoh: `-6.200000`).
  - `schoolLng` (number, required): Koordinat bujur sekolah (contoh: `106.816666`).
  - `allowedRadiusMeters` (number, required): Batas radius presensi meter (default: `100`).
  - `workHours` (map, required): `{ start: string, end: string }`.

---

### B. Koleksi `users`
* **Fungsi**: Kredensial akun pengguna dan hak akses peran.
* **Fields**:
  - `id` (string, required): Primary key pengguna.
  - `nip` (string, required, indexed): NIP/NIK login.
  - `fullName` (string, required): Nama lengkap beserta gelar.
  - `role` (string, required): `'ADMIN' | 'KEPALA_SEKOLAH' | 'GURU' | 'TENAGA_KEPENDIDIKAN' | 'SATPAM'`.
  - `email` (string, required): Email resmi.
  - `phone` (string, required): No. WhatsApp/telepon.
  - `pinHash` (string, required): Hash SHA-256 ber-salt.
  - `pinSalt` (string, required): Salt acak 16 karakter.
  - `permissions` (array of strings, required): Daftar izin modular pengguna.
  - `isActive` (boolean, required): Status keaktifan akun.
  - `loginAt` (number, optional): Waktu milidetik login terakhir.

---

### C. Koleksi `teachers` & `staff`
* **Fungsi**: Master data resmi guru dan tenaga kependidikan.
* **Fields `teachers`**: `id`, `userId`, `nip`, `fullName`, `mataPelajaran`, `pangkatGolongan`, `statusKepegawaian` (PNS/PPPK/GTT/HONORER), `phone`, `email`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
* **Fields `staff`**: `id`, `userId`, `nip`, `fullName`, `divisi`, `jabatan`, `statusKepegawaian`, `phone`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

---

### D. Koleksi `rooms` & `incidentCategories`
* **Fields `rooms`**: `id`, `code`, `name`, `building`, `floor`, `capacity`, `isActive`, `createdAt`, `updatedAt`.
* **Fields `incidentCategories`**: `id`, `code`, `name`, `description`, `severity` (RENDAH, SEDANG, TINGGI, KRITIS), `isActive`, `createdAt`, `updatedAt`.

---

### E. Koleksi `schedules`
* **Fungsi**: Jadwal penugasan piket.
* **Fields**: `id`, `tanggal` (ISO Date), `hari` (SENIN..SABTU), `jamMulai`, `jamSelesai`, `petugasId`, `petugasName`, `petugasRole`, `ruangId`, `ruangName`, `status` (TERJADWAL, BERJALAN, SELESAI, DIGANTIKAN, DIBATALKAN), `keterangan`.

---

### F. Koleksi `attendance`
* **Fungsi**: Presensi fisik guru piket.
* **Fields**: `id`, `scheduleId`, `userId`, `userName`, `tanggal`, `jamMasuk`, `jamPulang`, `latitude`, `longitude`, `accuracy`, `distance`, `status` (DALAM_LOKASI, DI_LUAR_LOKASI, GPS_ERROR, AKURASI_RENDAH), `photoUrl` (Base64 data URI).

---

### G. Koleksi `dutyBooks`
* **Fungsi**: Jurnal buku piket harian sekolah.
* **Fields**: `id`, `scheduleId`, `petugasId`, `petugasName`, `tanggal`, `jamMulai`, `jamSelesai`, `kondisiKeamanan`, `kondisiKebersihan`, `kondisiKelas`, `kondisiFasilitas`, `kondisiSiswa`, `catatanPiket`, `status` (DRAFT, DIAJUKAN, DIVERIFIKASI, DISETUJUI, DIKUNCI).

---

### H. Koleksi `incidents`
* **Fungsi**: Laporan peristiwa lapangan dan tindak lanjutnya.
* **Fields**: `id`, `tanggal`, `waktu`, `pelaporId`, `pelaporName`, `lokasi`, `kategori`, `uraian`, `tindakanAwal`, `status` (DILAPORKAN, DALAM_PENANGANAN, SELESAI, DIPERLUKAN_ESKALASI).

---

### I. Koleksi `auditLogs` (Immutable Forensic Trail)
* **Fungsi**: Jejak digital tak terhapuskan untuk seluruh aksi sistem.
* **Fields**: `id`, `userId`, `userName`, `role`, `action` (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, BACKUP, RESTORE, STATUS_CHANGE, SECURITY, EMERGENCY), `module`, `details`, `timestamp` (ISO 8601).
