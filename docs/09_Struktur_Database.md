# SPESIFIKASI TEKNIS: STRUKTUR BASIS DATA (FIRESTORE)
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Basis data aplikasi menggunakan **Google Cloud Firestore (NoSQL Document Store)** yang terstruktur ke dalam koleksi-koleksi dokumen terindeks untuk menjamin efisiensi kueri dan skalabilitas tinggi.

---

### DIAGRAM RELASI ENTITAS SEDERHANA (ERD KONSEPTUAL)

```
                 ┌───────────────────────────┐
                 │       users (Pengguna)    │
                 │  id, nip, role, pinHash   │
                 └─────────────┬─────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │ 1:1              │ 1:N              │ 1:N
            ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ teachers / staff │  │ schedules        │  │ auditLogs        │
│ Master Guru/Staf │  │ Jadwal Piket     │  │ Jejak Audit      │
└──────────────────┘  └────────┬─────────┘  └──────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │ 1:N              │ 1:N              │ 1:N
            ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ attendance       │  │ dutyBooks        │  │ incidents        │
│ Presensi GPS/Foto│  │ Jurnal Piket     │  │ Laporan Kejadian │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ studentTardiness │  │ studentPermits   │  │ visitors         │
│ Siswa Terlambat  │  │ Izin Siswa       │  │ Buku Tamu        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

### RINCIAN KOLEKSI BASIS DATA (COLLECTION SPECIFICATION)

#### 1. Koleksi: `settings` (Dokumen Utama: `school_config`)
* **Fungsi**: Menyimpan profil instansi, titik koordinat GPS gerbang sekolah, dan jam kerja dinas.
* **Fields**:
  - `id` (string, required): ID dokumen konstan (`school_config`).
  - `schoolName` (string, required): Nama resmi sekolah.
  - `npsn` (string, required): Nomor Pokok Sekolah Nasional.
  - `address` (string, required): Alamat lengkap sekolah.
  - `schoolLat` (number, required): Koordinat lintang (Latitude) sekolah (contoh: `-6.200000`).
  - `schoolLng` (number, required): Koordinat bujur (Longitude) sekolah (contoh: `106.816666`).
  - `allowedRadiusMeters` (number, required): Batas radius presensi yang sah dalam meter (default: `100`).
  - `workHours` (map, required):
    - `start` (string, required): Jam buka piket (contoh: `'06:30'`).
    - `end` (string, required): Jam penutupan piket (contoh: `'15:30'`).
  - `createdAt` / `updatedAt` (string, optional ISO 8601).

---

#### 2. Koleksi: `users`
* **Fungsi**: Menyimpan akun pengguna, hak akses peran (RBAC), dan kredensial PIN terenkripsi.
* **Fields**:
  - `id` (string, required): ID unik pengguna (contoh: `usr-admin-01`).
  - `nip` (string, required, indexed): NIP/NIK pengguna sebagai identitas login utama.
  - `fullName` (string, required): Nama lengkap beserta gelar akademik.
  - `role` (string, required): `ADMIN` | `KEPALA_SEKOLAH` | `GURU` | `TENAGA_KEPENDIDIKAN` | `SATPAM`.
  - `email` (string, required): Alamat email resmi.
  - `phone` (string, required): Nomor telepon / WhatsApp aktif.
  - `pinSalt` (string, required): Nilai salt kriptografis acak heksadesimal 16 karakter.
  - `pinHash` (string, required): Hasil hash Salted SHA-256 dari 6-digit PIN.
  - `permissions` (array of strings, required): Hak izin modular pengguna (contoh: `['*']`).
  - `isActive` (boolean, required): Status akun (`true` aktif, `false` ditangguhkan).
  - `loginAt` (number, optional): Stempel waktu milidetik sesi login terakhir.
  - `createdAt` / `updatedAt` (string, optional ISO 8601).
* **Relationship**: Terhubung ke `teachers.userId` atau `staff.userId`.

---

#### 3. Koleksi: `teachers`
* **Fungsi**: Master data resmi dewan guru pengajar.
* **Fields**:
  - `id` (string, required): ID guru (contoh: `tch-01`).
  - `userId` (string, optional): Relasi ke `users.id`.
  - `nip` (string, required): Nomor Induk Pegawai.
  - `fullName` (string, required): Nama lengkap guru.
  - `mataPelajaran` (string, required): Mata pelajaran yang diampu.
  - `pangkatGolongan` (string, required): Pangkat dinas (misal: *Pembina / IV-a*).
  - `statusKepegawaian` (string, required): `'PNS' | 'PPPK' | 'GTT' | 'HONORER'`.
  - `phone` (string, required): Nomor telepon.
  - `email` (string, required): Alamat email.
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (string, required).

---

#### 4. Koleksi: `staff`
* **Fungsi**: Master data staf tata usaha, pustakawan, dan keamanan sekolah.
* **Fields**:
  - `id` (string, required): ID staf (contoh: `stf-01`).
  - `userId` (string, optional): Relasi ke `users.id`.
  - `nip` (string, required): NIP atau NIK pegawai.
  - `fullName` (string, required): Nama lengkap staf.
  - `divisi` (string, required): `'Tata Usaha' | 'Keamanan/Satpam' | 'Kebersihan' | 'Sarpras' | 'Perpustakaan' | 'Laboratorium'`.
  - `jabatan` (string, required): Jabatan kerja staf.
  - `statusKepegawaian` (string, required): `'PNS' | 'PPPK' | 'PTT' | 'HONORER'`.
  - `phone` (string, required): Nomor telepon.
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (string, required).

---

#### 5. Koleksi: `rooms`
* **Fungsi**: Master data pos piket, blok gedung, dan ruangan pemantauan.
* **Fields**:
  - `id` (string, required): ID ruangan/pos (contoh: `room-01`).
  - `code` (string, required): Kode pos (misal: `'POS-01'`).
  - `name` (string, required): Nama pos (misal: `'Pos Utama & Gerbang Depan'`).
  - `building` (string, required): Nama gedung sekolah.
  - `floor` (number, required): Posisi lantai gedung (1, 2, 3).
  - `capacity` (number, optional): Kapasitas pos.
  - `isActive` (boolean, required): Status operasional pos (`true`/`false`).
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (string, required).

---

#### 6. Koleksi: `incidentCategories`
* **Fungsi**: Master klasifikasi jenis dan bobot pelanggaran/kejadian.
* **Fields**:
  - `id` (string, required): ID kategori insiden.
  - `code` (string, required): Kode singkatan (misal: `'DIS-01'`).
  - `name` (string, required): Nama kategori insiden.
  - `description` (string, required): Uraian penjelasan kategori.
  - `severity` (string, required): `'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS'`.
  - `isActive` (boolean, required): Status aktif kategori.
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (string, required).

---

#### 7. Koleksi: `schedules`
* **Fungsi**: Menyimpan penugasan jadwal piket harian dan mingguan.
* **Fields**:
  - `id` (string, required): ID jadwal (contoh: `sch-001`).
  - `tanggal` (string, optional ISO YYYY-MM-DD): Tanggal spesifik pelaksanaan (opsional jika template hari).
  - `hari` (string, required): `'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU'`.
  - `jamMulai` (string, required): Format `'HH:mm'` (misal: `'06:30'`).
  - `jamSelesai` (string, required): Format `'HH:mm'` (misal: `'15:30'`).
  - `petugasId` (string, required): Relasi ke `teachers.id` atau `staff.id`.
  - `petugasName` (string, required): Nama lengkap petugas piket.
  - `petugasRole` (string, required): Peran petugas piket.
  - `ruangId` (string, required): Relasi ke `rooms.id`.
  - `ruangName` (string, required): Nama pos jaga yang dialokasikan.
  - `status` (string, required): `'TERJADWAL' | 'BERJALAN' | 'SELESAI' | 'DIGANTIKAN' | 'DIBATALKAN'`.
  - `keterangan` (string, optional): Catatan fokus tugas.

---

#### 8. Koleksi: `attendance`
* **Fungsi**: Rekaman kehadiran fisik dan bukti swafoto petugas piket.
* **Fields**:
  - `id` (string, required): ID rekaman presensi.
  - `scheduleId` (string, required): Relasi ke `schedules.id`.
  - `userId` (string, required): Relasi ke `users.id`.
  - `userName` (string, required): Nama petugas.
  - `tanggal` (string, required): Tanggal presensi (YYYY-MM-DD).
  - `jamMasuk` (string, required): Waktu check-in masuk (HH:mm).
  - `jamPulang` (string, optional): Waktu check-out kepulangan (HH:mm).
  - `latitude` (number, required): Koordinat GPS lintang aktual.
  - `longitude` (number, required): Koordinat GPS bujur aktual.
  - `accuracy` (number, required): Nilai deviasi akurasi sensor HP (dalam meter).
  - `distance` (number, required): Jarak kalkulasi Haversine dari titik gerbang sekolah (meter).
  - `status` (string, required): `'DALAM_LOKASI' | 'DI_LUAR_LOKASI' | 'GPS_ERROR' | 'AKURASI_RENDAH'`.
  - `photoUrl` (string, optional): Data URI string foto selfie terkompresi.

---

#### 9. Koleksi: `dutyBooks`
* **Fungsi**: Jurnal buku piket harian digital.
* **Fields**:
  - `id` (string, required): ID jurnal buku piket.
  - `scheduleId` (string, required): Relasi ke `schedules.id`.
  - `petugasId` (string, required): Relasi ke `users.id` pembuat draft.
  - `petugasName` (string, required): Nama guru penyusun jurnal.
  - `tanggal` (string, required): Tanggal piket (YYYY-MM-DD).
  - `jamMulai` / `jamSelesai` (string, required): Rentang jam pelaksanaan.
  - `kondisiKeamanan` (string, required): Catatan evaluasi keamanan.
  - `kondisiKebersihan` (string, required): Catatan evaluasi kebersihan.
  - `kondisiKelas` (string, required): Catatan evaluasi KBM & ketertiban kelas.
  - `kondisiFasilitas` (string, required): Catatan evaluasi sarpras.
  - `kondisiSiswa` (string, required): Catatan evaluasi kedisiplinan siswa.
  - `catatanPiket` (string, required): Ringkasan kesimpulan dan saran.
  - `status` (string, required): `'DRAFT' | 'DIAJUKAN' | 'DIVERIFIKASI' | 'DISETUJUI' | 'DIKUNCI'`.

---

#### 10. Koleksi: `incidents`
* **Fungsi**: Rekapitulasi peristiwa/insiden dan penanganan kedisiplinan.
* **Fields**:
  - `id` (string, required): ID insiden unik.
  - `tanggal` (string, required): Tanggal peristiwa (YYYY-MM-DD).
  - `waktu` (string, required): Jam terjadinya insiden (HH:mm).
  - `pelaporId` (string, required): Relasi ke `users.id` pelapor.
  - `pelaporName` (string, required): Nama petugas pelapor.
  - `lokasi` (string, required): Tempat kejadian di sekolah.
  - `kategori` (string, required): `'SISWA' | 'FASILITAS' | 'KEAMANAN' | 'KEBERSIHAN' | 'KEDISIPLINAN' | 'KESEHATAN' | 'LAINNYA'`.
  - `uraian` (string, required): Kronologi detail peristiwa.
  - `tindakanAwal` (string, required): Solusi darurat yang telah dilakukan.
  - `status` (string, required): `'DILAPORKAN' | 'DALAM_PENANGANAN' | 'SELESAI' | 'DIPERLUKAN_ESKALASI'`.

---

#### 11. Koleksi: `auditLogs`
* **Fungsi**: Jejak rekam forensik seluruh operasi sistem (Immutable Audit Trail).
* **Fields**:
  - `id` (string, required): ID unik log audit.
  - `userId` (string, required): ID pengguna yang melakukan aksi.
  - `userName` (string, required): Nama pengguna.
  - `role` (string, required): Peran pengguna.
  - `action` (string, required): `'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'UPLOAD' | 'BACKUP' | 'RESTORE' | 'ATTENDANCE' | 'STATUS_CHANGE' | 'SECURITY' | 'EMERGENCY'`.
  - `module` (string, required): Modul terdampak (`USERS`, `SCHEDULES`, `DUTY_BOOK`, `SETTINGS`, dsb.).
  - `details` (string, required): Deskripsi terperinci mengenai aksi yang dilakukan.
  - `timestamp` (string, required ISO 8601): Waktu presisi kejadian aksi.
  - `recordId` / `ipAddress` (string, optional).

---

#### 12. Koleksi Pendukung Operasional Lainnya:
* `studentTardiness`: Rekaman siswa terlambat (`nis`, `nama`, `kelas`, `jamTiba`, `alasan`, `tindakan`).
* `substitutions`: Penugasan guru pengganti (`jadwalAsliId`, `guruAsliId`, `guruPenggantiId`, `alasan`).
* `studentPermits`: Izin keluar siswa (`siswaNama`, `kelas`, `tujuan`, `penjemput`, `statusIzin`).
* `visitors`: Buku tamu digital (`nama`, `instansi`, `keperluan`, `kontak`, `jamMasuk`, `jamKeluar`).
* `announcements`: Pengumuman teks berjalan lobi Kiosk.
* `emergencies` & `emergency_history`: Pemicu sirine darurat dan riwayat peringatan bahaya.
* `backups` & `database_snapshots`: Metadata berkas cadangan dan pemulihan sistem.
