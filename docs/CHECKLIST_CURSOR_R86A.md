# Checklist Eksekusi Cursor / GitHub — R86-A

- [ ] **Fetch origin / Pull origin** pada repository `piket-guru`, branch kerja benar; catat commit SHA HEAD.
- [ ] Pastikan tidak ada perubahan kerja lokal yang belum dicadangkan; buat checkpoint commit/tag.
- [ ] Ekstrak ZIP incremental R86-A ke root repository (file baru saja).
- [ ] Buka `src/main.tsx`; cek apakah `createRoot(document.getElementById('root')!).render(<App />);` masih sama.
- [ ] Jalankan `node scripts/apply_r86a_safe.cjs` (dry-run).
- [ ] Jalankan `node scripts/apply_r86a_safe.cjs --apply`; jika `STOP`, hentikan dan tinjau source aktual, jangan timpa file.
- [ ] Periksa diff: `main.tsx` hanya ditambah blok impor dinamis audit; kode autentikasi, sinkronisasi, notifikasi, PWA, Firebase Rules tidak diubah.
- [ ] Jalankan `node scripts/audit_multitab_r86a.cjs` dan tinjau indikator yang belum ditemukan.
- [ ] Jalankan `node scripts/verify_r86a_multitab.cjs`.
- [ ] Jalankan `npm ci`, `npm run lint`, dan `npm run build` (gagal berarti **jangan Push**).
- [ ] Coba satu dan dua tab Vite dev dengan URL `?r86_audit=1` dan Console `window.__PIKET_R86_AUDIT__?.snapshot()`.
- [ ] Untuk staging Preview, atur `VITE_R86_AUDIT=enabled` **hanya di Preview**, deploy dan tes 1/2/3/5 tab, perangkat pribadi/bersama, offline dan kembali online.
- [ ] Periksa bahwa tanpa flag/URL, audit tidak jalan dan tidak membebani produk.
- [ ] Jangan kirim foto, UID, token atau PIN dalam log audit/screenshot ke pihak lain.
- [ ] Jika semua lolos, commit & push **manual**. Jika perlu rollback, revert perubahan blok `main.tsx`; tidak perlu hapus penyimpanan aplikasi.

**Tujuan R86-A hanya observasi; belum ada otomatis menutup/mem-pause tab lain.**
