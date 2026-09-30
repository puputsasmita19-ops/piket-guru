```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                       Dokumen: 03 — SOP BUKU PIKET
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 03_SOP_Buku_Piket
* **Klasifikasi**: INTERNAL
* **Penanggung Jawab**: Wakil Kepala Sekolah / Koordinator Piket & Kepala Sekolah

---

# STANDAR OPERASIONAL PROSEDUR (SOP)
## PENGELOLAAN & VERIFIKASI JURNAL BUKU PIKET DIGITAL

---

### A. TUJUAN
1. Menstandarkan tata cara penyusunan, pengawasan, pengesahan, dan pengarsipan permanen jurnal harian piket sekolah.
2. Memastikan akuntabilitas pelaporan dinamika KBM, ketertiban umum, penanganan siswa sakit/terlambat, dan pemeliharaan fasilitas sekolah.
3. Menjamin integritas data dinas sekolah bebas manipulasi melalui alur kerja berjenjang 5 tahapan.

---

### B. RUANG LINGKUP
SOP ini mencakup seluruh siklus operasional piket harian sekolah mulai dari persiapan tugas di pagi hari, pemantauan lapangan, pengisian evaluasi kondisi, pencatatan insiden, hingga pengesahan dan penguncian arsip permanen oleh pimpinan sekolah.

---

### C. PETUGAS
1. **Guru Piket / Tenaga Kependidikan**: Penyusun draft dan pengaju jurnal.
2. **Koordinator Piket**: Pemeriksa kesesuaian data lapangan (Verifikator Lapangan).
3. **Kepala Sekolah**: Pejabat pengesah utama (*Final Approver*).
4. **Administrator**: Pengawas integritas data dan eksekutor pembukaan gembok darurat (*Emergency Unlock*).

---

### D. PERSIAPAN
1. Petugas piket memeriksa jadwal tugas pada menu **Jadwal Piket** H-1 atau pada pagi hari sebelum KBM dimulai.
2. Petugas tiba di sekolah selambat-lambatnya 15 menit sebelum bel masuk berbunyi (06.30 WIB).
3. Melakukan presensi masuk (check-in) menggunakan geofence GPS dan swafoto.

---

### E. PELAKSANAAN PIKET
Selama jam dinas piket berlangsung, petugas menjalankan tugas:
1. Menyambut siswa dan guru di gerbang utama sekolah.
2. Mengawasi ketertiban siswa dan mencatat siswa yang datang terlambat pada menu **Siswa Terlambat**.
3. Melayani tamu kedinasan dan orang tua murid melalui menu **Buku Tamu Digital**.
4. Melakukan patroli berkala memantau kebersihan, keamanan, dan ketertiban kelas yang kosong.
5. Menugaskan guru pengganti melalui menu **Guru Pengganti (Inval)** jika ada guru yang izin/sakit.
6. Membunyikan bel sekolah pada jam masuk, istirahat, dan pulang melalui menu **Pusat Komando**.

---

### F. PENGISIAN BUKU PIKET (STATUS: DRAFT)
Menjelang akhir shift piket, petugas membuka menu **Buku Piket** dan mengisi formulir evaluasi:
1. **Kondisi Keamanan**: Catatan pintu gerbang, pengawasan orang asing, dan keamanan kendaraan.
2. **Kondisi Kebersihan**: Kebersihan kelas, selasar, toilet guru/siswa, dan kantin.
3. **Kondisi Kelas & KBM**: Ketertiban KBM, penanganan jam kosong, dan keterlibatan guru inval.
4. **Kondisi Fasilitas**: Laporan kerusakan sarpras (lampu, kran, AC, proyektor, kunci pintu).
5. **Kondisi Siswa**: Catatan ketertiban seragam, siswa sakit di ruang UKS, dan perizinan keluar.
6. **Catatan Piket**: Kesimpulan umum hari ini dan rekomendasi operasional esok hari.
*Catatan: Petugas dapat mengklik tombol "Simpan Draft" kapan saja selama penyusunan.*

---

### G. PENCATATAN KEJADIAN & INSIDEN
Jika terjadi insiden khusus di lapangan, petugas wajib menginput laporan pada menu **Laporan Kejadian**:
* Menentukan Kategori Kejadian, Lokasi, Waktu, Uraian Kronologi, dan Tindakan Awal yang diambil.

---

### H. DOKUMENTASI
* Petugas melampirkan foto dokumentasi kegiatan atau bukti insiden melalui form unggahan foto terkompresi otomatis.

---

### I. PENGAJUAN FORMAL (STATUS: DIAJUKAN)
1. Setelah seluruh parameter terisi lengkap dan presensi pulang disiapkan, petugas menekan tombol **Ajukan Jurnal**.
2. Dokumen berubah status menjadi `DIAJUKAN`.
3. Formulir otomatis terkunci dari pengeditan biasa oleh guru pembuat.

---

### J. VERIFIKASI (STATUS: DIVERIFIKASI)
1. Koordinator Piket meninjau dokumen yang diajukan.
2. Memeriksa kecocokan data jurnal dengan rekap buku tamu, siswa terlambat, dan daftar insiden.
3. Memberikan paraf atau catatan verifikasi lapangan.

---

### K. PERSETUJUAN KEPALA SEKOLAH (STATUS: DISETUJUI)
1. Kepala Sekolah membuka menu **Buku Piket** melalui akun resminya.
2. Menelaah ringkasan evaluasi dan catatan penanganan insiden.
3. Mengklik tombol hijau **Setujui Jurnal (Kepala Sekolah)**.
4. Dokumen resmi memperoleh stempel digital pengesahan (*Approved by Headmaster*).

---

### L. PENGUNCIAN ARSIP PERMANEN (STATUS: DIKUNCI)
* Secara otomatis setelah disetujui, sistem mengubah status dokumen menjadi `DIKUNCI`.
* Dokumen berstatus `DIKUNCI` bertransformasi menjadi **Arsip Permanen Negara/Sekolah** yang bersifat mutlak hanya-baca (*read-only*) dan kebal penghapusan.

---

### M. KOREKSI DOKUMEN TERKUNCI (EMERGENCY UNLOCK)
Apabila terjadi kesalahan pencatatan fatal pada jurnal yang telah berstatus `DIKUNCI`:
1. Koreksi dilarang dilakukan sepihak.
2. Petugas mengajukan permohonan tertulis kepada **Administrator**.
3. Administrator membuka modal **Buka Gembok (Unlock Journal)** dan wajib mengisi alasan pembukaan secara jelas.
4. Status jurnal diturunkan kembali ke `DRAFT` untuk diperbaiki oleh guru yang bersangkutan.
5. Peristiwa pembukaan gembok tercatat permanen pada *Audit Log Forensik*.

---

### N. PELAPORAN
Setiap akhir bulan, seluruh buku piket yang telah berstatus `DIKUNCI` direkapitulasi secara otomatis ke dalam dokumen cetak lembar dinas resmi untuk diserahkan ke Dinas Pendidikan dan Komite Sekolah.
