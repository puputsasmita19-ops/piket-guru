# Checklist Eksekusi Cursor — R86-C Safe Multi-Tab Listener & Notification Optimization

- [ ] Pull HEAD GitHub terbaru melalui GitHub Desktop; catat branch dan commit.
- [ ] Pastikan R86-A dan R86-B sudah diterapkan dan build baseline sehat.
- [ ] Buat checkpoint commit; jangan hapus cache/browser storage/IndexedDB.
- [ ] Ekstrak ZIP incremental R86-C di root repository.
- [ ] Periksa bahwa ZIP menambah **6 file baru** saja, belum menimpa file aplikasi.
- [ ] Jalankan `node scripts/apply_r86c_safe.cjs` (dry-run).
- [ ] Bila tidak ada STOP, jalankan `node scripts/apply_r86c_safe.cjs --apply`.
- [ ] Audit diff `src/main.tsx` (R86-C opt-in sebelum React root), tidak mengubah R86-A/B.
- [ ] Audit diff `src/services/firebase/firestoreService.ts` (`sharedLiveSource` tetap sama; hanya wrapper unsubscribe dan event counter).
- [ ] Audit diff `src/services/notifications/notificationFeedService.ts` (query `session`,`school`,`announcements`,`announcementUpdates` tetap sama).
- [ ] Audit diff `src/components/layout/NotificationBell.tsx` (listener realtime + outbox tetap aktif; hanya timer UI 60 detik yang paused saat hidden di opt-in).
- [ ] Jalankan `node scripts/verify_r86c_safe.cjs`.
- [ ] Jalankan `node scripts/verify_r86c_installer.cjs`.
- [ ] Jalankan ulang verifikasi R86-A/B, `npm ci`, `npm run lint`, `npm run build`, `git diff --check`.
- [ ] Jika STOP, lint, atau build gagal, jangan Push: tampilkan log ke Cursor untuk audit sumber terbaru, bukan memaksa patch.
- [ ] Di Vercel **Preview saja**, set `VITE_R86_LISTENER_AUDIT=enabled` dan rebuild.
- [ ] Pada Preview, buka `?r86_listener_audit=1` serta inspeksi `window.__PIKET_R86C__?.snapshot()` di Console **masing-masing tab**.
- [ ] Uji 1/2/3/5 tab, termasuk visible/hidden >1 menit, reload, BFCache, dan offline/online.
- [ ] Uji pesan notifikasi, baca semua, pemberitahuan darurat, serta perubahan data Firestore yang benar-benar tampil.
- [ ] Uji pergantian akun, logout, presensi datang/pulang, GPS/selfie, buku piket, foto/draf, sync offline, dan update PWA.
- [ ] Bandingkan counters per tab; jangan menganggap callback = Firebase reads billable. Catat hasil di laporan staging.
- [ ] Setelah semua lulus, Commit dan Push manual. Verifikasi status Vercel Ready dan tidak ada error runtime.

**Aturan Cursor:** jangan mengedit `AuthContext`, `syncQueueService`, `offlineStorage`, `appUpdateManager`, Firestore Rules, role/permission, Google Login, serta modul presensi. Jangan membatasi listener Firestore/notification saat hidden. Jangan membuat tab leader, tidak memaksa logout, tidak menghapus draf offline, tidak memakai @ts-ignore, tidak memodifikasi data pengguna. STOP berarti butuh review manual. 
