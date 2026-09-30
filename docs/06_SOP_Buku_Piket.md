# STANDAR OPERASIONAL PROSEDUR (SOP)
## PENGELOLAAN JURNAL BUKU PIKET DIGITAL

* **Nomor Dokumen**: SOP/PIKET/002-JURNAL
* **Edisi / Revisi**: 01 / 00
* **Tanggal Efektif**: 30 September 2026
* **Status Aplikasi**: Production v1.0.0

---

### A. TUJUAN
1. Menstandarkan tata kelola pendokumentasian kondisi sekolah harian secara digital, teratur, dan transparan.
2. Memastikan akuntabilitas pelaporan proses belajar-mengajar, kedisiplinan siswa, keamanan lingkungan, dan pemeliharaan fasilitas sekolah.
3. Memberikan kepastian alur kerja formal bertingkat mulai dari penyusunan draft oleh guru piket hingga pengesahan dan penguncian arsip permanen oleh Kepala Sekolah.

---

### B. RUANG LINGKUP
Prosedur ini mencakup seluruh rangkaian pencatatan piket dari awal kedatangan shift tugas, pelaksanaan patroli dan monitoring, pencatatan insiden, pengisian jurnal digital, hingga verifikasi dan penutupan arsip buku piket.

---

### C. PENGGUNA
1. **Guru Piket / Tenaga Kependidikan Bertugas**: Penyusun dan pengaju jurnal.
2. **Koordinator Piket**: Pemeriksa awal kelengkapan data jurnal.
3. **Kepala Sekolah**: Pejabat penelaah akhir dan pemberi persetujuan resmi.
4. **Administrator**: Pengawas integritas data dan pengelola fungsi darurat buka gembok (*unlock*).

---

### D. ALUR KERJA OPERASIONAL (WORKFLOW)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. JADWAL RESMI                                             │
│    Penetapan petugas dan pos piket di awal semester/minggu   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PELAKSANAAN PIKET                                        │
│    Patroli gerbang, pemantauan KBM, pelayanan tamu & siswa  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PENCATATAN KEJADIAN & DOKUMENTASI                        │
│    Input insiden lapangan & pelampiran foto bukti           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. PENGISIAN JURNAL (STATUS: DRAFT)                         │
│    Guru piket mengisi 5 parameter kondisi sekolah           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. PENGAJUAN FORMAL (STATUS: DIAJUKAN)                      │
│    Guru pemilik draft mengunci draft dan mengajukan dokumen │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. VERIFIKASI (STATUS: DIVERIFIKASI)                        │
│    Koordinator piket / Pimpinan meninjau kelengkapan        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. PERSETUJUAN & PENGUNCIAN (STATUS: DISETUJUI -> DIKUNCI)  │
│    Kepala Sekolah menyetujui dokumen menjadi Arsip Permanen │
└─────────────────────────────────────────────────────────────┘
```

---

### E. RINCIAN STATUS & TAHAP PELAKSANAAN

#### Tahap 1: Pengisian Jurnal (Status: `DRAFT`)
* **Kapan Diisi**: Dimulai saat jam piket berlangsung dan diselesaikan selambat-lambatnya 30 menit sebelum shift berakhir.
* **Apa yang Wajib Diisi**:
  1. `kondisiKeamanan`: Situasi gerbang utama, pengawasan kendaraan, tamu mencurigakan, dan patroli pagar batas sekolah.
  2. `kondisiKebersihan`: Kebersihan selasar, lapangan upacara, toilet siswa/guru, dan tempat pembuangan sampah.
  3. `kondisiKelas`: Ketertiban ruang kelas saat KBM berlangsung, kelas tanpa guru, dan penugasan guru inval.
  4. `kondisiFasilitas`: Laporan kerusakan fasilitas (lampu, proyektor, kran air, kunci pintu, dsb.).
  5. `kondisiSiswa`: Rekapitulasi ketertiban siswa, seragam, siswa sakit di UKS, dan izin meninggalkan kelas.
  6. `catatanPiket`: Rangkuman kesimpulan umum atau rekomendasi untuk piket hari berikutnya.
* **Hak Pengubahan**: Hanya dapat diedit oleh Guru Piket pembuat dokumen (`petugasId`). Guru lain tidak diizinkan mengubah draft milik rekannya (*Draft Ownership Protection*).

#### Tahap 2: Pengajuan Jurnal (Status: `DIAJUKAN`)
* **Kapan Dilakukan**: Setelah seluruh parameter kondisi terisi lengkap dan presensi pulang telah disiapkan.
* **Prosedur**: Guru piket menekan tombol **Ajukan Jurnal**. Sistem mengunci formulir dari pengeditan biasa dan mengubah status menjadi `DIAJUKAN`.

#### Tahap 3: Verifikasi Lapangan (Status: `DIVERIFIKASI`)
* **Siapa yang Melakukan**: Koordinator Piket atau Wakil Kepala Sekolah Bidang Kesiswaan/Kurikulum.
* **Tindakan**: Memeriksa kesesuaian catatan jurnal dengan rekaman buku tamu, laporan siswa terlambat, dan daftar insiden yang terdata pada hari tersebut.

#### Tahap 4: Persetujuan Kepala Sekolah (Status: `DISETUJUI`)
* **Siapa yang Melakukan**: Kepala Sekolah secara eksklusif melalui akun dinasnya.
* **Tindakan**: Kepala Sekolah meninjau jurnal, memberikan catatan arahan jika diperlukan, lalu menekan tombol **Setujui Jurnal**.
* Dokumen secara otomatis memperoleh stempel digital pengesahan (*Approved by Headmaster*).

#### Tahap 5: Penguncian Arsip Permanen (Status: `DIKUNCI`)
* Setelah disetujui, sistem secara otomatis mengubah status dokumen menjadi `DIKUNCI`.
* Dokumen berstatus `DIKUNCI` berubah menjadi dokumen arsip negara/sekolah yang bersifat **Murni Hanya-Baca (Read-Only)**.
* Dokumen ini tidak dapat diubah atau dihapus oleh Guru maupun Kepala Sekolah demi menjamin kepatuhan audit kearsipan.

---

### F. KOREKSI DATA PADA JURNAL TERKUNCI (EMERGENCY UNLOCK)
Apabila di kemudian hari ditemukan kekeliruan fatal pada jurnal yang sudah berstatus `DIKUNCI`:
1. Koreksi tidak dapat dilakukan secara sepihak oleh guru.
2. Guru mengajukan permohonan tertulis kepada **Administrator Sistem**.
3. Administrator membuka modal khusus **Buka Gembok (Unlock Journal)** dan wajib memasukkan alasan tertulis (misal: *Perbaikan salah pencatatan nama siswa pada insiden #12 berdasarkan disposisi Kepsek*).
4. Status jurnal diturunkan kembali menjadi `DRAFT` agar guru yang bersangkutan dapat melakukan koreksi.
5. Peristiwa pembukaan gembok beserta identitas Administrator dan alasannya dicatat permanen dalam riwayat **Audit Log Forensik** yang tidak dapat dimanipulasi.

---

### G. PENDOKUMENTASIAN FOTO & BUKTI PENDUKUNG
1. Setiap laporan kejadian darurat, kerusakan fasilitas, atau tamu khusus wajib dilampiri foto dokumentasi.
2. Foto diambil langsung melalui kamera gawai atau diunggah melalui formulir lampiran.
3. Seluruh berkas gambar otomatis dikompresi melalui off-screen canvas (< 100 KB) agar tersimpan secara efisien pada basis data cloud sekolah.
