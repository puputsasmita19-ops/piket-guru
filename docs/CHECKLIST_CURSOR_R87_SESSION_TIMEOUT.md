# Checklist Eksekusi Cursor — R87-S1

- [ ] Fetch/Pull repo dan buat checkpoint commit.
- [ ] Diff file `src/types/sessionPolicy.types.ts` dan `src/features/settings/SessionPolicySettingsCard.tsx` terhadap ZIP.
- [ ] Jika source sudah berbeda, merge hanya konstanta daftar durasi, formatter, label, dan penjelasan UI (jangan overwrite fungsi lain).
- [ ] Pastikan durasi lama masih ada.
- [ ] Pastikan opsi baru: 10, 15, 30, 60, 120 menit.
- [ ] Pastikan nilai tetap disimpan dalam detik (`600`, `900`, `1800`, `3600`, `7200`).
- [ ] Pastikan Firebase/AuthContext/backgroundSession/offline tidak berubah.
- [ ] `npm ci`
- [ ] `node scripts/verify_r87_session_delays.cjs`
- [ ] `node scripts/verify_background_session.mjs`
- [ ] `node scripts/verify_session_policy_settings.mjs`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Uji mobile dan desktop, termasuk light/dark mode.
- [ ] Uji pengaturan tersimpan setelah reload.
- [ ] Uji selesai/dikirimnya presensi dan keamanan draft/antrean offline.
- [ ] Catat bahwa idle timeout existing 30 menit tetap berlaku.
- [ ] Push ke branch Preview dan uji sebelum produksi.
