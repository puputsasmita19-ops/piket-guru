# Piket Guru R86-D — Multi-Tab Stability, Session Recovery & Performance Validation

**Basis:** R86-A + R86-B + R86-C yang telah diterapkan. **Tipe rilis:** paket instrumentasi/validasi yang mati secara default, **bukan** perubahan kebijakan login atau antrean offline. Source acuan berasal dari snapshot lokal setelah R86-C, **bukan HEAD GitHub produksi yang sudah dikonfirmasi**. Pemasang R86-D menambahkan hanya satu blok pada `src/main.tsx` checkout Anda, dan berhenti jika strukturnya berbeda.

## Alasan dan batas keamanan

Dari source yang tersedia:
- `AuthContext.tsx` telah menggunakan `onAuthStateChanged`, `validateFirebaseUserProfile` dan `sessionEpochRef` untuk mencegah hasil validasi usang mengambil alih sesi. Ketika koneksi pulih, `revalidateSessionOnline` memvalidasi profil dan dapat memicu sinkronisasi antrean.
- `backgroundSession.ts` sudah memeriksa batas waktu background saat `visibilitychange`, `pageshow` (termasuk BFCache), `focus`, dan initial restore. Ia dapat memaksa kembali login sesuai pengaturan Admin, kecuali pengecualian terbatas seperti file picker dan print.
- R86-A/B/C telah mengamati tab lain dan sebagian listener notifikasi secara opt-in.

**Keputusan R86-D:** jangan menambahkan autentikasi otomatis atau mengubah alur sesi. Sebagai gantinya, instrumentasi read-only mencatat ketika tab kembali, lama tersembunyi, apakah BFCache dipakai, online/offline, serta indikator performa yang disediakan browser. Pengujian berikutnya harus mengamati aplikasi aktual di Preview, khususnya apakah pemulihan sesi tetap mematuhi kebijakan Admin.

Tidak ada akses data atau perubahan ke: AuthContext, backgroundSession, `syncQueueService`, IndexedDB, presensi, foto, PWA, Firebase Auth/Firestore Rules, notifikasi, atau API server. Tidak ada sinkronisasi/deteksi leader tab baru. Tidak ada data pengguna, ID akun, PIN, token, foto, dokumen, draft atau isi notifikasi yang diambil.

## Isi ZIP incremental

- `src/services/diagnostics/r86dStabilityProbe.ts`: probe halaman read-only; tidak aktif sampai dinyalakan.
- `scripts/apply_r86d_safe.cjs`: pemasang fail-closed; dry-run default, `--apply` menambahkan blok opt-in ke `src/main.tsx` saja.
- `scripts/verify_r86d_stability.cjs`: 40 pemeriksaan kode, lifecycle, simulasi dan invariants sesi.
- `scripts/verify_r86d_installer.cjs`: 7 pemeriksaan pemasang dry-run, idempotensi, dan penolakan source yang berubah.
- `docs/R86D_STABILITY_SESSION_PERFORMANCE.md`: dokumen ini.
- `docs/CHECKLIST_CURSOR_R86D.md`: checklist eksekusi.
- `docs/R86D_STAGING_TEST_REPORT_TEMPLATE.md`: template bukti pengujian staging.

## Pemasangan aman (setelah R86-C)

1. GitHub Desktop: Fetch origin → Pull origin. Periksa branch/commit, working tree bersih dan semua patch R86-A/B/C sudah lulus. Buat checkpoint commit/backup.
2. Ekstrak seluruh isi ZIP dengan struktur `src/`, `scripts/`, `docs/` tetap asli pada root repository.
3. Jalankan dry-run dan pemasang:

```bash
node scripts/apply_r86d_safe.cjs
node scripts/apply_r86d_safe.cjs --apply
node scripts/verify_r86d_stability.cjs
node scripts/verify_r86d_installer.cjs
node scripts/verify_r86c_safe.cjs
node scripts/verify_r86b_safe.cjs
node scripts/verify_r86a_multitab.cjs
npm ci
npm run lint
npm run build
git diff --check
```

4. Bila muncul `STOP R86-D`, jangan memaksa patch atau menimpa `src/main.tsx` dengan file snapshot lama. Audit anchor dengan Cursor.
5. Periksa diff: hanya `src/main.tsx` yang berubah dalam source existing, plus 7 file baru di atas. Jika perubahan menyentuh Auth/Firestore/data, hentikan proses dan periksa.
6. **Push secara manual hanya setelah lint/build lulus dan uji Preview lulus**. Semua flag audit tetap OFF di produksi normal.

## Aktivasi khusus development / Vercel Preview

Pada localhost Vite:

`http://localhost:5173/?r86_audit=1&r86_tab_opt=1&r86_listener_audit=1&r86_stability_audit=1`

Pada Vercel **Preview saja**, tetapkan `VITE_R86_AUDIT=enabled`, `VITE_R86_TAB_OPT=enabled`, `VITE_R86_LISTENER_AUDIT=enabled`, dan `VITE_R86_STABILITY_AUDIT=enabled`, lalu rebuild deployment Preview. Jangan menyalin pengaturan ini ke Production. Akses URL Preview dengan keempat query flag yang sama.

DevTools → Console di **setiap tab**:

```js
window.__PIKET_R86D__?.snapshot()
window.__PIKET_R86D__?.report() // JSON tekstual; salin secara manual jika diperlukan
window.__PIKET_R86_AUDIT__?.snapshot()
window.__PIKET_R86B__?.snapshot()
window.__PIKET_R86C__?.snapshot()
```

Bila DevTools mendukung helper `copy`, gunakan `copy(window.__PIKET_R86D__?.report())`. Periksa laporan sebelum dibagikan meskipun modul hanya berisi agregat. Jangan merekam tangkapan layar yang menampilkan nama, NIP, wajah siswa atau data sekolah nyata. Gunakan akun uji dan data dummy di staging.

## Membaca metrik

| Kunci | Arti | Catatan |
|---|---|---|
| `counts.visibilityChanges` | jumlah event perubahan visibility | tidak sama dengan jumlah tab |
| `counts.hiddenEpisodes` | episode tab menjadi hidden | dimulai saat tab di-background atau pagehide |
| `counts.resumes` | episode hidden yang berakhir ketika terlihat | event pageshow + visibilitychange beruntun dihitung satu kali |
| `lastHiddenDurationMs` | durasi background episode terakhir | berdasarkan Date.now, bukan timer interval |
| `backgroundThresholdExceeded` | episode >= 60 detik | **bukan** indikator sesi harus logout; kebijakan Admin tetap otoritas |
| `counts.bfcacheRestores` | pageshow dengan `persisted=true` | tidak berarti sesi berhasil divalidasi |
| `navigation` | durasi event navigasi dari Performance API | bukan metrik Firebase, dan tidak selalu tersedia |
| `heapBytes` | perkiraan used JS heap dari `performance.memory` bila ada | Chromium-specific / indikatif; bisa `UNAVAILABLE` |
| `r86a`, `r86b`, `r86cCounters` | subset agregat alat tahap sebelumnya | `null` jika probe lain tidak diaktifkan; hitungan callback bukan billed reads |
| `doesNotCheckSessionValidity=true` | batas audit R86-D | validasi sesungguhnya harus diuji pada alur autentikasi aplikasi |

**Tidak** mengukur GPU/rendering cost, Firebase billed reads, atau memory seluruh browser/tab di latar. Jangan menyamakan `opened`/`emissions` SDK dengan biaya Firebase. Gunakan Firebase Usage/Billing dan Chrome Performance/Memory untuk angka nyata; catat metode pembandingan dan jam pengujian.

## Matriks uji staging wajib

1. **Tab 1/2/3/5:** setiap tab memakai URL Preview sama; rekam R86-A peers, R86-B visualQuiet, R86-C listener counters, R86-D hidden episodes. Reaktifkan tiap tab dan periksa data terbaru.
2. **Sesi perangkat tepercaya:** login sekali, tinggalkan tanpa logout, buka tautan lagi; pada durasi singkat yang tidak melebihi kebijakan, hasil harus sesuai konfigurasi sesi; saat melebihi batas Admin, wajib diminta login kembali. Ini tidak boleh diakali R86-D.
3. **Sesi perangkat bersama:** login, pindah tab, tutup browser, buka lagi; harus mengikuti aturan autentikasi dan data offline perangkat bersama yang berlaku.
4. **Presensi:** lakukan masuk/pulang pada akun uji dengan tab ganda; pastikan setiap transaksi dicatat sesuai aturan dan **tidak ada pengiriman ulang** akibat probe.
5. **Buku piket, dokumentasi/foto, dan draf:** buat draf di tab 1, buka tab 2, pindah halaman dan uji background. Pastikan draf tidak hilang. Jangan memakai data siswa asli.
6. **Offline queue:** putus koneksi, simpan transaksi uji, buka tab tambahan, sambungkan kembali, pastikan Web Locks/lease dan idempotensi tetap benar serta tidak ada duplikasi.
7. **Notifikasi:** uji pengumuman baru/diubah, tanda dibaca, pesan urgent. Bandingkan 1/2/3/5 tab untuk notifikasi ganda. Probe R86-D tidak menekan notification delivery.
8. **Session revoked / logout / Firebase error:** admin cabut akses akun uji, logout dari satu tab, uji token/state yang tidak lagi valid; tetap memerlukan validasi backend yang benar.
9. **PWA dan BFCache:** jalankan pembaruan PWA yang aman sambil menahan draf offline, navigasi dan kembali. Jangan menghapus cache/IndexedDB untuk membuat tes lulus.
10. **Performa:** bandingkan baseline sebelum dan setelah R86-D pada device, jaringan, dan skenario yang sama. Bila perlu ukur memori lewat Chrome Task Manager (per-tab), buka Performance panel, dan Firebase dashboard untuk reads terhitung.

**Gate:** lint/build lulus, tidak ada perubahan pada auth/queue, tidak ada kehilangan/double submit, UI kembali segar, sesi obey policy, dan tidak ada error baru. Bila belum terverifikasi, catat `BELUM DIUJI` dalam template laporan, bukan `LULUS`.

## Hasil pengujian lingkungan pengemas

- R86-D static/runtime simulation: **40/40 PASS** di snapshot gabungan R86-A/B/C.
- Installer: **7/7 PASS** dengan dry-run, idempotensi, dan fail-closed.
- Chromium headless dua halaman: **5/5 PASS** untuk keterpisahan agregat lifecycle dan penghentian probe secara independen; visibility/BFCache merupakan **event simulasi**, bukan pengujian autentikasi produksi.
- `npm ci`/lint/build penuh aplikasi serta pengujian multi-tab Firebase nyata belum terverifikasi; source produksi GitHub terbaru belum bisa dicocokkan langsung.

## Rollback

Nonaktifkan flag URL atau Preview environment dan redeploy: probe tidak akan berjalan. Untuk rollback kode, revert satu commit R86-D atau hapus blok bertanda `R86-D` dari `src/main.tsx` dan tujuh file baru R86-D. Jangan menghapus Auth, antrean, IndexedDB, cache/offline siswa, atau patch R86-A/B/C.
