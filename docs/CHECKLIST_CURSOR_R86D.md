# CHECKLIST EKSEKUSI CURSOR — R86-D

## A. Source & pengamanan
- [ ] GitHub Desktop: Fetch origin → Pull origin. Catat HEAD/branch/commit.
- [ ] R86-A, R86-B dan R86-C sudah diterapkan pada source aktual.
- [ ] Working tree bersih, checkpoint dibuat.
- [ ] Ekstrak R86-D hanya file baru dengan struktur path aslinya.
- [ ] `node scripts/apply_r86d_safe.cjs` (DRY RUN); STOP = perlu review, jangan lanjut.
- [ ] `node scripts/apply_r86d_safe.cjs --apply` (hanya `src/main.tsx`).
- [ ] Diff hanya menambah blok opt-in R86-D; tidak mengedit AuthContext, backgroundSession, queue, Firebase Rules, PWA, presensi, GPS/selfie, notifikasi.

## B. Pengujian otomatis
- [ ] `node scripts/verify_r86d_stability.cjs`
- [ ] `node scripts/verify_r86d_installer.cjs`
- [ ] `node scripts/verify_r86c_safe.cjs`
- [ ] `node scripts/verify_r86b_safe.cjs`
- [ ] `node scripts/verify_r86a_multitab.cjs`
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Tidak ada bypass TS, TS-ignore, perubahan permission, atau error Console.

## C. Pengujian Vercel Preview
- [ ] Aktifkan `VITE_R86_STABILITY_AUDIT=enabled` pada **Preview**, bukan Production; rebuild.
- [ ] Untuk statistik R86-A/B/C aktifkan pula flag Preview yang sesuai.
- [ ] Buka URL Preview dengan `?r86_audit=1&r86_tab_opt=1&r86_listener_audit=1&r86_stability_audit=1`.
- [ ] `window.__PIKET_R86D__?.snapshot()` mengembalikan `version: R86-D`.
- [ ] Uji 1, 2, 3, 5 tab; pindah hidden/visible, close/reopen, BFCache, offline/online.
- [ ] Bandingkan sebelum/sesudah: heap (jika tersedia), navigation timings, jumlah callback SDK per tab, dan metrik Firebase resmi.
- [ ] Akun uji tepercaya: session recovery dalam batas kebijakan tetap benar.
- [ ] Akun uji perangkat bersama: logout/background policy tetap benar.
- [ ] Revokasi akses, logout eksplisit, dan perbedaan akun antartab tidak meloloskan autentikasi.
- [ ] Presensi masuk/pulang tidak dobel.
- [ ] Foto, buku piket, draft dan antrean offline aman.
- [ ] Notifikasi dan PWA update aman.
- [ ] Isi laporan staging di `docs/R86D_STAGING_TEST_REPORT_TEMPLATE.md`.

## D. Gate
- [ ] Jika ada pengujian gagal/belum dilakukan, jangan mengklaim R86-D siap produksi.
- [ ] Jika semua lulus di staging, Commit/Push manual via GitHub Desktop; pantau Vercel dan rollback jika perlu.
- [ ] Tidak menerapkan pengurangan listener Firestore lintas tab sebelum ada pengukuran R86-D yang membuktikan bagian aman.

**Aturan Cursor:** R86-D ini instrumentation & validation saja. Jangan memaksa logout, menutup tab, menghapus IndexedDB, menghentikan sync queue, mengubah pemeriksaan sesi, mengirim isi laporan ke server, ataupun menyisipkan analytics pihak ketiga. Flag audit harus mati secara default.
