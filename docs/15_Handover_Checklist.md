# DOKUMEN SERAH TERIMA & CHECKLIST FINAL
## PIKET GURU DIGITAL SEKOLAH v1.0.0 (HANDOVER CHECKLIST)

* **Nomor Berita Acara**: BA-ST/PG/2026/09/001
* **Hari / Tanggal**: Rabu, 30 September 2026
* **Institusi**: Sekolah Menengah Kejuruan / Atas Negeri
* **Proyek**: Sistem Informasi Jadwal dan Buku Piket Digital Berbasis Cloud & GPS Geofence

---

### A. REKAPITULASI ENTITAS & ASET YANG DISERAHKAN

| No | Komponen Serah Terima | Format Berkas / Media | Status Verifikasi |
| :-: | :--- | :---: | :---: |
| 1 | **Aplikasi Web Siap Produksi (SPA)** | React 19 + TypeScript + Vite | **LENGKAP & LIVE** |
| 2 | **Basis Data Cloud Aktif** | Google Cloud Firestore (16 Koleksi) | **TERINTEGRASI** |
| 3 | **Aturan Keamanan Cloud** | `firestore.rules` (Security Rules) | **TERDEPLOY** |
| 4 | **PWA & Offline Service Worker** | Manifest W3C & `sw.js` | **AKTIF** |
| 5 | **Buku Panduan Pengguna Lengkap** | PDF / Dokumen Digital | **TERSEDIA** |
| 6 | **SOP Presensi Geofence GPS** | PDF / Dokumen Digital | **TERSEDIA** |
| 7 | **SOP Pengelolaan Buku Piket (5 Tahap)**| PDF / Dokumen Digital | **TERSEDIA** |
| 8 | **SOP Backup & Restore Database** | PDF / Dokumen Digital | **TERSEDIA** |
| 9 | **Panduan Lengkap Administrator** | PDF / Dokumen Digital | **TERSEDIA** |
| 10 | **Dokumen RBAC & Arsitektur Security** | PDF / Dokumen Digital | **TERSEDIA** |
| 11 | **Spesifikasi Database & ERD** | PDF / Dokumen Digital | **TERSEDIA** |
| 12 | **Spesifikasi Integrasi Berkas & Drive**| PDF / Dokumen Digital | **TERSEDIA** |
| 13 | **Spesifikasi Konfigurasi Produksi** | PDF / Dokumen Digital | **TERSEDIA** |
| 14 | **Catatan Perilisan (Changelog v1.0.0)** | PDF / Dokumen Digital | **TERSEDIA** |
| 15 | **Master Handbook Piket Guru** | PDF / Dokumen Digital | **TERSEDIA** |

---

### B. DAFTAR PERIKSA KESIAPAN OPERASIONAL (OPERATIONAL READINESS CHECKLIST)

#### 1. Modul Otentikasi & Pengguna
- [x] Login NIP & 6-digit PIN terenkripsi salted SHA-256 berfungsi normal.
- [x] Proteksi brute-force 5x salah input (lockout 15 menit) terverifikasi.
- [x] Hak peran 4 tingkatan (`ADMIN`, `KEPALA_SEKOLAH`, `GURU`, `TENAGA_KEPENDIDIKAN`) terisolasi sempurna.
- [x] Fungsi Reset PIN oleh Administrator bekerja instan.

#### 2. Modul Jadwal & Kehadiran (Presensi)
- [x] Deteksi jadwal bentrok (*Conflict Detection*) akurat memisahkan tanggal kalender dan template mingguan.
- [x] Koordinat Geofence sekolah (< 100 meter) memvalidasi kehadiran secara presisi.
- [x] Kamera swafoto (*selfie*) mengambil gambar dan mengompresi ukuran secara otomatis (< 100 KB).
- [x] Presensi Masuk dan Presensi Pulang tercatat dengan stempel waktu resmi.

#### 3. Modul Buku Piket & Administrasi Harian
- [x] Siklus alur 5 tahapan (*Draft ➔ Diajukan ➔ Diverifikasi ➔ Disetujui ➔ Dikunci*) berfungsi penuh.
- [x] Proteksi kepemilikan draft (*Draft Ownership*) mencegah pengubahan tanpa hak.
- [x] Fitur darurat *Buka Gembok (Emergency Unlock)* khusus Admin dengan kewajiban input alasan forensik.
- [x] Modul pendukung (Buku Tamu, Siswa Terlambat, Izin Siswa, dan Guru Inval) beroperasi lancar.

#### 4. Fasilitas Pendukung & Media Display
- [x] Pusat Komando dilengkapi audio synthesizer bel sekolah 3 nada (Masuk, Istirahat, Pulang).
- [x] Mode Kiosk TV Layar Penuh berotasi otomatis setiap 8 detik untuk lobi utama sekolah.
- [x] Panel darurat (Kebakaran, Gempa, Medis, Keamanan) memancarkan sinyal siaga real-time.

#### 5. Pelaporan & Disaster Recovery
- [x] Rekapitulasi laporan dinas bulanan dapat dicetak langsung berformat kop surat resmi.
- [x] Ekspor data ke format Microsoft Excel (.xls), CSV ber-BOM UTF-8, dan JSON berjalan mulus.
- [x] Pencadangan 1-klik untuk 16 koleksi database Firestore dan pemulihan (*restore*) teruji sukses.

---

### C. KREDENSIAL BAWAAN PENGGUNA RESMI

| Peran | NIP Pengguna | PIN Akses | Nama Pejabat / Petugas |
| :--- | :--- | :---: | :--- |
| **Administrator** | `198503152010011002` | `123456` | Drs. H. Ahmad Fauzi, M.Pd. |
| **Kepala Sekolah** | `197605122000032001` | `123456` | Dr. Hj. Siti Rohmah, M.Pd. |
| **Guru Piket 1** | `199008212015022003` | `123456` | Siti Nurhaliza, S.Pd. |
| **Guru Piket 2** | `198711042012011005` | `123456` | Budi Santoso, M.Kom. |
| **Tenaga Kependidikan** | `198902142014031002` | `123456` | Mulyadi, S.AP. |

---

### D. LEMBAR PENGESAHAN SERAH TERIMA

Dengan ditandatanganinya berita acara ini, seluruh hak pengelolaan dan operasional aplikasi **Piket Guru Digital Sekolah Versi 1.0.0** resmi diserahkan kepada pihak sekolah untuk digunakan dalam kedinasan harian.

Dibuat dan disahkan pada: **30 September 2026**

<br>

| Pihak Pertama (Pengembang Sistem) | Pihak Kedua (Administrator IT Sekolah) | Mengetahui (Kepala Sekolah) |
| :---: | :---: | :---: |
| <br><br><br>___________________________<br>**Tim Pengembang Sistem**<br>AI Studio Build Engine | <br><br><br>___________________________<br>**Drs. H. Ahmad Fauzi, M.Pd.**<br>NIP. 19850315 201001 1 002 | <br><br><br>___________________________<br>**Dr. Hj. Siti Rohmah, M.Pd.**<br>NIP. 19760512 200003 2 001 |
