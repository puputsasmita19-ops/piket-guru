# R86-E2 — Checklist Eksekusi Cursor & GitHub Desktop

## Sebelum install

- [ ] Fetch origin → Pull origin pada branch benar, tanpa konflik.
- [ ] Catat commit HEAD dan lakukan checkpoint (`git status`).
- [ ] Audit E1 (`artifacts/r86e1/baseline.json` dan `baseline.md`) dari checkout terbaru sudah disimpan.
- [ ] R86-A sampai R86-D selesai, tanpa bug kritis. R86-C/D dipakai untuk observasi.
- [ ] Pastikan tidak sedang ada draf offline penting pada perangkat uji.

## Pemasangan

- [ ] Ekstrak ZIP incremental R86-E2 ke root repo, jangan menimpa seluruh repository.
- [ ] Jalankan `node scripts/apply_r86e2_safe.cjs` (dry-run).
- [ ] Jika muncul STOP, jangan memaksa pemasangan atau menyalin file dari snapshot lama.
- [ ] Jalankan `node scripts/apply_r86e2_safe.cjs --apply`.
- [ ] Jalankan `node scripts/verify_r86e2_controlled.cjs`.
- [ ] Jalankan `npm ci`, `npm run lint`, `npm run build`; semua wajib sukses.
- [ ] Tinjau `git diff`: hanya 1 file existing `ReportsPreview.tsx` yang berubah.
- [ ] GitHub Desktop Commit + Push hanya setelah semuanya lulus.

## Uji Preview R86-E2 (jangan Production)

- [ ] Konfigurasi Vercel Preview: `VITE_R86E2_REPORTS_PILOT=enabled` lalu redeploy.
- [ ] Di dua atau lebih tab Preview tambahkan parameter `?r86_e2_pilot=1` dan buka menu Laporan.
- [ ] Satu tab saja: tidak ada penghentian listener.
- [ ] Dua tab sama-sama terlihat: normal.
- [ ] Tab lama tersembunyi 2 menit dengan tab lain terlihat: uji 7 listener laporan dilepas setelah grace.
- [ ] Kembali ke tab lama: listener hidup lagi, loading selesai, data laporan dan periode benar.
- [ ] Ketika tab lain ditutup atau hilang: listener lama otomatis kembali jika terpasang.
- [ ] Ekspor Word/PDF, cetak, modal review foto, penyimpanan foto tetap berfungsi.
- [ ] Uji kembali data presensi, buku piket, notifikasi urgent, antrian offline, perangkat tepercaya/bersama, logout, PWA update.
- [ ] Bandingkan baseline 1/2/3/5 tab dan billed Firestore reads pada durasi setara; jangan samakan callback dengan billed reads.
- [ ] Tanpa flag dan query opt-in: tidak ada perubahan behavior.

## Rollback

- [ ] Nonaktifkan Vercel Preview environment flag kemudian rebuild.
- [ ] Jika terjadi regresi, jangan deploy Production; revert commit R86-E2. Jangan menghapus cache/IndexedDB.

**Kriteria lulus:** semua alur penting tetap berjalan, lifecycle listener tidak bocor, tidak ada draf hilang/duplikasi, perubahan beban terbukti bermanfaat. Jika belum ada metrik E1 dari HEAD, pilot tetap eksploratif dan tidak dapat disebut optimized produksi.
