# Piket Guru R86-E3 — Petunjuk singkat

1. Setelah R86-E2 diterapkan, ekstrak isi ZIP ini ke root checkout GitHub.
2. `npm ci` apabila dependencies belum terpasang.
3. `node scripts/apply_r86e3_safe.cjs` (dry-run) → `node scripts/apply_r86e3_safe.cjs --apply`.
4. `node scripts/verify_r86e3.cjs`, `npm run lint`, `npm run build`.
5. Deployment **Preview** dengan flag R86-C/D/E3/E2 (lihat docs lengkap).
6. Dua seri pengujian: baseline tanpa URL `r86_e2_pilot=1`, dan pilot dengan URL itu. 1/2/3/5 tab, 4–5 menit per seri.
7. Ekspor dari DevTools `window.__PIKET_R86E3__?.download()` di setiap tab setelah `.begin(...)`.
8. Simpan JSON ke `artifacts/r86e3/raw/`, lalu `node scripts/compare_r86e3.cjs --input artifacts/r86e3/raw --out artifacts/r86e3/results`.
9. Review `summary.md` + validasi manual dan Firebase Usage. **Jangan nyalakan pilot di Production dulu.**

Baca: `docs/R86E3_PERFORMANCE_COMPARISON.md` dan `docs/CHECKLIST_CURSOR_R86E3.md` untuk detail.

Status: instrumen siap untuk staging; **belum ada hasil Firebase nyata dan belum diverifikasi pada HEAD GitHub**.
