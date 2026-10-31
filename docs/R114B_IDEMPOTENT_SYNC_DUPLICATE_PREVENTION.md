# R114-B — Idempotent Sync & Duplicate Prevention

**Basis yang dipertahankan:** R114-A Offline Sync & Data Integrity; baseline Dashboard R113-C dan Login/GPS R112; Vercel Functions tetap `sin1`. Tidak ada perubahan pada alur GPS, PIN, login, ataupun `firestore.rules`.

## Risiko yang ditemukan

1. `PENDING_NETWORK → SENDING` semula ditulis dari snapshot antrean yang sudah dibaca; penulis lain dapat mengambil pekerjaan yang sama ketika terjadi kontensi tab / pemulihan lease.
2. Setelah server berhasil tetapi respons jaringan hilang, retry pembaruan dapat menulis ulang dokumen dan membuat log audit ganda, atau menimpa revisi yang lebih baru.
3. Pemulihan kiriman `SENDING` setelah lebih dari dua menit semula bisa menimpa keadaan antrean lain karena tidak melakukan pemeriksaan dalam transaksi yang sama.
4. Pengirim lama yang kembali aktif setelah lease kedaluwarsa berpotensi menghapus status kiriman dari pengirim baru.
5. `studentPermits`, `visitors`, dan `substitutions` memiliki jalur create yang memeriksa ID sudah ada. Sekarang kepemilikan dokumen dicek dahulu sebelum menganggapnya sebagai retry berhasil.

## Perbaikan

- **IndexedDB atomic claim:** klaim antrean dibuat melalui transaksi `readwrite` dengan pemeriksaan UID, Firebase project, `PENDING_NETWORK`, ID operasi, dan SHA-256 fingerprint yang sama. Di perangkat publik, antrean yang hanya ada di memori menggunakan validasi yang sama.
- **Delivery attempt token:** setiap klaim menghasilkan ID percobaan acak. Acknowledgement dan perubahan status saat gagal hanya boleh dilakukan jika token percobaan masih dimiliki pengirim tersebut.
- **Atomic ACK:** setelah operasi berhasil, hapus item tepat sekali dengan pemeriksaan token, UID, proyek, dan fingerprint. ACK pengirim lama tidak menghapus item baru.
- **Stale recovery:** kiriman `SENDING` yang tidak aktif lebih dari 120 detik baru dapat dikembalikan ke `PENDING_NETWORK` dengan *read-check-write* atomik dan token percobaan dihapus. Antrean dibaca ulang sesudah pemulihan supaya pemulihan bisa diproses pada siklus yang sama.
- **Server receipt pada catatan yang diperbarui:** Buku Piket, Kejadian, Siswa Terlambat, Izin Siswa, Buku Tamu, dan Guru Pengganti dapat mengenali replay pembaruan yang telah disimpan di Firestore menggunakan `offlineSubmissionKey` yang terikat pada `operationId` + fingerprint. Kiriman identik tidak menulis ulang data atau audit.
- **Konflik revisi:** Buku Piket tidak menerima antrean lama yang sudah dilewati pembaruan lebih baru; perubahan online berikutnya mengosongkan penanda receipt sebelumnya. Untuk konflik, antrean tetap tersimpan untuk penanganan yang sesuai.
- **Tidak mengubah UI antrean:** status R114-A (termasuk `Penyimpanan belum terbaca`) dan perilaku offline lama tetap digunakan.

## Cakupan dan batasan penting

- Ini mendekati pengiriman *at-least-once dengan deduplikasi saat retry*; **bukan jaminan exactly-once universal**. File foto atau operasi eksternal yang selesai sebelum commit Firestore masih perlu mengandalkan ID foto stabil yang dimiliki tiap layanan. Pengujian dua browser nyata dan Firebase Emulator belum dijalankan di lingkungan ini.
- Untuk operasi *create*, modul sudah menggunakan ID dokumen stabil dan penolakan konflik server. R114-B terutama menambahkan receipt yang persisten untuk operasi *update*, selain Buku Piket draft/kirim.
- Penanda `offlineSubmissionKey` berupa metadata ID+SHA-256 yang tersimpan pada dokumen operasional; tidak menyimpan PIN, token Firebase, atau detail isi formulir. Penanda kosong ditulis sebagai `null` saat ada perubahan online biasa.
- **Check-In/Check-Out tidak otomatis disinkronkan offline.** Validasi server, GPS, foto, dan aturan kehadiran tidak diubah. Jangan menganggap pekerjaan presensi tersimpan tanpa konfirmasi UI.
- Perangkat publik masih memakai antrean dalam memori: penutupan tab dapat menghapus data tertunda. Perangkat pribadi/tepercaya menyimpan antrean di IndexedDB.
- Antrean lama yang dibuat sebelum R114-B masih dapat dibaca; jika tidak memiliki fingerprint, dukungan receipt tidak berlaku untuk item tersebut. Jangan hapus penyimpanan situs guna memperbaiki kegagalan sinkronisasi.
- Tidak ada migrasi IndexedDB, penghapusan antrean, perubahan akses, atau penambahan koleksi Firebase.

## Pengujian lokal

```sh
node scripts/test_r114b_idempotent_sync.mjs
node scripts/test_r114_offline_integrity_guards.mjs
node scripts/verify_r57_offline_pwa.cjs
node scripts/verify_baseline_dashboard_r113c.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
npm ci
npm run lint
npm run build
```

## Pengujian pilot Vercel Preview / Firebase Emulator

1. Gunakan satu akun Guru pada **perangkat pribadi tepercaya**. Simpan draf Buku Piket offline, lalu pulihkan jaringan. Pastikan satu dokumen dan satu log audit dibuat.
2. Simulasikan respons putus tepat setelah commit Firestore namun sebelum ACK di browser; ulangi sinkronisasi. Pastikan data tidak terduplikasi dan antrean akhirnya kosong setelah berhasil.
3. Buka dua tab dengan akun yang sama; buat satu item offline pada tab A. Hidupkan jaringan dan picu Sinkronkan dari kedua tab. Hanya satu klaim boleh memproses item pada waktu yang sama.
4. Ketika item sedang `SENDING`, coba hapus/ulang manual. Aplikasi harus menolak tindakan tersebut.
5. Simulasikan tab macet hingga lebih dari 120 detik, tutup paksa, lalu pulihkan. Periksa pekerjaan tetap ada dan kembali dikirim tanpa duplikasi.
6. Uji konflik: antrean draf yang belum terkirim dan revisi yang lebih baru di server. Versi lama **tidak boleh** menimpa versi baru.
7. Uji buku tamu dan data siswa dengan lampiran, izin akses dicabut, akun berpindah, mode publik, offline berulang, dan batas retry.

**Rilis terbatas dahulu.** Jangan membersihkan IndexedDB/cache situs selama ada draf atau antrean yang belum terkirim. Catat backup dan gunakan baseline Git untuk rollback aplikasi; rollback tidak boleh menghapus antrean pengguna.
