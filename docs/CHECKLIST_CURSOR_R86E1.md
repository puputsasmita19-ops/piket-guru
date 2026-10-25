# CHECKLIST CURSOR — R86-E1 Audit & Baseline Firestore Listener

## Persiapan
- [ ] Buka **checkout GitHub terbaru** di Cursor (jangan pakai arsip lama).
- [ ] GitHub Desktop → Fetch origin → Pull origin; catat branch dan HEAD.
- [ ] Pastikan R86-A/B/C/D telah dipasang, lint/build sebelumnya normal, dan working tree bersih.
- [ ] Ekstrak ZIP R86-E1 dengan path `scripts/` & `docs/` tetap asli.

## Audit statis (READ-ONLY)
- [ ] `node scripts/verify_r86e1_audit.cjs` → lulus semua.
- [ ] `node scripts/audit_r86e1_firestore_baseline.cjs --out artifacts/r86e1` → menghasilkan JSON dan MD.
- [ ] Review area: `firestoreService`, `sharedLiveSource`, `NotificationBell`, `notificationFeedService`, audit feed, auth, dashboard, laporan, pengaturan, jadwal, presensi, emergency.
- [ ] Pisahkan lokasi `onSnapshot` SDK, wrapper caller, one-shot reads dan Auth observer.
- [ ] Tandai setiap kemungkinan cleanup: `useEffect` return, `OfflineStorage.registerListener`, session teardown, error termination.
- [ ] Jangan menganggap `emissions` = document reads ditagihkan.

## Baseline runtime pada Vercel Preview
- [ ] VITE flags R86-A/B/C/D diaktifkan **hanya Preview**, semua query opt-in di URL.
- [ ] Snapshot R86-A/B/C/D per-tab pada 1,2,3,5 tab di browser yang sama.
- [ ] Uji navigasi menu serta foreground/background; lihat `opened/active/closed/emissions/errors`.
- [ ] Uji login, logout, session timeout, ganti akun, offline queue, presensi dan notifikasi memakai data uji.
- [ ] Catat Firebase Console Usage (billed reads) **terpisah** dari SDK callbacks.
- [ ] Input hasil ke template CSV dan tandai yang belum dites sebagai `BELUM DIUJI`.

## Release gate
- [ ] `npm run lint`, `npm run build`, dan tes regresi lama lulus.
- [ ] `git diff --check`; tidak ada perubahan di source aplikasi runtime / auth / queue / rules.
- [ ] Semua risiko draf offline, GPS, foto dan idempotensi presensi aman.
- [ ] Commit hanya file audit/docs bila memang diperlukan, Push manual via GitHub Desktop setelah review.
- [ ] Jangan lanjut R86-E2 sebelum bukti baseline cukup.

## Instruksi untuk Cursor Agent

> Tugasmu: lakukan R86-E1 **hanya audit** pada HEAD repo lokal terkini. Jalankan `scripts/audit_r86e1_firestore_baseline.cjs`, telaah hasil `artifacts/r86e1/baseline.md`, dan laporkan daftar listener prioritas tinggi, lifecycle/cleanup, status session safety, calon kandidat optimasi E2 serta bukti yang masih kurang. Jangan ubah `src/`, Auth, Firestore Rules, Web Locks, offline queue, PIN, presensi, draf atau PWA. Jangan klaim penghematan reads berdasarkan jumlah onSnapshot/emissions. Bila audit statis tidak cukup, tandai BELUM TERVERIFIKASI. Berikan hasil lint/build dan matriks pengujian aktual, jangan mengarang hasil.
