# PANDUAN PENGGUNA: TENAGA KEPENDIDIKAN (TENDIK & STAF)
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Panduan ini disusun khusus untuk pegawai **Tenaga Kependidikan (Tata Usaha, Staf Sarpras, Perpustakaan, dan Keamanan/Satpam)** yang bertugas membantu administrasi piket, pelayanan tamu, ketertiban gerbang, dan kedisiplinan siswa di lingkungan sekolah.

---

## 1. Login Sistem
1. Buka aplikasi Piket Guru pada perangkat kerja (Komputer TU, Tablet Lobi, atau HP).
2. Masukkan **NIP Staf**: `198902142014031002` (atau klik tombol cepat *Tendik*).
3. Masukkan 6 digit **PIN Keamanan** (standar: `123456`).
4. Klik **Masuk ke Sistem**.
5. Sistem akan menampilkan Dashboard dengan hak akses operasional staf.

---

## 2. Dashboard Tenaga Kependidikan
Pada dashboard, Tenaga Kependidikan dapat memantau:
* **Jadwal Bertugas Hari Ini**: Memastikan pos yang dialokasikan (misal: *Pos Utama Gerbang, Lobi Resepsionis, dsb.*).
* **Ringkasan Tamu Sekolah**: Jumlah tamu kedinasan atau wali murid yang sedang berkunjung hari ini.
* **Ringkasan Siswa Terlambat**: Jumlah siswa yang masuk lewat gerbang setelah bel berbunyi.

---

## 3. Presensi Masuk & Pulang
1. Buka menu **Presensi Piket**.
2. Pastikan perangkat Anda terhubung internet dan fitur lokasi (GPS) aktif di dalam lingkungan sekolah (radius < 100 meter).
3. Klik tombol hijau **Presensi Masuk**, ambil swafoto di pos jaga/kantor, lalu klik **Gunakan Foto Ini**.
4. Di akhir jam tugas dinas, kembali buka menu ini dan klik tombol biru **Presensi Pulang**.

---

## 4. Pelayanan Buku Tamu Digital (`visitors`)
Tenaga Kependidikan memegang peran sentral dalam pencatatan tamu di gerbang utama / lobi:
1. Buka menu **Buku Tamu**.
2. Klik tombol **+ Catat Tamu Baru**.
3. Isi formulir:
   - Nama Lengkap Tamu.
   - Instansi / Lembaga / Asal (misal: *Dinas Pendidikan, Puskesmas, Orang Tua Siswa*).
   - Bertemu dengan Siapa (misal: *Kepala Sekolah, Wakasek Kurikulum, Wali Kelas X-A*).
   - Keperluan Kunjungan.
   - Nomor Kontak / WhatsApp Tamu.
4. Klik **Simpan Tamu**. Status tamu akan tercatat sebagai **SEDANG_BERKUNJUNG**.
5. Saat tamu selesai dan berpamitan pulang, klik tombol **Check-Out Tamu** pada baris nama tamu tersebut untuk mencatat jam keluar secara akurat.

---

## 5. Administrasi Siswa Terlambat (`studentTardiness`)
Untuk staf yang bertugas di gerbang depan saat jam masuk pagi:
1. Buka menu **Siswa Terlambat**.
2. Klik tombol **+ Catat Siswa Terlambat**.
3. Masukkan Nama Siswa, NIS/NISN, Kelas, Jam Tiba, dan Alasan Keterlambatan.
4. Tentukan Tindakan / Pembinaan Awal (misal: *Pemberian nasihat, piket menyiram tanaman, hafalan surat pendek*).
5. Klik **Izinkan Masuk Kelas (Admit)** untuk menerbitkan status izin masuk KBM.

---

## 6. Surat Izin Siswa Meninggalkan Sekolah (`studentPermits`)
Jika terdapat siswa yang harus pulang lebih awal (karena sakit atau urusan keluarga mendesak):
1. Buka menu **Izin Siswa**.
2. Klik **+ Buat Surat Izin Keluar**.
3. Isi data siswa, kelas, alasan, dan nama pihak yang menjemput (orang tua/wali).
4. Klik **Terbitkan Izin**. Status tercatat **SEDANG_KELUAR**.
5. Jika siswa kembali ke sekolah pada hari yang sama, klik **Konfirmasi Kembali (Return)**.

---

## 7. Buku Piket & Laporan Kejadian Lapangan
* **Buku Piket**: Staf TU/Piket dapat membuat dan memperbarui draft jurnal harian pada menu **Buku Piket**. *(Catatan: Wewenang verifikasi dan pengesahan berada pada Kepala Sekolah/Admin)*.
* **Laporan Kejadian**: Jika terjadi insiden keamanan, kerusakan fasilitas, atau kendala sarpras, staf dapat langsung mencatat laporan kronologis melalui menu **Laporan Kejadian**.

---

## 8. Mengoperasikan Bel Sekolah (Pusat Komando)
Staf piket dapat mengakses menu **Pusat Komando** untuk membunyikan bel otomatis:
* Tekan tombol **Bel Masuk** pada pukul 07.00 WIB.
* Tekan tombol **Bel Istirahat** pada jam istirahat.
* Tekan tombol **Bel Pulang** pada jam kepulangan siswa.

---

## 9. Pembatasan Hak Akses (Berdasarkan RBAC Aktual)
Berdasarkan sistem otorisasi aplikasi, Tenaga Kependidikan **TIDAK** memiliki akses terhadap:
* Pengaturan sistem dan koordinat GPS sekolah (`settings.*`).
* Pembuatan dan penghapusan akun pengguna (`users.*`).
* Pengesahan formal jurnal piket (`dutybook.verify`).
* Buka gembok arsip permanen (`dutybook.unlock`).
* Pembuatan dan pemulihan cadangan database (`backup.*`).
* Menu rekapitulasi laporan eksekutif (`reports.view` / `reports.export`).

---

## 10. Logout Sistem
Klik nama profil Anda di pojok kanan atas, lalu klik tombol merah **Keluar (Logout)** setelah jam dinas berakhir.
