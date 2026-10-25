# CURSOR AGENT — R86-E3 Checklist Eksekusi

Peran: Senior React/TypeScript Engineer Piket Guru. Source acuan: checkout GitHub terkini yang sudah memuat R86-A/B/C/D dan E1/E2.

## A. Integrasi aman

- [ ] Fetch origin → Pull origin; catat `git rev-parse HEAD` dan `git status`.
- [ ] Buat checkpoint; jangan overwrite `src/main.tsx` dengan snapshot lama.
- [ ] Ekstrak **hanya file baru** dari ZIP R86-E3 ke path repo asli.
- [ ] `node scripts/apply_r86e3_safe.cjs` (dry-run), pastikan PASS tanpa menulis file.
- [ ] `node scripts/apply_r86e3_safe.cjs --apply`, lalu jalankan kembali dan pastikan idempoten.
- [ ] Audit `git diff`: hanya blok opt-in R86-E3 pada `main.tsx`, tidak ada perubahan di AuthContext, FirestoreService, NotificationBell, ReportsPreview, atau offline queue.
- [ ] `npm ci` jika perlu; `node scripts/verify_r86e3.cjs`, `npm run lint`, `npm run build` lulus. Bila STOP/fail, **jangan Push**.

## B. Staging Performance Comparison

- [ ] Set Preview saja: R86-C/D/E3 audit flags dan R86-E2 pilot flag; rebuild.
- [ ] Gunakan akun dan data uji, jalur Laporan, satu build dan browser yang sama.
- [ ] Skenario 1 tab — baseline lalu pilot; simpan 2 JSON.
- [ ] Skenario 2 tab — baseline lalu pilot; simpan 4 JSON.
- [ ] Skenario 3 tab — baseline lalu pilot; simpan 6 JSON.
- [ ] Skenario 5 tab — baseline lalu pilot; simpan 10 JSON.
- [ ] Tab tersembunyi >= 4 menit pada setiap run; semua tab memakai parameter URL yang sesuai.
- [ ] Jalankan CLI pembanding; periksa `INCOMPLETE`, `REVIEW_WARNINGS` dan file ditolak.
- [ ] Cocokkan snapshot R86-C/D dengan hasil E3; jangan menganggap callback sebagai billed reads.

## C. Regression & keputusan

- [ ] Tab lama kembali aktif dengan data Laporan terbaru.
- [ ] Filter periode dan UI tidak salah reset.
- [ ] Ekspor, cetak, review foto aman selama status background.
- [ ] Login dan timeout perangkat pribadi/bersama aman.
- [ ] Presensi masuk/pulang dan buku piket tidak terduplikasi.
- [ ] Offline queue, draf dan foto tidak hilang.
- [ ] Notifikasi dan PWA update masih normal.
- [ ] Bandingkan usage reads Firebase melalui interval uji yang sebanding.
- [ ] Isi dokumen laporan staging dan putuskan GO/NO-GO secara manual.

**Larangan:** ubah hak akses, autentikasi, Firestore Rules, struktur data, token, listener penting, sistem presensi, offline queue, atau perintah commit/push otomatis. Jangan klaim savings jika belum ada bukti usage.
