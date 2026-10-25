# Piket Guru R86-E1 — Audit & Baseline Firestore Listener

**Tahap:** E1 (audit read-only). **Tidak ada perubahan source runtime.**
**Tujuan:** membuat inventaris locus subscription serta baseline multi-tab agar optimasi R86-E2 didasarkan pada bukti, bukan intuisi.

## Keterbatasan sumber

Source GitHub produksi terbaru tidak bisa diakses langsung dari lingkungan penyusunan. Pemeriksaan pertama dilakukan pada snapshot gabungan Piket Guru melalui R85 dan R86-A/B/C/D (426 berkas TS/TSX), **bukan HEAD GitHub saat ini**. Perintah dalam paket ini ditujukan untuk dijalankan pada checkout lokal **yang sudah GitHub Desktop Fetch/Pull**. File `artifacts/r86e1/baseline.json` yang dibuat lokal akan memuat hash commit Git bila `.git` tersedia, status working tree, jumlah file dan checksum source.

## Hasil awal dari arsip yang tersedia — masih provisional

- 5 lokasi pemanggilan `onSnapshot` SDK di `src/services/firebase/firestoreService.ts` (2), `src/services/notifications/notificationFeedService.ts` (1), `src/services/audit/auditHistoryService.ts` (1), `src/services/audit/auditLogFeedService.ts` (1).
- 77 lokasi pemanggilan `subscribeToCollection` dan 16 `subscribeToDocument` (**93 total wrapper consumers**); bukan berarti 93 koneksi Firestore bersamaan.
- 1 lokasi pemanggil `subscribeNotificationFeed` (Bell), 1 untuk `subscribeLatestAuditLogs`, 1 untuk `subscribeAuditHistoryHead`.
- 22 lokasi pembacaan SDK sekali (`getDoc[s]`, fromServer, countServer). Dibedakan dari realtime.
- 2 lokasi pemanggilan `onAuthStateChanged` (Firebase Auth, bukan `onSnapshot`).
- `sharedLiveSource` memakai identitas/scope subscriber dan berbagi sumber subscription identik **di dalam tab yang sama**. Jangan membuat caching atau deduplication baru yang mengganggu itu.
- Notifikasi: jalur `notificationFeedService` menjalankan `onSnapshot` dalam loop pada spesifikasi yang bisa berjumlah **0–4 query** menurut pengaturan; sumber `notificationEvents` dan dua query `announcements` (`createdAt` dan `updatedAt`) memiliki alasan fungsional dan tidak boleh dihapus begitu saja.
- `FirestoreService.subscribeToCollection` memiliki cache spesifik berdasarkan query dan scope user; tidak boleh menggantinya dengan cache seluruh koleksi tanpa bound.
- Notifikasi dan audit memakai `includeMetadataChanges` pada jalur tertentu; callback bisa muncul karena perubahan metadata, sehingga jumlah emissions tidak mewakili dokumen atau read yang ditagihkan.

### Sebaran pemanggilan wrapper collection (contoh area terpadat pada arsip)

| Area / file | Call site statis `subscribeToCollection` | Prioritas analisis | Keputusan E1 |
|---|---:|---|---|
| `features/dashboard/DashboardView.tsx` | 11 | Tinggi | Audit kapan route di-mount/unmount, efek aktif sepanjang sesi, serta cleanup |
| `features/reports/ReportsPreview.tsx` | 10 | Sedang–tinggi | Audit apakah tab laporan aktif; jangan otomatis mematikan pembacaan report |
| `features/settings/SettingsView.tsx` | 7 | Tinggi (admin data) | Validasi pemuatan tab pengaturan dan cleanup |
| `features/command-center/CommandCenterPreview.tsx` | 6 | Sedang | Audit mount berdasarkan menu |
| `features/kiosk/KioskPreview.tsx` | 6 | Sedang | Audit tampilan TV lobi dan sumber feed |
| `features/schedules/SchedulePreview.tsx` | 6 | Tinggi | Jadwal piket harus selalu konsisten |
| `features/master/MasterDataTabs.tsx` | 5 | Sedang | Audit lazy mount tab; jangan gunakan count call site sebagai biaya |
| `features/attendance/*` | 9 | KRITIS | Jangan auto-pause; presensi masuk/pulang harus tetap aman |

**Catatan:** Distribusi di tabel berasal dari arsip lokal (bukan pengukuran runtime). Daftar file lengkap akan dihasilkan oleh scanner pada checkout terbaru.

## Arsitektur & pengaman yang sudah ditemukan

1. `sharedLiveSource.ts` memakai channel *in-memory* per tab, identitas query dan scope akun. Ia melepas SDK listener saat observer terakhir tidak ada; perlu mengecek perilaku ini lewat tes nyata.
2. `OfflineStorage.registerListener` dipakai untuk membersihkan subscription ketika sesi/storage scope berganti. Jangan mencabut pengaman ini.
3. `notificationFeedService.ts`: event user, event sekolah, pengumuman terbaru dan pengumuman yang diedit adalah jalur dengan kepentingan berbeda; keduanya terkait pengalaman pengguna.
4. Dua jalur audit realtime (`auditHistoryService`, `auditLogFeedService`) tidak memakai wrapper `FirestoreService` biasa; instrumentasi R86-C sebelumnya belum tentu menghitung seluruh listener audit.
5. R86-A–D berstatus *opt-in* dalam development/Preview dan tidak mengukur billed reads Firebase.

## Menjalankan inventaris pada GitHub HEAD lokal yang terbaru

1. GitHub Desktop → **Fetch origin → Pull origin** pada branch yang benar. Pastikan perubahan sebelumnya sudah committed dan tidak ada konflik.
2. Ekstrak ZIP R86-E1 ke **root** repository, sehingga file `scripts/` dan `docs/` berada pada path aslinya.
3. Terminal di root repository:

```bash
node scripts/verify_r86e1_audit.cjs
node scripts/audit_r86e1_firestore_baseline.cjs --out artifacts/r86e1
```

Default tanpa `--out` hanya menampilkan ringkasan; `--out` secara eksplisit membuat **dua file baru**: `artifacts/r86e1/baseline.json` dan `artifacts/r86e1/baseline.md`. Data yang dicatat berisi hanya path source relatif, nomor baris, kategori metode, petunjuk collection statis, klasifikasi risiko, status Git, dan fingerprint source. **Tidak membaca database, kredensial, UID, PIN, konten dokumen, foto, atau draf.** Tidak memodifikasi `src/`.

4. Untuk membandingkan dengan baseline sebelumnya:

```bash
node scripts/audit_r86e1_firestore_baseline.cjs --out artifacts/r86e1/latest --compare artifacts/r86e1/baseline.json
```

Ini membandingkan **jumlah lokasi kode**, bukan jumlah subscription aktif atau biaya Firestore. Jalankan dari checkout versi yang ingin dibandingkan; simpan file sebelumnya agar tidak tertimpa.

5. Lakukan `git status` dan `git diff --check`; jangan masukkan hasil audit per-user atau data sensitif ke commit. Test file audit hanya boleh masuk ke GitHub setelah review.

## Baseline staging yang dibutuhkan (sebelum menyentuh listener)

Gunakan **Preview Vercel atau development** dengan akun uji, bukan sekolah produksi. Pastikan flags R86-A/B/C/D sudah opt-in dan sesuai dokumentasi lama. Catat commit SHA, browser, lebar layar, jumlah tab (1/2/3/5), halaman/menu terbuka, foreground/background, durasi per skenario, serta waktu pengukuran.

Pada DevTools Console, jalankan **pada tiap tab**:

```js
window.__PIKET_R86_AUDIT__?.snapshot()
window.__PIKET_R86B__?.snapshot()
window.__PIKET_R86C__?.snapshot()
window.__PIKET_R86D__?.snapshot()
```

Jangan membagikan output mentah jika di masa depan struktur probe berubah dan memuat identitas. Ambil hanya angka agregat berikut dari R86-C: `counters.collection|document|notification|announcement` → `opened`, `active`, `closed`, `emissions`, `errors`. Catat `active` sebelum dan sesudah logout/navigasi untuk mengecek cleanup. Catat `observedPeers`, `visualQuiet`, `hiddenEpisodes`, `resumes`, `heapBytes` bila tersedia. Nilai heap browser indikatif.

### Ukur biaya Firestore secara terpisah

Gunakan *Firebase Console → Firestore → Usage* untuk melihat document reads yang ditagihkan, dengan durasi pengujian, database, dan beban lain yang tercatat. Firebase Usage biasanya tidak memberikan atribut biaya per tab tanpa pengukuran terisolasi. Jangan mengurangi target read per-tab dengan menganggap `emissions == reads`, dan jangan menyamakan `5 lokasi onSnapshot` dengan 5 SDK listener aktif.

### Matriks uji minimum

| Skenario | Yang diperiksa | Gate |
|---|---|---|
| 1 tab, halaman dashboard | baseline active listener, callback, navigasi | Tidak ada error baru |
| 2/3/5 tab | listener per tab, tab foreground/hidden, kontribusi callback | Tidak terjadi duplikasi transaksi/notifikasi penting |
| Switch menu Dashboard ↔ Laporan ↔ Pengaturan | unsubscribe/re-subscribe, data fresh | Tidak ada stale data atau bocor listener saat kembali |
| Presensi masuk/pulang + GPS/selfie | end-to-end transaksi test dan idempotensi | Tidak ada kehilangan / double write |
| Draf buku piket dan foto offline | data bertahan antar-tab dan saat refresh | Tidak ada data hilang |
| Offline→online | Web Locks/lease queue tetap benar | Tidak ada flush ganda |
| Sesi habis, akun berganti | listener sesi lama harus berhenti | Tidak membocorkan data akun |
| Pengumuman baru/diubah dan emergency | tetap muncul sesuai aturan pada tab aktif | Tidak ada suppression yang salah |
| PWA update + tab lama | versi, data pending dan cache | Tidak menghapus IndexedDB/queue |

## Kriteria E1 selesai sebelum E2

- [ ] Audit otomatis dijalankan pada **Git HEAD terbaru** dan baseline disimpan.
- [ ] `gitHead`, `source checksum`, dan status dirty direkam; temuan scanner direview manual (AST bisa menemukan call site tetapi bukan runtime ownership penuh).
- [ ] Data R86-A/B/C/D dikumpulkan untuk minimal 1, 2, 3, 5 tab; perbedaan per kategori dicatat.
- [ ] Perbandingan Firebase Usage/read dilakukan terpisah dengan jendela pengukuran setara.
- [ ] Cleanup semua jalur prioritas tinggi dibuktikan dengan perpindahan menu/logout.
- [ ] Tidak ada gagal login, hilang draf, presensi ganda, notifikasi urgent hilang, atau error baru.
- [ ] Lint/build pada source lokal terbaru lulus; tidak ada perubahan runtime oleh E1.

**Kesimpulan E1:** rekomendasikan kandidat spesifik untuk E2 *hanya setelah* data di atas tersedia. Tidak ada optimasi listener yang aktif dalam paket E1.
