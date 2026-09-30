```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                  Dokumen: 08 — INTEGRASI GOOGLE DRIVE
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 08_Integrasi_Google_Drive
* **Klasifikasi**: TECHNICAL / INTERNAL
* **Penanggung Jawab**: Administrator IT Sekolah & DevOps

---

## 1. TUJUAN
Dokumen ini menguraikan arsitektur pengelolaan berkas media visual (swafoto absensi, dokumentasi insiden) serta panduan penataan berkas cadangan database ke layanan penyimpanan cloud eksternal (Google Drive).

---

## 2. ARSITEKTUR ALUR BERKAS AKTUAL

```
┌──────────────────────────────────────┐
│  APLIKASI PIKET GURU (Browser Klien) │
└──────────────────┬───────────────────┘
                   │ 1. Pengambilan Foto / Unggah Berkas
                   ▼
┌──────────────────────────────────────┐
│  VALIDASI & KOMPRESI SISI KLIEN      │
│  - HTML5 Canvas Off-Screen Engine    │
│  - Resolusi downscale ke 800px       │
│  - Reduksi ukuran berkas ke < 100KB  │
└──────────────────┬───────────────────┘
                   │ 2. Data URI Terkompresi Valid
                   ▼
┌──────────────────────────────────────┐
│  BASIS DATA CLOUD FIRESTORE          │
│  - attendance.photoUrl               │
│  - Koleksi documents & incidents     │
└──────────────────┬───────────────────┘
                   │ 3. Pencadangan Mingguan / Bulanan
                   ▼
┌──────────────────────────────────────┐
│  GOOGLE DRIVE RESMI SEKOLAH          │
│  - Folder Cadangan Database (.json)  │
│  - Folder Rekapitulasi Laporan (.xls)│
└──────────────────────────────────────┘
```

---

## 3. STATUS INTEGRASI GOOGLE DRIVE API LANGSUNG
* **Hasil Audit Source Code**: *Integrasi OAuth langsung ke API Google Drive tidak ditemukan dalam kode sumber aplikasi v1.0.0 — PERLU KONFIRMASI ADMINISTRATOR.*
* **Penyimpanan Media Saat Ini**: Sepenuhnya diakomodasi secara aman dan efisien di dalam dokumen Firestore menggunakan kompresi kanvas tanpa membebani kuota 1MB Firestore.

---

## 4. METODE UPLOAD & KOMPRESI GAMBAR
* **Maksimum Ukuran Asli**: Hingga 15 MB.
* **Proses Kompresi**: Foto dikonversi ke kanvas HTML5, di-*resize* ke dimensi maksimum lebar 800 piksel dengan rasio aspek terjaga, dan dikonversi ke string JPEG berkualias 0.78.
* **Ukuran Akhir**: Rata-rata 40 KB hingga 85 KB.

---

## 5. STRUKTUR FOLDER REKOMENDASI PADA GOOGLE DRIVE SEKOLAH
Administrator IT sekolah disarankan menyiapkan direktori penyimpanan cadangan pada Google Drive resmi sekolah:
```
[Google Drive Sekolah]
 └── ARSIP_PIKET_GURU_v1.0.0/
      ├── 01_CADANGAN_DATABASE/
      │    ├── backup-piket-guru-2026-09-30-16-00.json
      │    └── ...
      ├── 02_REKAP_LAPORAN_DINAS/
      │    ├── Rekap_Presensi_September_2026.xls
      │    └── Rekap_Jurnal_Piket_September_2026.xls
      └── 03_DOKUMENTASI_INSIDEN_KHUSUS/
```

---

## 6. PENAMAAN BERKAS (FILE NAMING CONVENTION)
* **Berkas Backup**: `backup-piket-guru-YYYY-MM-DD-HH-mm.json`
* **Berkas Laporan Excel**: `Laporan_Piket_[BULAN]_[TAHUN].xls`
* **Berkas CSV**: `Rekap_Kehadiran_[BULAN]_[TAHUN].csv`

---

## 7. METADATA BERKAS
Setiap berkas cadangan dan dokumen menyertakan atribut metadata:
* `version`: Versi rilis (`1.0.0`).
* `app`: Nama aplikasi (`Piket Guru`).
* `timestamp`: Stempel waktu ISO 8601.
* `createdBy`: Objek identitas `{ id, fullName, nip, role }`.
* `totalCollections` & `totalRecords`: Jumlah koleksi dan baris data.

---

## 8. HUBUNGAN DENGAN BASIS DATA FIRESTORE
Berkas cadangan yang disimpan di Google Drive merupakan cerminan snapshot 100% dari 16 koleksi dokumen Firestore, siap digunakan sewaktu-waktu untuk pemulihan bencana (*Disaster Recovery*).

---

## 9. PERMISSION & HAK BERBAGI (SHARING PERMISSIONS)
* Folder `ARSIP_PIKET_GURU` pada Google Drive disetel dengan akses terbatas hanya untuk akun email Administrator IT dan Kepala Sekolah.
* Tautan berbagi dinonaktifkan untuk publik guna mencegah kebocoran data pribadi pegawai dan siswa.

---

## 10. ERROR HANDLING (PENANGANAN GALAT)
* **Berkas Bukan Gambar**: Muncul dialog peringatan *"Berkas yang dipilih harus berupa gambar/foto"*.
* **Kamera Gagal Akses**: Tombol fallback *"Pilih dari Galeri"* aktif otomatis.
* **Skema Backup Korup**: Fungsi `validateBackupSchema` menolak berkas restore jika tidak sesuai header resmi.

---

## 11. PENCADANGAN BERKALA (BACKUP CADANGAN)
* Dilakukan oleh Admin setiap Jumat sore dengan mengklik tombol *Unduh Cadangan Lengkap*, kemudian mengunggah file `.json` tersebut ke folder Google Drive di atas.

---

## 12. TROUBLESHOOTING
* **Gagal Mengunggah ke Google Drive**: Pastikan ruang penyimpanan Google Drive sekolah masih mencukupi dan koneksi internet stabil.
* **Format Berkas Rusak**: Pastikan proses unduh dari aplikasi selesai 100% sebelum memindahkan berkas cadangan.
