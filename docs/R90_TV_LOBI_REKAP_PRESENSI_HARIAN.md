# R90 — Pengaturan TV Lobi & Default Rekap Presensi GPS Harian

## Ringkasan
Patch incremental dibuat dari source Piket Guru yang sudah menerapkan R89-E. Tidak mengubah `firestore.rules`, struktur Firestore, endpoint, mekanisme presensi maupun jejak audit.

### A. Pengaturan TV Lobi
- Akar masalah: layar TV (`PublicKioskDisplay`) mengunci empat slide dan rotasi 8 detik; tidak mengonsumsi sebagian besar opsi `lobbyTv` yang sudah ditulis dari Pengaturan Sekolah.
- Membaca konfigurasi `settings.school_config.lobbyTv` yang sama untuk monitor aktif dan untuk pratinjau draf Admin.
- Mengikuti status aktif/nonaktif, urutan dan jumlah panel (termasuk Pengumuman dan Identitas Sekolah), interval rotasi, durasi dan tipe transisi.
- Mengikuti ticker aktif/nonaktif, pesan, kecepatan, ukuran font, mode statis/berjalan; pesan kosong tersimpan sebagai kosong (tidak kembali ke template).
- Mengikuti jam dan tanggal dengan zona WIB/WITA/WIT, format 12/24 jam, detik, tema aksen, mode terang/gelap (aksen/tampilan utama), kepadatan padding, header identitas, indikator jaringan, dan opsi suara untuk uji suara *atas tindakan pengguna*.
- Memakai jadwal piket efektif hari ini (memperhatikan guru pengganti/pembatalan) dan hanya memperlihatkan pengumuman publik aktif (`SEMUA`).
- Melindungi dari Admin lain yang menyimpan pengaturan TV di tengah proses (optimistic conflict check). Pengaturan disimpan dengan narrow update tanpa menimpa GPS, profil, atau pengingat.
- Pratinjau menunjukkan label 'Perubahan belum disimpan' bila draf berbeda dari server.

**Catatan:** Indikator 'Jaringan terhubung' mencerminkan status koneksi browser (`navigator.onLine`), bukan konfirmasi final bahwa semua data telah tersinkron. Tombol suara adalah uji chime setelah klik, bukan pengganti mesin otomasi bel.

### B. Rekap Presensi GPS
- Periode awal pada tab **Rekap Kehadiran** kini **Hari ini (WIB)**.
- Listener Firestore rekap menggunakan filter tanggal hari ini (`where('tanggal', '==', todayWib())`) saat pengguna membuka tab; tidak langsung memuat data bulan penuh.
- Mingguan, bulanan, semester, tahunan, dan rentang custom masih tersedia bila dipilih secara sadar.
- Tab Formulir Presensi tetap memuat data hari ini saja untuk menghindari perubahan perilaku presensi.
- Label tab tidak lagi menampilkan jumlah dari tab berbeda/hasil query lama yang dapat membingungkan.
- Default bulan bagi halaman riwayat lain tetap dipertahankan.

## Uji wajib di Vercel Preview (dengan data uji, bukan langsung produksi)
1. Login ADMIN → Pengaturan Sekolah → Pengaturan TV Lobi. Ubah interval ke 15 detik, pilih panel Identitas + Guru, urutkan, lalu Pratinjau: harus hanya dua panel bergantian.
2. Ubah ticker menjadi satu pesan, pilih statis dan uji; hapus seluruh pesan, simpan dan muat ulang: pesan jangan kembali ke default.
3. Uji nonaktif TV → tampil pesan nonaktif; aktifkan kembali; uji hari yang ada guru pengganti.
4. Uji Format WITA dan 12 jam, tampilkan/sembunyikan tanggal/detik; uji tema, mode terang, kepadatan.
5. Simpan pengaturan; buka TV aktif pada browser lain yang login dan mempunyai izin; perubahan harus terlihat tanpa refresh manual. Jangan gunakan tampilan pratinjau sebagai bukti perubahan tersimpan.
6. Buka dua tab Admin dengan konfigurasi lama; simpan perubahan dari tab A, simpan dari tab B: B harus menampilkan konflik, bukan menimpa diam-diam. Refresh untuk muat ulang.
7. Guru login → Presensi GPS → Rekap Kehadiran: default Hari ini, hanya data hari ini. Pilih Bulan lalu kembalikan Hari ini, verifikasi semua tanggal sesuai WIB.
8. Bandingkan pembacaan Firestore (Network/Firebase usage): hanya query harian awal, saat memilih Bulan terjadi query range sesuai pilihan. Penghematan bergantung pada jumlah data historis dan cache.
9. Pastikan check-in/checkout, selfie, R89-B reminder, R89-C monitoring, R89-D pengaturan reminder, dan R89-E koreksi Admin/audit masih bekerja.

## Validasi lokal
- `node scripts/test_r90_tv_lobby_daily_recap.mjs` (memerlukan `typescript` dari `npm ci`) — 24 pemeriksaan logika dan sintaks lulus di lingkungan penyusunan.
- `npm run lint` dan `npm run build` perlu dijalankan pada instalasi proyek lengkap. Lingkungan penyusunan belum memiliki node_modules dan tidak dapat memverifikasi build penuh / rules emulator / interaksi Firestore server.

## Cara menerapkan
Ekstrak ZIP ke akar repo Piket Guru setelah R89-E, izinkan menimpa file yang tercantum, lalu jalankan `npm ci`, `npm run lint`, `npm run build`, `node scripts/test_r90_tv_lobby_daily_recap.mjs`. Commit & push melalui GitHub Desktop → Vercel Preview → uji kasus di atas → deploy produksi bila lolos.

Tidak perlu deploy ulang Firestore Rules untuk patch R90.
