# R114 — Offline Sync & Data Integrity (Tahap Pengamanan Awal)

**Basis:** R113-C Dashboard + R112 Login/GPS. Patch ini **tidak** memigrasikan IndexedDB, mengganti ID operasi, mengubah Firebase Rules, menghapus antrean, ataupun mengubah proses autentikasi dan GPS.

## Risiko yang ditemukan

1. Pembacaan antrean (`getSyncItemsByUser`) sebelumnya dapat mengembalikan `[]` saat IndexedDB gagal (mode non-strict). Panel bisa menunjukkan antrean kosong, padahal isi penyimpanan belum berhasil diperiksa.
2. Ketika `triggerSync` memproses nol item (koneksi hilang, kunci lintas tab tidak tersedia, atau backoff), UI sebelumnya bisa mengatakan "Tidak ada antrean" walaupun item masih tertunda.
3. Pengecekan otomatis saat online menggunakan pembacaan non-strict, sehingga error penyimpanan dapat dianggap tidak ada pekerjaan. Pembersihan cache tampilan juga dipanggil dua kali.

## Perbaikan

- `SyncQueueService.refreshStatus`: gunakan pembacaan **strict** dan laporkan `storageError` saat penyimpanan tidak terbaca. Perubahan ditayangkan ke subscriber UI; error tidak diterjemahkan menjadi "semua data berhasil".
- `useAutomaticSync`: pembacaan antrean **strict**, error ditangani oleh retry loop yang sudah ada; data tidak dikeluarkan dari antrean.
- Badge, panel, dan modal: status **Penyimpanan belum terbaca** menonjol, tombol kirim dinonaktifkan ketika penyimpanan tidak dapat diverifikasi atau sesi offline belum tervalidasi.
- Setelah trigger sinkronisasi, panel memeriksa status terbaru. Bila `processed=0` tapi masih ada pending/needs-action, tampil **antrean masih tertunda**.
- Perintah penghapusan dan retry modal menangkap kegagalan dan memberi pesan, bukan menghasilkan unhandled promise rejection. Pembersihan cache tampilan dipanggil sekali.

## Batasan nyata (penting untuk integritas)

- *Offline* tidak berarti semua tindakan dapat otomatis dikirim. Antrean menyimpan operasi yang secara eksplisit menggunakan `SyncQueueService.enqueue`. Presensi Check-In/Check-Out tetap mengikuti verifikasi GPS, selfie dan server; jangan menganggap Check-In yang gagal jaringan otomatis tersimpan dalam antrean tanpa indikator eksplisit.
- Mode **Perangkat Publik** menyimpan antrean di memori saja; data tidak dijamin bertahan bila tab ditutup. Untuk pemakaian HP pribadi dan penyimpanan draf tahan refresh, aktifkan **Perangkat Pribadi/Tepercaya**.
- `storageError` berarti **belum dapat diperiksa**, bukan data hilang. Jangan membersihkan data situs, menghapus cache seluruh browser, atau logout paksa saat pekerjaan belum disinkronkan.
- Patch ini tidak menjamin *exactly-once* lintas semua operasi bila layanan eksternal/Firestore merespons ambigu. Proses penyimpanan idempotent per modul tetap perlu audit tersendiri pada tahap R114 berikutnya dan pengujian perangkat nyata.

## Pengujian

```sh
node scripts/test_r114_offline_integrity_guards.mjs
node scripts/verify_r57_offline_pwa.cjs
node scripts/verify_baseline_dashboard_r113c.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
npm ci
npm run lint
npm run build
```

Uji HP/Vercel Preview: (1) buat draft dan pastikan tetap ada setelah refresh; (2) putuskan koneksi ketika ada antrean, sambungkan lagi, lalu periksa status; (3) uji login dengan akun berbeda — antrean akun awal tidak boleh terbuka; (4) coba saat IndexedDB terganggu — UI harus menampilkan status tidak diketahui, bukan keberhasilan; (5) periksa bahwa presensi GPS hanya sah setelah validasi normal.

**Rollout:** gunakan pilot terbatas dahulu. Bila data pending belum terkirim, jangan rollback dengan membersihkan data situs. Kembali ke commit/tag stabil R113-C setelah memastikan penyimpanan lokal dalam kondisi aman.
