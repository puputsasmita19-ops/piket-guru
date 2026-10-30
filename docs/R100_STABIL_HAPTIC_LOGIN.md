# R100 — Haptic stabil, menu ikon, dan login lebih responsif

## Basis
Patch incremental untuk repository yang **sudah menerapkan R99**. Timpa hanya file di ZIP dengan struktur folder yang sama. Jangan memasukkan ZIP secara utuh ke dalam `src`.

## Perubahan

- `src/features/auth/pinHaptics.ts`: deduplikasi per tombol. Permintaan pertama melalui `pointerdown` pada touch/pen; peristiwa `click` yang sesuai tidak mengulang getaran jika diterima. Jika browser menolak permintaan awal, `click` mencoba sekali lagi. Klik mouse/keyboard/screen reader mendapat satu permintaan. Kejadian `pointercancel` membatalkan catatan sentuhan. Tidak ada data sensitif yang tersimpan.
- `src/features/auth/LoginPage.tsx`: pengaturan haptic disimpan di bawah **ikon pengaturan** berukuran 44×44 px, tidak lagi menghabiskan tinggi layar saat ditutup. Ikon hapus seluruh PIN lebih jelas. Saat login dimulai, UI menampilkan loading seperti biasa dan menghentikan permintaan daftar pengguna publik yang opsional. Konfigurasi identitas sekolah tetap dimuat, walaupun login gagal.
- `src/services/auth/authService.ts`: mendukung pembatalan hanya request `/api/auth/users-summary` yang sedang berlangsung saat autentikasi dimulai. Request PIN, verifikasi server, pembuatan custom token, login Firebase, serta pemeriksaan identitas tidak dibatalkan dan tidak dilewati.
- `scripts/test_r100_haptic_login_ergonomics.mjs`: 16 uji untuk ketukan cepat, duplikasi getaran, fallback keyboard, ikon, dan invarians autentikasi.
- `scripts/test_r98_pin_haptics_responsive.mjs` dan `scripts/test_r99_haptic_diagnostics.mjs`: perbarui pemeriksaan agar sesuai perilaku deduplikasi per tombol.

## Uji lokal

```bash
node scripts/test_r100_haptic_login_ergonomics.mjs
node scripts/test_r99_haptic_diagnostics.mjs
node scripts/test_r98_pin_haptics_responsive.mjs
node scripts/test_r97_login_session_performance.mjs
node scripts/verify_login_toggle_r84.cjs
npm run lint
npm run build
```

**Catatan**: pemeriksaan logika pada lingkungan penyusun lulus. `npm run lint` tidak dapat dievaluasi penuh karena lingkungan tidak memiliki node_modules (dependensi React/Firebase/Node). `npm run build` belum diverifikasi pada repository dengan dependensi terpasang.

## Uji Android yang diperlukan

1. Buka halaman login di HP Android menggunakan Chrome atau PWA.
2. Tekan ikon pengaturan getaran dekat keypad PIN. Aktifkan lalu pilih Normal atau Kuat; tekan **Coba Getaran**.
3. Ketuk PIN bergantian cepat: angka 1–6. Masing-masing tombol hanya boleh memicu satu getaran yang diminta dan satu respons visual; jumlah digit tidak boleh lebih dari 6.
4. Uji Hapus, backspace, sentuhan yang batal, dan ketukan lagi. Coba dengan getaran dimatikan.
5. Uji PIN benar dan salah, login Google, mode ID/NIP, kondisi jaringan lambat, dan refresh halaman. Akun yang ditolak server tidak boleh masuk dashboard.
6. Verifikasi tombol tetap berfungsi jika browser tidak mendukung `navigator.vibrate`.

## Batas platform

API Vibration dapat tidak tersedia atau diabaikan oleh browser/OS. Browser yang mengembalikan `true` **tidak membuktikan getaran fisik**. Pada banyak browser iOS, getaran web tidak didukung. Tidak ada hak akses atau Firebase Rules yang perlu diubah untuk patch ini.

## Rollback

Kembalikan ketiga file `src` dari versi R99. Pengaturan haptic lokal yang sudah tersimpan tetap berlaku pada R99.
