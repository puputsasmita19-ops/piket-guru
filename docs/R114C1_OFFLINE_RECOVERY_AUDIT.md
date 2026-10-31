# R114-C1 — Offline Recovery Audit

**Sumber pemeriksaan:** repository Piket Guru setelah R114-B, dipadukan dengan baseline Login/GPS R112 dan Dashboard R113-C. Tahap ini adalah audit + perbaikan terbatas pada pemulihan antrean, bukan perubahan format database atau penambahan fitur offline baru.

## 1. Peta siklus antrean yang diaudit

1. `SyncQueueService.enqueue` membuat ID operasi deterministik dan fingerprint kiriman, lalu menyimpan `PENDING_NETWORK` ke IndexedDB pada perangkat tepercaya (memori pada perangkat publik).
2. `useAutomaticSync` bangun ketika koneksi kembali/halaman aktif, memeriksa antrean secara ketat dan melakukan sinkronisasi bila sesi valid.
3. `SyncQueueService.triggerSync` menggunakan Web Locks bila tersedia, serta `OfflineStorage.syncLease` sebagai perlindungan lintas-tab cadangan (lease 90 detik, upaya renewal setiap 10 detik).
4. `runSyncProcess` memeriksa item tertahan `SENDING` lebih dari 120 detik, lalu mengambil klaim baru secara atomik untuk kiriman `PENDING_NETWORK`.
5. Operasi yang sah disimpan ke Firebase, kemudian `acknowledgeSyncItem` menghapus kiriman hanya jika token attempt, akun, proyek, dan fingerprint cocok.
6. Kesalahan yang dapat dicoba kembali mempertahankan antrean dengan backoff. Kesalahan hak akses/konflik menjadi `NEEDS_ACTION` dan tidak dikirim ulang otomatis.

## 2. Temuan dan perbaikan R114-C1

| Temuan | Dampak sebelum patch | Tindakan |
|---|---|---|
| Stale recovery hanya mencocokkan UID, proyek, operation ID, fingerprint, dan usia; belum membandingkan token pengirim | Snapshot lama berisiko mengembalikan attempt baru ke `PENDING_NETWORK` | Membandingkan `deliveryAttemptId` dalam transaksi yang sama; antrean lama tanpa token hanya valid jika kedua sisi tanpa token |
| Penolakan izin pada item `PENDING_NETWORK` langsung melakukan `updateSyncItem`, bukan conditional update | Keputusan lama dari tab A dapat menimpa `SENDING` tab B | `markPendingSyncItemNeedsAction` memastikan status, UID, proyek, operation ID, fingerprint, dan tidak ada token; dibungkus transaksi IndexedDB |
| Timestamp `updatedAt` rusak dapat membuat `SENDING` tidak pernah dipulihkan | Antrean tertahan tanpa kejelasan | Jangan menganggap `createdAt` sebagai waktu percobaan kirim; jika `updatedAt` tidak valid, tahan recovery otomatis untuk pemeriksaan manual |
| Ketidaksesuaian project ID pada input operasi dapat lolos saat doc tersimpan di proyek saat ini | Validasi data tidak seragam | Memastikan project ID input serta data tersimpan cocok dengan proyek aktif saat recovery/transisi |

**Ketetapan:** timeout `SENDING` tetap **120 detik**; lease tetap **90 detik** dengan heartbeat **10 detik**. Tidak ada perubahan struktur IndexedDB, koleksi Firebase, `firestore.rules`, radius GPS, PIN, ataupun region Vercel `sin1`.

## 3. Risiko yang tersisa (masuk R114-C2/C3)

| Risiko | Tingkat | Penanganan lanjutan |
|---|---|---|
| Browser/HP tersuspensi lebih dari lease 90 detik ketika operasi jaringan masih berlangsung; owner lama mungkin lanjut sebelum heartbeat menolak | Tinggi | Stress test dua tab nyata, kehilangan lock, serta fencing idempotensi server pada semua efek operasional |
| Foto/unggahan pihak ketiga berhasil tetapi konfirmasi akhir hilang | Tinggi | Simulasikan respons hilang setelah upload, verifikasi stabilnya ID file dan deduplikasi Drive |
| Perangkat publik menyimpan antrean hanya dalam memori | Tinggi sebagai batasan desain | Berikan UX yang jelas: menutup tab bisa menghilangkan pekerjaan belum terkirim; jangan menjanjikan recovery lintas restart |
| Preferensi 'perangkat tepercaya' berubah ke nontepercaya ketika IndexedDB masih berisi antrean | Sedang | Uji akses dan penjelasan bagi pengguna; jangan hapus/migrasikan tanpa pemeriksaan akun |
| 20–50 kiriman bersamaan dan jaringan putus-nyambung | Sedang | Uji stress dan memori saat reconnect; pastikan tidak ada pengiriman paralel untuk operasi sama |
| Snapshot lama tanpa fingerprint/token dari versi sebelum R114-B | Sedang | Uji kompatibilitas antrean lama; kiriman tanpa receipt tidak boleh diasumsikan exactly-once |
| Izin lokasi/waktu Check-In/Check-Out tidak tersedia saat offline | Kebijakan tetap | Presensi GPS tetap butuh validasi lokasi segar dan konfirmasi server; jangan tampilkan sukses dari antrean lokal |

## 4. Kriteria R114-C1

- **PASS**: Attempt lama tidak dapat mereset, menimpa, atau meng-ACK attempt baru dengan operation ID + fingerprint identik.
- **PASS**: Status yang masih `PENDING_NETWORK` dapat menjadi `NEEDS_ACTION` secara atomik; status `SENDING` tidak diubah dari hasil keputusan stale.
- **PASS**: `SENDING` yang benar-benar stale dipulihkan dari IndexedDB setelah restart sesuai batas usia, tanpa menghapus kiriman.
- **PASS**: Timestamp percobaan kirim yang rusak tidak dipakai untuk menyimpulkan operasi aman diulang, meskipun `createdAt` valid.
- **PASS**: Baseline Dashboard R113-C dan Login/GPS R112 tidak berubah.
- **BELUM DIVERIFIKASI**: Race browser sungguhan, kegagalan tepat setelah commit server, Firebase Emulator, build produksi, dan perilaku HP nyata.

## 5. Uji lokal

```bash
node scripts/test_r114c1_offline_recovery_audit.mjs
node scripts/test_r114b_idempotent_sync.mjs
node scripts/test_r114_offline_integrity_guards.mjs
node scripts/verify_r57_offline_pwa.cjs
node scripts/verify_baseline_dashboard_r113c.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
npm ci
npm run lint
npm run build
```

Tes R114-C1 memakai pengujian perilaku memori dan simulasi transaksi IndexedDB yang diserialkan, bukan koneksi produksi. Untuk QA lapangan gunakan Vercel Preview / Firebase Emulator serta akun/dokumen dummy; jangan sengaja mematikan jaringan ketika ada presensi operasional yang belum tercatat.

## 6. Panduan implementasi

Ekstrak ZIP incremental pada repository yang sudah menerapkan R114-B, pertahankan seluruh file lain, jalankan uji regresi lalu deploy ke Vercel Preview terlebih dahulu. Tidak ada migrasi database/aturan. Jangan hapus cache situs atau IndexedDB saat ada draf/antrean tertunda. Backup/tag rilis stabil sebelum deploy.
