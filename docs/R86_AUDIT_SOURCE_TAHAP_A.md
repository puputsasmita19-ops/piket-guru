# Piket Guru R86 — Audit Source Multi-Tab & Session Recovery

**Tahap A (audit read-only, belum mengubah aplikasi)**  
**Tanggal:** 25 Oktober 2026  
**Sumber yang tersedia:** `piket-guru-main.zip` (arsip source, timestamp sebagian 24 Oktober 2026) ditambah file perubahan R85 yang ada dalam `PIKET-GURU-R85.zip`. **Bukan** checkout lengkap HEAD produksi sesudah R85. Banyak incremental R68–R84 tidak tersedia sebagai satu working tree utuh pada audit ini. Karena itu temuan di bawah adalah **audit pendahuluan yang perlu dikonfirmasi pada source GitHub terkini**.

## Ringkasan temuan nyata dari source

| Area | Bukti source | Penilaian audit |
|---|---|---|
| Pengiriman offline | `src/services/offline/syncQueueService.ts` telah menerapkan `navigator.locks.request`, `OfflineStorage.syncLease`, cek pemilik UID dan operation ID deterministik. | **Sudah ada proteksi penting**: jangan buat sync engine/lock paralel baru. Uji failover. |
| Penyimpanan offline | `src/services/offline/offlineStorage.ts`: tepercaya memakai IndexedDB, mode bukan tepercaya memakai `memoryStore` per tab. | **Risiko tinggi** jika memaksa tab shared-device menutup/reload dengan draf belum terkirim. |
| Sinkronisasi berkala | `src/hooks/useAutomaticSync.ts`: polling ~20–30 detik, memeriksa `document.hidden`, serta hook `online`/`visibilitychange`; memanggil `SyncQueueService.cancelSync()` saat cleanup. | **Sudah hemat ketika tersembunyi**, audit cancel/cleanup sebelum menambah tab leadership. |
| Login/sesi | `src/contexts/AuthContext.tsx` + `src/services/auth/backgroundSession.ts`: validasi auth Firebase, logout saat idle, kebijakan background opsional berdasarkan perangkat. | **Jangan** otomatis logout/pindah token antar-tab; wajib mengikuti aturan Admin. |
| Firestore live | `DashboardView.tsx` mengatur sejumlah subscription (settings, schedules, teachers, staff, attendance, dutyBooks, incidents, announcements, tardiness, permits, visitors). | Potensi pekerjaan duplikat per tab; lakukan pengukuran baseline sebelum optimasi. |
| Notifikasi | `src/components/layout/NotificationBell.tsx`, `src/services/notifications/notificationFeedService.ts`: sampai empat sumber query tergantung konfigurasi. | Hindari bunyi/toast ganda; listener bisa tetap dibutuhkan untuk keamanan/keadaan UI. |
| Audit feed | `src/services/audit/auditLogFeedService.ts`: listener realtime khusus hak Admin. | Jangan hentikan sewaktu digunakan. |
| Sharing listener | `src/services/firebase/sharedLiveSource.ts` memakai `Set` level modul. | Berbagi hanya **di dalam satu JavaScript context**, tidak otomatis antar-tab. |
| PWA update | `src/services/offline/appUpdateManager.ts` melakukan update check pada fokus/online/visibility. | Handoff tab harus menghormati pengaman update R75 dan offline queue. `pwaUpdateSafety.ts` tidak terdapat di arsip source dasar yang tersedia sehingga **perlu verifikasi source HEAD**. |
| Koordinasi tab UI | Tidak ditemukan `BroadcastChannel` pada source dasar dan patch R85 yang tersedia. | Belum ada lapisan koordinasi UI antartab yang dapat dikonfirmasi dari snapshot ini. |
| Konfigurasi Firestore | `src/services/firebase/firebase.ts`: memakai `getFirestore(...)`; tidak terlihat konfigurasi persistence multitab eksplisit pada file ini. | **Jangan** mengganti persistence Firestore sebagai bagian awal R86 tanpa audit penuh; Firestore dan offline queue kustom adalah dua sistem berbeda. |

## Rekomendasi rancangan R86

**Tidak menutup tab, tidak memaksa logout, tidak otomatis membersihkan storage.** Halaman tab lama dapat tetap terbuka; prioritas ialah keselamatan data, sesi valid, dan konsumsi resource.

### R86-A — Instrumentasi (tanpa memengaruhi bisnis)
- Tambahkan pencatat DEV-only status `document.visibilityState`, tab ephemeral ID, account+project scope, status antrean, jumlah draf, jumlah subscription aktif/idle, dan jumlah revalidation.
- Jangan kirim data pribadi, payload foto, PIN, UID mentah atau token lewat kanal tab/telemetri.
- Ukur kondisi 1, 2, 3, 5 tab; bandingkan listener dan penggunaan jaringan di staging. Hindari angka optimasi yang dikarang.

### R86-B — Koordinator ringan (feature flag OFF terlebih dulu)
- `BroadcastChannel` untuk pengumuman tab `HELLO`, `FOCUSED`, `HIDDEN`, `LEAVING` / heartbeat terbatas dan identitas ephemeral. Scope origin/proyek/akun; jangan memuat data sensitif.
- Jangan jadikan BroadcastChannel sebagai sumber keputusan keamanan ataupun menggantikan `navigator.locks` pada sync. Ia hanya sinyal UI/liveness. Jika tidak tersedia, setiap tab tetap dapat bekerja dalam mode konservatif.
- `pagehide/pageshow` + `visibilitychange` untuk menangani BFCache, tab suspend, dan resume; jangan mengandalkan unload/browser close selalu terpanggil.

### R86-C — Kepemimpinan pekerjaan nonkritis (fitur bertahap)
- Tab foreground yang digunakan menjadi kandidat pemimpin untuk **pekerjaan nonkritis**, bukan pemilik mutlak data. Saat dua jendela terlihat bersamaan, gunakan arbitration deterministik dengan masa berlaku dan klaim aman.
- Jangan hentikan listener autentikasi/role yang melindungi hak akses. Jangan mematikan pengiriman antrean di tengah proses `SENDING`, lease, atau operasi tulis.
- Optimasi dimulai dari animasi/timer dan notifikasi presentasional duplikat. Pengurangan listener Firestore dilakukan terpisah, hanya setelah uji tidak membuat data stale berbahaya.
- Tab lama yang disentuh kembali mengambil peran foreground tanpa memaksa reload atau kehilangan input.

### R86-D — Sesi dan recovery
- Konfigurasi login R77–R85, PIN/Google, peran, perangkat tepercaya, kebijakan background Admin, dan pemeriksaan online tetap **otoritatif**.
- Saat kembali, validasi sesi berdasarkan kebijakan existing; jika valid resume data, jika memerlukan autentikasi tampilkan login; jangan login otomatis hanya karena menerima pesan tab.
- Pada perangkat tidak tepercaya, proses `memoryStore` dapat hilang jika tab ditutup; tampilkan peringatan jika ada draf/kiriman, dan jangan mencoba take-over draf lintas tab tanpa pengamanan pemilik data.

## Matriks penerimaan staging sebelum implementasi aktif

1. Satu tab: login PIN, check-in/out GPS, swafoto, buku piket, izin siswa, dan notifikasi normal.
2. Dua tab akun sama: tab baru aktif, tab lama pasif untuk pekerjaan nonkritis, lalu tab lama mendapat fokus kembali. Tidak ada data yang hilang.
3. Dua tab akun berbeda di browser yang sama: wajib mengikuti Firebase session security; jangan izinkan tab lama mengirim atas UID yang sudah berganti.
4. Perangkat tepercaya: putus internet saat antrean 1+ dan draf foto 1+, buka tab kedua lalu tutup salah satunya; operasi ID tidak digandakan, tidak ada silent loss.
5. Perangkat bersama: isi form belum disubmit, buka tab baru, beralih tab; **jangan** auto-close atau reset memory draft. Peringatkan risiko saat menutup tab.
6. Kunci sync: tab A `SENDING`, tab B mencoba sync; hanya satu boleh memiliki lease/lock. Setelah A mati, B boleh retry sesuai aturan existing tanpa membuat duplicate write.
7. Role/izin dicabut admin saat tab lain tersembunyi: saat kembali akses dicek ulang sebelum tindakan berizin.
8. Background session policy aktif 15/30/60 detik: tetap menuntut login bila diwajibkan; tidak ada bypass oleh leader baru.
9. PWA update saat ada draf/kiriman: konfirmasi dan guard existing tetap berlaku; jangan hapus IndexedDB.
10. Notifikasi realtime: tidak ada bunyi/toast ganda; label unread dan daftar tetap konsisten.
11. Chrome Android/desktop + offline/online + BFCache: tidak muncul loops/freeze, timer/listener dibersihkan saat unmount.
12. `npm run lint`, `npm run build`, dan tes emulator/backend relevan harus lulus; jangan push sebelum selesai.

## Scope perubahan yang dianjurkan setelah audit HEAD aktual

**File baru yang mungkin diperlukan:** `src/services/tab/tabCoordinator.ts`, `src/hooks/useTabPresence.ts`, `src/services/tab/tabPolicy.ts`, `scripts/verify_multitab_r86.cjs` (nama usulan, belum dibuat untuk produksi).

**File yang diperiksa dahulu:** `src/AuthenticatedShell.tsx`, `src/hooks/useAutomaticSync.ts`, `src/contexts/AuthContext.tsx`, `src/services/offline/{syncQueueService,offlineStorage,pwaUpdateSafety,appUpdateManager}.ts`, `src/services/auth/backgroundSession.ts`, `src/components/layout/NotificationBell.tsx`, `src/services/notifications/notificationFeedService.ts`, `src/features/dashboard/DashboardView.tsx`, `src/services/firebase/{firestoreService,sharedLiveSource}.ts`.

**Pengecualian awal:** tidak mengubah Firestore Rules, schema IndexedDB, Firebase Auth persistence, backend API, struktur UID/operationId, maupun data produksi. Tidak membuat perubahan fitur R86 sebelum pengujian full source/HEAD selesai.

## Cara menjalankan audit read-only di checkout terbaru

1. Ekstrak ZIP audit R86 ke root repository GitHub lokal (hanya `scripts/` dan `docs/`).
2. Pastikan branch/commit terbaru dan seluruh perubahan R85 sudah ada.
3. Jalankan `node scripts/audit_multitab_r86.cjs`. Tidak perlu NPM untuk audit statis ini.
4. Simpan hasilnya. Periksa manual tiap item `REVIEW` / `NOT FOUND`; jangan otomatis memperbaiki hanya karena file berpindah.
5. Tinjau Git diff terlebih dahulu; audit ini **tidak melakukan commit/push**.

## Referensi umum

- MDN BroadcastChannel: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN Web Locks: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
- Firebase Firestore offline/multi-tab persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
