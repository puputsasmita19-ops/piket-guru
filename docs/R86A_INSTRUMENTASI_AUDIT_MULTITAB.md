# Piket Guru R86-A — Instrumentasi & Audit Multi-Tab (observasi saja)

**Tanggal:** 25 Oktober 2026  
**Status:** Paket awal R86-A siap untuk **review dan uji staging**, bukan sertifikasi HEAD produksi.  
**Basis sumber yang diaudit:** arsip Piket Guru dari percakapan, dengan pembaruan R85 yang tersedia; **belum terhubung langsung ke HEAD GitHub**. Akses GitHub langsung dari lingkungan pembuat gagal (DNS); arsip tidak mempunyai `.git`. Jangan menyamakan snapshot ini dengan commit produksi.

## Mengapa pemasangan berbasis skrip, bukan menimpa `main.tsx`?

`src/main.tsx` di GitHub bisa sudah berbeda. Agar tidak menimpa source baru, ZIP hanya membawa **modul diagnostic baru** dan skrip `scripts/apply_r86a_safe.cjs` untuk menyisipkan satu blok impor dinamis ke bootstrap **aktual milik Anda**. Skrip mengenali pola root lama, melakukan pemeriksaan sebelum mengedit, dan menolak tanpa modifikasi bila polanya berubah. **Commit dan push tidak otomatis dilakukan.**

## Audit source pendahuluan

Pada snapshot yang tersedia, skrip `audit_multitab_r86a.cjs` menemukan **14/15** indikator. Yang belum ditemukan adalah `src/services/offline/pwaUpdateSafety.ts` (tersedia pada patch R75, tetapi tidak ada dalam snapshot dasar audit ini). Ini **bukan bukti bahwa file absen dari GitHub sekarang**. Source statis terdiri atas sekitar 424 berkas TS/TSX, dengan beberapa pemanggilan `subscribeToCollection`, `subscribeToDocument`, dan `onSnapshot`; angka call-site **bukan** jumlah listener aktif atau jumlah Firestore reads.

Temuan struktural:

- `src/services/offline/syncQueueService.ts`: Web Locks, validasi owner, idempotensi kiriman. **Tidak dimodifikasi.**
- `src/services/offline/offlineStorage.ts`: lease IndexedDB dan perbedaan trusted/untrusted device. **Tidak dimodifikasi.**
- `src/hooks/useAutomaticSync.ts`: sync terjadwal dan pemeriksaan tab tersembunyi. **Tidak dimodifikasi.**
- `src/contexts/AuthContext.tsx`, `src/services/auth/backgroundSession.ts`: verifikasi sesi dan kebijakan background. **Tidak dimodifikasi.**
- `src/features/dashboard/DashboardView.tsx`: banyak subscriber dan kebutuhan tampil realtime. **Tidak dimodifikasi.**
- `src/services/notifications/notificationFeedService.ts`, `src/components/layout/NotificationBell.tsx`: sumber realtime dan notifikasi. **Tidak dimodifikasi.**
- `src/services/firebase/sharedLiveSource.ts`: berbagi sumber dalam **tab yang sama**, belum mengoordinasikan browser tab lain. **Tidak dimodifikasi.**

## Isi instrumentasi baru

`src/services/diagnostics/r86TabAudit.ts` hanya mengamati:

- Visibility (`visible` / `hidden`), `focus`, `blur`, `online`, `offline`, `pagehide`, `pageshow`.
- Tab lain **yang juga mengaktifkan audit** pada origin sama, menggunakan `BroadcastChannel`. Hanya ID acak sementara dan status terlihat; tidak ada UID, NIP, role, nama, token, PIN, atau payload.
- Total tab terdeteksi, tab terlihat, dan hitungan event lokal; **bukan** akun, jumlah browser secara keseluruhan, dan bukan penentu tab yang diizinkan menyimpan data.
- Pembersihan event listener dan interval ketika audit berhenti; `pagehide/pageshow` mempertimbangkan BFCache.

**Sengaja tidak dibaca:** Firestore, isi dokumen, listener aktif, draft, antrean offline, localStorage, IndexedDB, payload foto, dan session token. Statusnya muncul sebagai `NOT_INSTRUMENTED`/`NOT_READ`. Ini fase A; pengukuran listener aktif/Firestore reads dan keputusan efisiensi perlu fase terpisah dengan instrumen terverifikasi.

## Keamanan & aktivasi (default OFF)

Bootstrap hanya memuat kode audit jika kondisi **keduanya** terpenuhi:

1. `import.meta.env.DEV` benar (Vite lokal), **atau** environment variabel **staging** `VITE_R86_AUDIT=enabled` diaktifkan saat build;
2. URL memiliki query `?r86_audit=1` (sebelum `#` untuk rute berbasis hash).

Jangan mengaktifkan `VITE_R86_AUDIT` di deployment produksi umum. Pada build produksi biasa instrumentasi tidak diaktifkan, bahkan jika link memiliki query audit. Tidak ada tulisan ke server atau cache, sehingga diagnosis perlu dicatat manual melalui Console di browser penguji.

## Checklist pemasangan pada HEAD GitHub lokal

1. GitHub Desktop: **Fetch/Pull origin** pada repo `piket-guru`, pastikan **main/branch yang benar** dan Changes bersih; buat checkpoint commit/tag sebelum patch.
2. Ekstrak ZIP R86-A **ke root repo**. Isinya file **baru** saja, tidak mengandung `src/main.tsx` lama.
3. Jalankan `node scripts/apply_r86a_safe.cjs` (**dry-run**, tanpa modifikasi). Harus menunjukkan bahwa patch dapat dipasang.
4. Jalankan `node scripts/apply_r86a_safe.cjs --apply` untuk menyisipkan blok kecil di `src/main.tsx` saat ini. Jika `STOP`, jangan copy `main.tsx` dari arsip lama; cek source aktual di Cursor.
5. Jalankan:

```bash
node scripts/audit_multitab_r86a.cjs
node scripts/verify_r86a_multitab.cjs
npm ci
npm run lint
npm run build
```

6. Tinjau diff: file baru di `src/services/diagnostics/`, `scripts/`, `docs/`, plus satu blok tambahan di `src/main.tsx`; **tidak** boleh ada modifikasi auth, sync engine, Firestore rules, sw.js, Firebase, foto, atau notifikasi.
7. Jika pemeriksaan berhasil, lakukan Commit/Push **manual**. Mulai uji dengan Vite dev atau **staging terpisah**, bukan mengaktifkan flag pada produksi.

## Panduan pengamatan di browser (dev/staging)

**Local dev:** `http://localhost:5173/?r86_audit=1` (sesuaikan port Vite).  
**Staging khusus:** set environment `VITE_R86_AUDIT=enabled` pada deployment Preview, lalu buka `https://<preview-domain>/?r86_audit=1`.

Buka DevTools → Console, jalankan:

```js
window.__PIKET_R86_AUDIT__?.snapshot()
```

Contoh nama field (bukan hasil produksi): `visibility`, `observedPeers`, `observedVisiblePeers`, `counts.visibilityChanges`, `counts.pageShowEvents`. Untuk menghentikan audit di tab itu **tanpa logout aplikasi**:

```js
window.__PIKET_R86_AUDIT__?.stop()
```

**Catatan:** jumlah `observedPeers` hanya menghitung tab yang mengaktifkan audit pada origin sama. Browser/OS boleh menunda timer pada tab tersembunyi; peer kadaluarsa setelah 90 detik sehingga angka ini estimasi. Tidak dipakai untuk keamanan/leader election.

## Matriks uji staging — hasil masih kosong

| Uji | Yang diamati | Kriteria | Hasil |
|---|---|---|---|
| 1 tab | counters + login | Normal, tak menambah request backend | **Belum diuji pada staging** |
| 2 tab akun sama | observedPeers dan foreground | Tidak ada pengambilalihan data | **Belum diuji** |
| 3 & 5 tab | resource browser/network | Bandingkan baseline manual, jangan klaim penghematan sebelum diukur | **Belum diuji** |
| 2 tab akun berbeda | sesi dan hak akses | Tidak ada transfer token/identitas melalui kanal audit | **Belum diuji** |
| Offline + draf/foto | local queue dan kembali ke tab | Operasi tetap mengikuti logika R57/R75 dan lebih baru | **Belum diuji** |
| Presensi masuk/pulang | penulisan idempoten | Tidak menambah submission akibat audit | **Belum diuji** |
| PWA update | update safety | Tidak mengubah alur update | **Belum diuji** |
| Hide/restore/BFCache | lifecycle counts | Observer tetap aman; tidak duplikasi handler | **Belum diuji** |
| Staging tanpa flag/URL | diag object | Object audit tidak dibuat | **Belum diuji** |

## Hasil pengujian pembuat patch

- Simulasi Node VM lintas konteks: **11/11 PASS** (detection, event counts, bfcache simulation, stop, fallback, sanitasi payload).
- Installer: dry-run tidak menulis, pemasangan idempoten, source tak dikenal ditolak tanpa menimpa file: **PASS**.
- `tsc --noEmit` **untuk modul diagnostik mandiri**: PASS.
- Audit statis: **14/15** indikator ditemukan pada snapshot, satu perlu diperiksa di HEAD.
- Simulasi Chromium dua halaman nyata: **tidak dapat dijalankan** karena jaringan browser lokal diblokir oleh kebijakan lingkungan, bukan bukti kegagalan kode.
- `npm ci --offline`: gagal `ENOTCACHED yargs-parser@21.1.1`; lint penuh terhenti; build gagal karena `vite` tidak terinstal. **Build proyek belum diverifikasi.**

## Rencana R86-B setelah data tersedia

Analisis dulu pengukuran dari staging sebelum mempertimbangkan optimasi notifikasi atau timer. Jangan implementasikan automatic tab-leader, pemindahan draf antartab, pemutusan listener keamanan, atau penutupan otomatis tab dalam R86-A.
