# Checklist Eksekusi Cursor — R86-B Smart Tab Detection

- [ ] Tarik source terbaru melalui GitHub Desktop: Fetch / Pull origin; catat branch/commit.
- [ ] Pastikan instrumentasi R86-A sudah dipasang dan pengujian R86-A lulus.
- [ ] Buat checkpoint commit sebelum mengubah apa pun.
- [ ] Ekstrak ZIP incremental R86-B ke root repository (jangan salin file `main.tsx` dari arsip lama).
- [ ] Periksa hanya file baru `src/services/multitab/`, `scripts/`, `docs/`.
- [ ] Jalankan `node scripts/apply_r86b_safe.cjs` (dry-run).
- [ ] Bila hasil dry-run aman, jalankan `node scripts/apply_r86b_safe.cjs --apply`.
- [ ] Audit `src/main.tsx`: satu blok opt-in R86-B, tidak ada perubahan bootstrap/auth.
- [ ] Jalankan `node scripts/verify_r86b_safe.cjs`.
- [ ] Jalankan `node scripts/verify_r86b_installer.cjs`.
- [ ] Jalankan `node scripts/verify_r86a_multitab.cjs`.
- [ ] Jalankan `npm ci`, `npm run lint`, dan `npm run build`; hentikan jika gagal.
- [ ] Set `VITE_R86_TAB_OPT=enabled` **hanya** pada Preview/Staging.
- [ ] Buka dua tab `?r86_tab_opt=1`; ukur `window.__PIKET_R86B__?.snapshot()` di Console.
- [ ] Uji hidden/visible, tab ditutup, reload, BFCache, dan browser tanpa BroadcastChannel.
- [ ] Uji sesi berbeda, presensi, notifikasi, offline draft/foto, dan update PWA.
- [ ] Bandingkan performa DevTools dengan dan tanpa flag; tidak boleh mengklaim penghematan Firestore tanpa data.
- [ ] Jika staging berhasil, Commit → Push melalui GitHub Desktop; verifikasi commit dan Vercel Ready.

### Ketentuan keselamatan untuk Cursor

Jangan edit `src/services/offline/`, `AuthContext`, `firestore.rules`, modul presensi, notifikasi, maupun PWA. Jangan menonaktifkan listener backend, queue flush, atau service worker. Jangan menetapkan tab tunggal sebagai pemilik data. Jangan menutup tab otomatis. Jangan memasukkan UID/PIN/role/data sensitif ke pesan BroadcastChannel. Jangan gunakan `any` atau `@ts-ignore`. Berhenti dan laporkan bila source HEAD berbeda atau pemasang menampilkan STOP.
