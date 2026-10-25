# PIKET GURU R86-C — Safe Multi-Tab Listener & Notification Optimization

**Status:** patch incremental opt-in untuk development/staging **setelah R86-A dan R86-B**. Tidak langsung mengurangi listener lintas tab. **Belum terverifikasi terhadap HEAD GitHub produksi maupun build lengkap**, sehingga pengguna wajib melakukan diff dan pengujian di checkout GitHub yang sudah diperbarui.

## Sasaran dan batas aman

R86-C menyediakan instrumentasi jumlah **pendaftaran listener SDK dalam tab ini** dan callback realtime pada bagian yang dipilih, agar pengambilan keputusan R86-D berdasarkan hasil pengukuran. Selain itu, R86-C menghentikan hanya timer pembaruan *jam kedaluwarsa daftar notifikasi* saat halaman tersembunyi, dan memulihkannya begitu halaman terlihat. Langkah ini menghindari React re-render tiap 60 detik pada tab background dengan flag R86-C aktif.

R86-C **tidak**:
- memutus / menunda listener Firestore;
- mencegah notifikasi masuk, event darurat, atau flush `notificationOutbox`;
- mencegah proses presensi, GPS, selfie, cetak, atau rekam buku piket;
- mengubah sign-in, session policy, background session, trusted device;
- mengganti mekanisme `sharedLiveSource` atau Web Locks/lease IndexedDB;
- memilih satu tab yang boleh membaca data, memaksa logout, menutup tab, atau menghapus data;
- mengirim informasi UID, NIP, PIN, role, foto, isi dokumen, atau daftar notifikasi ke BroadcastChannel/Firestore/log.

## Temuan audit atas snapshot source yang tersedia

- `FirestoreService.subscribeToCollection` dan `subscribeToDocument` memanggil `sharedLiveSource`, sehingga listener identik **di dalam tab yang sama** telah berbagi subscription. Jangan mengganti atau menambah caching naif.
- `notificationFeedService.subscribeNotificationFeed` memanggil sampai empat listener berdasarkan konfigurasi: event sesi, event sekolah, pengumuman berdasar `createdAt`, dan pengumuman berdasar `updatedAt`. Kedua query pengumuman diperlukan untuk informasi lama yang diedit.
- `NotificationBell` memiliki timer 60 detik untuk kedaluwarsa tampilan. Itu tidak sama dengan listener Firestore maupun pengiriman notifikasi; hanya timer ini yang dibuat berhenti saat hidden.
- Jalur `auditHistoryService` dan `auditLogFeedService` memiliki pemanggilan `onSnapshot` tambahan yang **belum dihitung** oleh R86-C. Beberapa metode Firestore lain juga mungkin berlangganan lewat jalur berbeda. **Snapshot R86-C bukan total semua listener.**
- `onSnapshot` dengan `includeMetadataChanges: true` dapat memanggil callback untuk perubahan metadata. Angka `emissions` **bukan dokumen yang diunduh atau read yang ditagihkan**.

## File di dalam ZIP (semuanya file baru)

1. `src/services/diagnostics/r86cListenerMetrics.ts` — modul diagnosis aman, tanpa Firebase dan tanpa data pengguna.
2. `scripts/apply_r86c_safe.cjs` — pemasang **dry-run** secara default, berhenti sebelum menulis bila anchor tidak cocok.
3. `scripts/verify_r86c_safe.cjs` — pemeriksaan 21 skenario kode, parsing TS/TSX, dan lifecycle penghitung listener.
4. `scripts/verify_r86c_installer.cjs` — pemeriksaan 6 skenario pemasang.
5. `docs/R86C_SAFE_MULTITAB_LISTENER_NOTIFICATION.md` — laporan dan cara kerja ini.
6. `docs/CHECKLIST_CURSOR_R86C.md` — checklist instalasi/pemeriksaan.

**Pemasang akan memodifikasi tepat empat file pada checkout lokal Anda:**
- `src/main.tsx`: import ringan dan aktivasi audit sebelum React mount, dengan dua syarat (DEV/Preview environment yang mengaktifkan audit **dan** query `?r86_listener_audit=1`).
- `src/services/firebase/firestoreService.ts`: bungkus fungsi *unsubscribe* hanya pada dua jalur shared collection/document, serta catat callback secara opsional.
- `src/services/notifications/notificationFeedService.ts`: bungkus unsubscribe pada listener event dan pengumuman dan catat callback secara opsional.
- `src/components/layout/NotificationBell.tsx`: jeda hanya timer UI notifikasi 60 detik ketika tab tersembunyi dan audit aktif; pulihkan timer ketika visible. Data live, notifikasi, `flushNotificationOutbox` tetap berjalan seperti semula.

Perubahan wrapper tetap terpasang di kode setelah build meski flag OFF, tetapi pencacahan hanya aktif pada audit; setiap wrapper tetap meneruskan unsubscribe SDK tepat satu kali.

## Instalasi pada checkout GitHub terbaru

1. **GitHub Desktop → Fetch origin → Pull origin**; pastikan R86-A/B sudah terpasang, lint/build terakhir normal, dan working tree bersih. Cadangkan checkpoint commit.
2. Ekstrak ZIP ke root `piket-guru`. **Jangan menimpa file source lain dari arsip lama.**
3. Dari terminal di root project jalankan:

```sh
node scripts/apply_r86c_safe.cjs             # dry-run, tidak menulis
node scripts/apply_r86c_safe.cjs --apply     # menulis hanya saat semua anchor cocok
node scripts/verify_r86c_safe.cjs
node scripts/verify_r86c_installer.cjs
node scripts/verify_r86b_safe.cjs
node scripts/verify_r86b_installer.cjs
node scripts/verify_r86a_multitab.cjs
npm ci
npm run lint
npm run build
```

4. Jika keluaran **STOP R86-C**: **jangan paksa**, dan jangan ganti `src/main.tsx` dari snapshot lama; periksa diff yang tidak cocok di Cursor.
5. `git diff --check` lalu periksa perubahan hanya pada 4 source beserta 6 file baru. Tidak boleh ada perubahan pada queue, auth, rules, model data, kamera, presensi, dan PWA.
6. Jika tes lint/build gagal, hentikan deployment dan kirim log. Push manual hanya setelah staging lolos.

## Aktivasi dan inspeksi tanpa data sensitif

- Vite development: `http://localhost:5173/?r86_listener_audit=1`
- Preview Vercel: tetapkan `VITE_R86_LISTENER_AUDIT=enabled` pada **Preview saja**, rebuild deployment lalu akses `https://<preview-deployment>/?r86_listener_audit=1`.
- **Jangan mengaktifkan flag R86-C di Production untuk seluruh guru.**
- Bisa dikombinasikan dengan R86-A/B pada URL: `?r86_audit=1&r86_tab_opt=1&r86_listener_audit=1` selama semua flag Preview diaktifkan.

DevTools → Console pada **masing-masing tab**:

```js
window.__PIKET_R86C__?.snapshot()
window.__PIKET_R86B__?.snapshot() // jika R86-B diaktifkan
window.__PIKET_R86_AUDIT__?.snapshot() // jika R86-A diaktifkan
```

Interpretasi `counters[category]`:
- `opened`: jumlah pemanggilan subscribe SDK yang terinstrumentasi sejak audit hidup;
- `active`: total unsubscribe wrapper yang masih belum dipanggil (bukan unique network stream);
- `closed`: stop SDK yang dicatat;
- `emissions`: jumlah callback data/metadata yang diamati, **bukan read Firebase**;
- `errors`: callback error SDK;
- `sampledAt`, `hidden` hanya metadata lokal.

Untuk menghentikan pengukuran di satu tab: `window.__PIKET_R86C__?.stop()`, kemudian muat ulang tab untuk kembali mengukur secara utuh. Menghentikan pengukuran **tidak** memutus listener yang sudah ada.

## Matriks pengujian staging — harus dipenuhi sebelum Push produksi

- 1, 2, 3 dan 5 tab: catat `active`, `opened`, `closed`, `emissions`, status visible/hidden dari tiap tab sebelum dan sesudah navigasi.
- Pindah tab selama >60 detik lalu kembali: timer visual berhenti ketika hidden; badge dan isi notifikasi tetap segar setelah visible; tidak kehilangan notifikasi urgent.
- Uji baca dan tandai notifikasi dari dua tab: readState sinkron sesuai baseline, tidak menimbulkan update ganda yang merusak status.
- Logout dan login akun lain: listener lama berhenti melalui pengaman yang sudah ada; R86-C tidak merekam identitas.
- Presensi masuk/pulang + GPS/selfie tetap sukses dan tidak ganda; data harus terkonfirmasi server.
- Form buku piket, dokumentasi foto, draft offline pada perangkat tepercaya dan perangkat bersama; offline ke online + antartab.
- Firestore permission-denied dan perubahan jaringan: error handling tetap terlihat; tidak diubah atau disembunyikan.
- PWA update dengan draf tertunda: tidak menghapus cache atau antrean.
- Bandingkan baseline dan audit dengan Chrome Performance dan Firebase Usage/read metrics untuk melihat pengaruh sebenarnya. Jangan menyimpulkan penghematan billable reads dari `emissions` saja.

## Hasil verifikasi di lingkungan pengemas

- R86-C 21/21 pemeriksaan kode dan simulasi lifecycle lulus.
- Installer R86-C 6/6 (dry-run, idempoten, precondition R86-B, drift source, partial installation) lulus.
- Regresi R86-B 20/20, installer R86-B 5/5, dan R86-A 11/11 lulus terhadap snapshot lokal.
- `npm ci --offline` gagal pada `yargs-parser@21.1.1` karena tidak tersimpan pada cache lingkungan; **lint/build keseluruhan aplikasi belum terverifikasi**.
- HEAD GitHub produksi saat ini tidak terhubung langsung; pemasang memakai exact anchors dan akan berhenti bila source sudah berbeda.
- Belum ada validasi Firebase nyata dan perangkat pengguna. Tidak mengklaim penghematan Firestore.

## Rollback

Simpan diff/commit checkpoint. Hilangkan patch R86-C **saja** dari empat file hasil pemasang dan hapus enam file baru pada commit ini, atau revert commit R86-C apabila dipisah tersendiri. Biarkan R86-A/B, Auth, antrean, IndexedDB, dan data browser tidak berubah. Pada Preview, hapus parameter URL `r86_listener_audit=1` atau nonaktifkan env flag lalu redeploy untuk mematikan instrumentasi.

## Rencana R86-D (setelah data staging diperoleh)

Baru setelah terbukti ada sumber pemborosan dan jalur data yang aman, pilih satu listener nonkritis untuk uji `pause/resume` terkontrol, dengan refresh on-resume, guard sesi, dan fallback offline. Notifikasi penting dan transaksi tidak ikut dipasifkan. Jangan mengimplementasikan pengambilalihan lintas tab hanya dari indikator visible/hidden.
