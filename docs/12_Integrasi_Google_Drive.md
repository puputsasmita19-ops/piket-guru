# DOKUMENTASI TEKNIS: INTEGRASI GOOGLE DRIVE & MANAJEMEN BERKAS
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Dokumen ini menjelaskan status teknis integrasi penyimpanan eksternal Google Drive, penanganan berkas dokumentasi, serta keterhubungannya dengan basis data cloud aplikasi Piket Guru.

---

### 1. STATUS INTEGRASI GOOGLE DRIVE SAAT INI
Berdasarkan audit menyeluruh terhadap source code aplikasi v1.0.0:
* **Status Integrasi API Langsung**: **Tidak ditemukan dalam source code — perlu dikonfirmasi oleh administrator.**
* **Implementasi Berkas Aktual**:
  - Pada rilis saat ini, penyimpanan media visual (swafoto absensi dan foto laporan insiden) ditangani langsung secara internal menggunakan format **Base64 Data URI terkompresi** yang tersimpan di dalam dokumen Firestore (`attendance.photoUrl` dan koleksi `documents`).
  - Integrasi Google Drive direncanakan/dapat digunakan sebagai media penyimpanan cadangan berkas ekspor (`backup-piket-guru-*.json`) dan arsip folder dinas yang dikonfigurasi melalui tautan eksternal oleh Administrator.

---

### 2. ARSITEKTUR ALUR PENYIMPANAN BERKAS & DOKUMENTASI

```
┌──────────────┐
│  PENGGUNA    │
│  (Guru/Staf) │
└──────┬───────┘
       │ 1. Jepret Kamera / Unggah Berkas Gambar
       ▼
┌────────────────────────────────────────────────────────┐
│  KOMPRESI & VALIDASI SISI KLIEN (HTML5 Canvas Engine)  │
│  - Downscaling resolusi proporsional (Maksimal 800px)   │
│  - Kompresi kualitas JPEG 0.78                         │
│  - Reduksi ukuran berkas dari ~8MB menjadi < 100KB     │
└──────┬─────────────────────────────────────────────────┘
       │ 2. Payload Data Terkompresi Valid
       ▼
┌────────────────────────────────────────────────────────┐
│  BASIS DATA CLOUD FIRESTORE                            │
│  - Koleksi: attendance (Field: photoUrl)               │
│  - Koleksi: documents (Metadata & Data URI)            │
│  - Koleksi: incidents (Lampiran bukti kejadian)        │
└──────┬─────────────────────────────────────────────────┘
       │ 3. Pencadangan Berkala (Manual/Otomatis)
       ▼
┌────────────────────────────────────────────────────────┐
│  GOOGLE DRIVE INSTITUSI (Penyimpanan Cadangan)        │
│  - Folder Arsip Backup Database Bulanan                │
│  - Berkas Rekap Laporan Excel (.xls) & CSV             │
└────────────────────────────────────────────────────────┘
```

---

### 3. SPESIFIKASI BERKAS & METADATA DOKUMEN

#### A. Format & Ukuran Berkas yang Didukung
* **Tipe Media**: Gambar / Foto (`image/jpeg`, `image/png`, `image/webp`).
* **Batas Maksimal Sebelum Kompresi**: 15 MB.
* **Ukuran Pasca-Kompresi**: 40 KB – 90 KB (Sangat aman untuk batasan payload 1 MB Firestore).
* **Format Penamaan Berkas Cadangan**:
  `backup-piket-guru-[YYYY]-[MM]-[DD]-[HH]-[mm].json`

#### B. Metadata Dokumen yang Dicatat pada Sistem
Setiap lampiran dan dokumen yang tersimpan menyertakan atribut metadata:
1. `id`: Pengenal acak unik dokumen.
2. `tanggal`: Tanggal pencatatan berkas.
3. `pelaporId` / `userId`: NIP atau ID pengguna yang mengunggah berkas.
4. `pelaporName` / `userName`: Nama lengkap pengunggah berkas.
5. `kategori`: Jenis peruntukan berkas (*PRESENSI, INSIDEN, BUKU_TAMU, CADANGAN*).
6. `timestamp`: Stempel waktu ISO 8601 presisi.

---

### 4. STRUKTUR FOLDER REKOMENDASI UNTUK GOOGLE DRIVE SEKOLAH
Bagi Administrator yang mengelola Google Drive instansi sekolah untuk menampung berkas ekspor dan cadangan sistem, disarankan membuat struktur direktori berikut:

```
[Google Drive Sekolah]
 └── PIKET_GURU_ARSIP/
      ├── 01_CADANGAN_DATABASE/
      │    ├── Mingguan/
      │    └── Bulanan/
      ├── 02_REKAP_LAPORAN_DINAS/
      │    ├── Semester_Ganjil/
      │    └── Semester_Genap/
      └── 03_DOKUMENTASI_INSIDEN_KHUSUS/
```

---

### 5. PENANGANAN GALAT (ERROR HANDLING)
* **Galat Format Berkas**: Jika pengguna memilih berkas non-gambar (misal: `.exe`, `.pdf` pada input kamera), sistem menolak dan memunculkan notifikasi: *"Berkas yang dipilih harus berupa gambar/foto"*.
* **Galat Akses Kamera**: Jika kamera perangkat diblokir, sistem secara elegan mengalihkan antarmuka ke mode tombol fallback: *"Pilih / Ambil Foto dari Perangkat"*.
* **Galat Kompresi Kanvas**: Jika gambar gagal diproses kanvas, sistem memiliki fallback pengaman membaca data mentah dengan sanitasi ukuran.
