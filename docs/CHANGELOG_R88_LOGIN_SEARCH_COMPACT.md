# R88 — Login Search Compact: Mobile First

**Basis:** `src/features/auth/LoginPage.tsx` dari patch R85, yang tidak diubah dalam rangkaian R86 dan R87-S1 pada paket yang tersedia. Jika source HEAD GitHub lebih baru dan berbeda, **jangan langsung timpa** tanpa membandingkan diff.

## Masalah

R85 menempatkan toggle **Nama / ID/NIP** dalam baris tersendiri di atas kolom pencarian. Meskipun tombolnya lebih kecil, gabungan kedua baris masih menyita tinggi layar HP.

## Solusi

- Menggabungkan field pencarian dan segmented control **Nama | ID/NIP** ke dalam satu baris, toggle tetap di **sebelah kanan**.
- Tidak lagi menampilkan label tambahan `Metode masuk` sebagai baris tersendiri; label aksesibilitas tetap tersedia pada section dan group.
- Lebar tombol 52+62 px pada mobile, 62+72 px pada desktop, plus jarak kecil.
- Ikon toggle: 12 px mobile, 14 px desktop; font tombol 10 px mobile, 12 px desktop.
- **Tinggi tombol minimal 44 px di mobile** (40 px desktop) untuk sentuhan yang layak.
- Input 16 px di mobile untuk menghindari pembesaran layar otomatis saat fokus pada Safari iOS; input desktop 14 px.
- Placeholder singkat `Cari nama...` / `ID atau NIP...`, dengan ARIA label lengkap.
- Tombol X untuk hapus pencarian kini berada secara inline, tidak menutupi toggle.
- Dropdown pencarian, retry pemuatan akun, kartu akun, nama panjang, PIN 6 digit, login Google, trusted device, dan pemulihan sesi **tidak diubah**.

## File yang perlu disalin/ditimpa

1. `src/features/auth/LoginPage.tsx` — perubahan UI login (1 file aplikasi).
2. `scripts/verify_login_toggle_r84.cjs` — menyesuaikan verifikasi layout lama, tetap menguji perilaku R84.
3. `scripts/verify_r85_login_permit.cjs` — menyesuaikan verifikasi layout R85, tetap menguji pilihan izin dan value enum.
4. `scripts/verify_r88_login_compact.cjs` — tes UI baru.
5. `docs/CHANGELOG_R88_LOGIN_SEARCH_COMPACT.md` — dokumentasi.
6. `docs/CHECKLIST_CURSOR_R88.md` — checklist.

Tidak ada perubahan pada `authService.ts`, `AuthContext.tsx`, Firebase rules, backend, layanan presensi, penyimpanan offline, listener, atau PWA.

## Verifikasi pembuat patch

- R88 source checks: **30/30 PASS**.
- R84 handler regressions: **30/30 PASS**.
- R85 login/permit regressions: **26/26 PASS**.
- Mock statis Chromium: **12/12 PASS** untuk 6 lebar layar x 2 tema; ini bukan rendering penuh aplikasi produksi.
- Integritas ZIP: perlu diverifikasi ulang setelah file digabung di repository pengguna.
- Lint dan build seluruh aplikasi **belum dikonfirmasi lulus** pada commit produksi pengguna.

## Pemeriksaan manual setelah pemasangan

- Mobile 320, 360, 390, 430 px; desktop 768, 1280 px.
- Nama -> mengetik -> pilih pengguna -> PIN 6 digit -> login.
- ID/NIP -> ketik ID -> PIN -> login.
- Ganti mode ketika ada teks atau akun terpilih; jangan bocorkan ID manual tidak terverifikasi ke mode Nama.
- Hasil pencarian banyak, nama panjang, scroll, Tab/ArrowUp/ArrowDown/Enter/Escape, clear X.
- Daftar akun API gagal/tidak tersedia -> opsi ID/NIP + Coba Lagi tetap tersedia.
- Loading dan dark mode, keyboard HP, Google Admin, perangkat tepercaya.
- Setelah upload ke branch Preview, verifikasi login secara nyata sebelum production.

## Rollback

Jika regresi UI ditemukan, kembalikan hanya `src/features/auth/LoginPage.tsx` serta dua skrip verifikasi R84/R85 ke commit sebelumnya melalui Git, lalu lint/build ulang. Jangan menghapus cache/IndexedDB guru.
