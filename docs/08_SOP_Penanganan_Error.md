# STANDAR OPERASIONAL PROSEDUR (SOP)
## PANDUAN PENANGANAN ERROR & PEMECAHAN MASALAH (TROUBLESHOOTING)

* **Nomor Dokumen**: SOP/IT/004-ERR-TRB
* **Edisi / Revisi**: 01 / 00
* **Tanggal Efektif**: 30 September 2026
* **Status Aplikasi**: Production v1.0.0

Dokumen ini disusun untuk membantu pengguna dan tim IT sekolah menyelesaikan kendala operasional yang mungkin dihadapi saat menggunakan aplikasi Piket Guru v1.0.0.

---

### 1. KENDALA LOGIN
#### Kasus 1.1: PIN Salah / Sisa Percobaan Berkurang
* **MASALAH**: Muncul pesan *"PIN Salah! Sisa percobaan: X kali."*
* **PENYEBAB YANG MUNGKIN**: Pengguna salah menekan angka PIN atau lupa PIN yang telah diubah.
* **LANGKAH PEMERIKSAAN**: Periksa apakah tombol angka pada keyboard atau keypad layar berfungsi normal.
* **SOLUSI**: Masukkan 6 digit PIN secara perlahan dan hati-hati. Jika lupa PIN, hubungi Administrator untuk mereset PIN menjadi bawaan (`123456`).
* **KAPAN HUBUNGI ADMIN**: Jika sisa percobaan tersisa 1 kali atau lupa PIN sama sekali.

#### Kasus 1.2: Akun Terkunci Sementara (Lockout 15 Menit)
* **MASALAH**: Muncul pesan *"PIN Salah! Akun telah terkunci selama 15 menit karena 5x percobaan gagal."*
* **PENYEBAB YANG MUNGKIN**: Proteksi brute-force sistem aktif setelah 5 kali salah memasukkan PIN.
* **LANGKAH PEMERIKSAAN**: Perhatikan pesan hitung mundur menit yang tertera di layar.
* **SOLUSI**: Tunggu hingga masa penguncian 15 menit berakhir, atau minta Administrator untuk membuka kunci.
* **KAPAN HUBUNGI ADMIN**: Jika butuh akses darurat tanpa menunggu masa tunggu 15 menit.

#### Kasus 1.3: Pengguna Tidak Ditemukan atau Dinonaktifkan
* **MASALAH**: Pesan *"Pengguna dengan NIP tersebut tidak ditemukan"* atau *"Akun Anda dinonaktifkan oleh administrator"*.
* **PENYEBAB YANG MUNGKIN**: NIP belum didaftarkan di master pengguna, salah ketik digit NIP, atau akun dinonaktifkan karena mutasi/cuti.
* **LANGKAH PEMERIKSAAN**: Cocokkan NIP pada kartu identitas pegawai dengan yang diinput.
* **SOLUSI**: Hubungi Administrator untuk verifikasi pendaftaran akun atau mengaktifkan kembali toggle status akun.
* **KAPAN HUBUNGI ADMIN**: Segera setelah pesan muncul.

---

### 2. KENDALA GPS & LOKASI
#### Kasus 2.1: Izin Lokasi Diblokir / Geolocation Denied
* **MASALAH**: Muncul peringatan *"Izin akses lokasi ditolak oleh peramban"*.
* **PENYEBAB YANG MUNGKIN**: Pengguna menekan tombol "Blokir / Block" saat peramban meminta izin akses lokasi.
* **LANGKAH PEMERIKSAAN**: Periksa ikon gembok / perizinan di bilah alamat (URL bar) peramban.
* **SOLUSI**:
  - Pada Chrome Android: Klik ikon menu titik tiga ➔ Setelan ➔ Setelan Situs ➔ Lokasi ➔ Cari domain aplikasi ➔ Pilih "Izinkan".
  - Pada iOS Safari: Buka Pengaturan iPhone ➔ Privasi & Keamanan ➔ Layanan Lokasi ➔ Safari ➔ Pilih "Saat Menggunakan App".
  - Muat ulang (*refresh*) halaman aplikasi.
* **KAPAN HUBUNGI ADMIN**: Jika izin sudah diizinkan tetapi browser tetap menolak.

#### Kasus 2.2: Tombol Presensi Terkunci "Di Luar Lokasi"
* **MASALAH**: Jarak terdeteksi melebihi 100 meter (misal: 180 meter), tombol presensi masuk berwarna abu-abu/tidak aktif.
* **PENYEBAB YANG MUNGKIN**: Pengguna masih berada di jalan menuju sekolah, atau sensor GPS HP mengalami deviasi akibat pantulan gedung.
* **LANGKAH PEMERIKSAAN**: Dekati titik gerbang utama sekolah atau ruang terbuka, nyalakan dan matikan kembali mode pesawat (*airplane mode*) untuk me-reset antena GPS.
* **SOLUSI**: Tunggu 10–15 detik hingga angka jarak di layar menurun di bawah 100 meter.
* **KAPAN HUBUNGI ADMIN**: Jika posisi fisik sudah berada tepat di tengah sekolah namun terdeteksi di luar radius (Admin dapat menyesuaikan koordinat titik sekolah pada menu Pengaturan).

---

### 3. KENDALA PRESENSI
#### Kasus 3.1: Peringatan Presensi Ganda
* **MASALAH**: Muncul pesan *"Anda sudah melakukan presensi masuk untuk shift ini"*.
* **PENYEBAB YANG MUNGKIN**: Pengguna menekan tombol presensi lebih dari satu kali atau sudah berhasil presensi beberapa saat sebelumnya.
* **LANGKAH PEMERIKSAAN**: Buka riwayat pada tabel presensi untuk memeriksa apakah jam kedatangan sudah tercatat.
* **SOLUSI**: Tidak perlu presensi ulang, data kehadiran Anda sudah aman tercatat.
* **KAPAN HUBUNGI ADMIN**: Tidak perlu menghubungi Admin.

---

### 4. KENDALA KONEKSI INTERNET & OFFLINE
* **MASALAH**: Banner *"Koneksi Terputus / Mode Offline"* muncul di bagian atas layar.
* **PENYEBAB YANG MUNGKIN**: Kuota data seluler habis atau Wi-Fi sekolah sedang mengalami gangguan ISP.
* **LANGKAH PEMERIKSAAN**: Uji membuka situs web lain di HP.
* **SOLUSI**: Sambungkan HP ke jaringan Wi-Fi sekolah alternatif atau hotspot rekan. Sistem PWA akan tetap mempertahankan halaman aktif sampai sinyal kembali stabil.
* **KAPAN HUBUNGI ADMIN**: Jika koneksi Wi-Fi sekolah terputus secara massal.

---

### 5. KENDALA FIREBASE CLOUD
* **MASALAH**: Pesan *"Error fetching collection [nama_koleksi]: Missing or insufficient permissions"*.
* **PENYEBAB YANG MUNGKIN**: Aturan keamanan Firebase (`firestore.rules`) menolak pembacaan data.
* **LANGKAH PEMERIKSAAN**: Periksa apakah aturan Firebase telah dideploy dengan benar.
* **SOLUSI**: Administrator melakukan deploy ulang `firestore.rules` melalui konsol terminal atau Firebase CLI (`deploy_firebase`).
* **KAPAN HUBUNGI ADMIN**: Segera laporkan kepada Administrator IT.

---

### 6. KENDALA UPLOAD FOTO & KAMERA
#### Kasus 6.1: Kamera Tidak Mau Membuka
* **MASALAH**: Jendela video kamera hitam atau muncul pesan *"Kamera tidak dapat diakses"*.
* **PENYEBAB YANG MUNGKIN**: Kamera sedang digunakan oleh aplikasi lain (seperti WhatsApp Call) atau izin kamera diblokir.
* **LANGKAH PEMERIKSAAN**: Tutup aplikasi lain yang sedang menggunakan kamera.
* **SOLUSI**: Klik tombol alternatif **"Pilih / Ambil Foto dari Perangkat"** pada kotak peringatan untuk memilih gambar dari galeri HP.
* **KAPAN HUBUNGI ADMIN**: Jika seluruh kamera perangkat tidak merespons.

#### Kasus 6.2: Foto Gagal Disimpan (Ukuran Terlalu Besar)
* **MASALAH**: Galat penyimpanan media pada database.
* **PENYEBAB YANG MUNGKIN**: Berkas melampaui batas toleransi dokumen Firestore.
* **SOLUSI**: Sistem v1.0.0 telah dilengkapi kompresi otomatis ke resolusi 800px (< 100KB). Pengguna cukup mengulang pengambilan foto melalui tombol kamera bawaan aplikasi.
* **KAPAN HUBUNGI ADMIN**: Jika pesan kegagalan penyimpanan berulang lebih dari 3 kali.

---

### 7. KENDALA GOOGLE DRIVE
* **MASALAH**: Tautan penyimpanan cloud Google Drive tidak dapat dibuka.
* **PENYEBAB YANG MUNGKIN**: Tautan folder belum disetel menjadi "Siapa saja yang memiliki tautan dapat melihat" (*Anyone with the link can view*).
* **LANGKAH PEMERIKSAAN**: Buka tautan di jendela penyamaran (*Incognito window*).
* **SOLUSI**: Administrator membuka Google Drive institusi, sesuaikan izin berbagi (*sharing permission*) folder menjadi publik/terbuka untuk domain sekolah.
* **KAPAN HUBUNGI ADMIN**: Hubungi Admin untuk pembaruan tautan di menu Pengaturan.

---

### 8. KENDALA BUKU PIKET
#### Kasus 8.1: Tombol "Ajukan Jurnal" Berwarna Abu-Abu / Tidak Aktif
* **MASALAH**: Guru tidak dapat mengajukan jurnal yang telah diisi.
* **PENYEBAB YANG MUNGKIN**: Parameter kondisi wajib belum diisi lengkap, atau pengguna yang login bukan guru pemilik jadwal piket tersebut (*Draft Ownership Protection*).
* **LANGKAH PEMERIKSAAN**: Pastikan kelima parameter kondisi sekolah sudah terisi minimal 5 karakter, dan periksa apakah nama petugas pada jadwal sesuai dengan akun yang sedang login.
* **SOLUSI**: Masuk menggunakan akun yang terdaftar pada jadwal hari itu atau minta Admin melakukan penyesuaian penugasan.
* **KAPAN HUBUNGI ADMIN**: Jika nama guru pada jadwal salah diinput.

#### Kasus 8.2: Ingin Memperbaiki Jurnal yang Sudah "DIKUNCI"
* **MASALAH**: Formulir jurnal terkunci rapat dan tidak bisa diedit.
* **PENYEBAB YANG MUNGKIN**: Dokumen telah berstatus arsip permanen setelah disetujui Kepala Sekolah.
* **SOLUSI**: Hubungi Administrator untuk mengajukan prosedur **Emergency Unlock** dengan menyertakan alasan tertulis.
* **KAPAN HUBUNGI ADMIN**: Segera.

---

### 9. KENDALA LAPORAN & CETAK
#### Kasus 9.1: Tabel Laporan Kosong
* **MASALAH**: Pratinjau laporan tidak menampilkan data apa pun.
* **PENYEBAB YANG MUNGKIN**: Filter rentang tanggal berada di luar tanggal pelaksanaan kegiatan piket.
* **LANGKAH PEMERIKSAAN**: Periksa kotak filter "Tanggal Mulai" dan "Tanggal Selesai".
* **SOLUSI**: Sesuaikan rentang tanggal dengan periode bulan yang memiliki aktivitas piket (misal: tanggal 1 hingga akhir bulan).
* **KAPAN HUBUNGI ADMIN**: Jika tanggal sudah benar tetapi data tetap kosong.

#### Kasus 9.2: Kop Surat atau Garis Pembatas Terpotong Saat Dicetak
* **MASALAH**: Hasil cetak printer tidak proporsional.
* **LANGKAH PEMERIKSAAN**: Periksa jendela pengaturan cetak peramban.
* **SOLUSI**: Pada menu cetak peramban, pilih ukuran kertas **A4**, orientasi **Potret (Portrait)**, skala **Default / Fit to Printable Area**, dan centang opsi **"Grafik Latar Belakang (Background Graphics)"**.
* **KAPAN HUBUNGI ADMIN**: Tidak perlu menghubungi Admin.

---

### 10. KENDALA IMPOR & EKSPOR
* **MASALAH**: Berkas CSV saat dibuka di Excel menampilkan huruf aneh atau tanda tanya.
* **PENYEBAB YANG MUNGKIN**: Excel membuka berkas dengan enkripsi ANSI alih-alih UTF-8.
* **SOLUSI**: Gunakan tombol **Unduh Format Excel (.xls)** yang telah disediakan pada aplikasi untuk tampilan tabel rapi, atau buka Excel ➔ Data ➔ From Text/CSV ➔ pilih encoding **UTF-8**.
* **KAPAN HUBUNGI ADMIN**: Tidak perlu menghubungi Admin.

---

### 11. KENDALA PENCADANGAN (BACKUP)
* **MASALAH**: Tombol "Unduh Cadangan" memuat lama (*loading spinner*) dan tidak ada berkas terunduh.
* **PENYEBAB YANG MUNGKIN**: Koneksi internet mengalami time-out saat mengunduh 16 koleksi data.
* **LANGKAH PEMERIKSAAN**: Periksa stabilitas kecepatan unduh internet.
* **SOLUSI**: Pastikan koneksi minimal 5 Mbps, muat ulang halaman, lalu ulangi proses klik unduh cadangan.
* **KAPAN HUBUNGI ADMIN**: Jika dicoba berkali-kali tetap gagal.

---

### 12. KENDALA PEMULIHAN (RESTORE)
* **MASALAH**: Muncul pesan *"Berkas cadangan tidak valid: skema format tidak cocok"*.
* **PENYEBAB YANG MUNGKIN**: Pengguna mengunggah berkas JSON yang salah, berkas terpotong (*corrupted*), atau berkas hasil ekspor aplikasi lain.
* **LANGKAH PEMERIKSAAN**: Pastikan nama berkas berformat `backup-piket-guru-*.json`.
* **SOLUSI**: Gunakan berkas cadangan resmi yang diunduh langsung dari menu Backup aplikasi Piket Guru v1.0.0.
* **KAPAN HUBUNGI ADMIN**: Wajib didampingi Administrator IT.

---

### 13. KENDALA TEMA GELAP / TERANG (DARK MODE)
* **MASALAH**: Layar berkedip putih sekejap (*flash of unstyled content / FOUC*) saat halaman dibuka pertama kali.
* **PENYEBAB YANG MUNGKIN**: Cache peramban lama menyimpan preferensi warna lawas.
* **SOLUSI**: Bersihkan cache peramban (*Clear Browsing Data*) atau pilih tema secara manual melalui ikon palet warna di bilah navigasi (pilih *Terang*, *Gelap*, atau *Sistem*).
* **KAPAN HUBUNGI ADMIN**: Tidak perlu menghubungi Admin.

---

### 14. KENDALA SESI (SESSION TIMEOUT)
* **MASALAH**: Pengguna tiba-tiba keluar ke halaman login secara otomatis saat sedang membuka menu.
* **PENYEBAB YANG MUNGKIN**: Masa berlaku sesi 24 jam telah berakhir demi menjaga keamanan data sekolah dari akses pihak ketiga.
* **SOLUSI**: Masukkan kembali NIP dan PIN Anda untuk melanjutkan pekerjaan.
* **KAPAN HUBUNGI ADMIN**: Jika sesi keluar dalam waktu kurang dari 5 menit setelah login (kemungkinan peramban dalam mode private/incognito ketat yang menolak localStorage).
