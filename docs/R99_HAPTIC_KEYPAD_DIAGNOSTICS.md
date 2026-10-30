# R99 — Perbaikan Getaran Tombol PIN (Device-Local Haptic)

**Prasyarat**: source Piket Guru setelah R98.

## Masalah R98

- Durasi getaran PIN R98 hanya 7 ms untuk digit sehingga beberapa motor getar hampir tidak terasa.
- Getaran pada `onClick` terasa lebih lambat daripada awal sentuhan pada layar HP.
- Sakelar `Getaran tombol` sebelumnya mendeteksi ketersediaan `navigator.vibrate`, bukan bukti bahwa getaran benar-benar terasakan.

## Perbaikan

1. Memanggil getaran langsung saat `pointerdown` untuk layar sentuh; klik berikutnya tidak menambah getaran kedua. Klik keyboard/screen reader tetap mendapat feedback.
2. Preset kekuatan tersimpan lokal: **Lembut (16 ms)**, **Normal (28 ms)**, **Kuat (45 ms)** untuk angka. Hapus/pembersihan mendapat pola tunggal lebih lama. Fitur ini tidak pernah memengaruhi nilai PIN/verifikasi.
3. Tombol **Coba Getaran** meminta pulse uji 65–120 ms sesuai preset dan menampilkan status permintaan browser (bukan menjamin getaran fisik).
4. Jika API tidak tersedia, tampilkan **Tidak didukung**, sementara tombol PIN tetap memberi perubahan warna/outline cepat.
5. Mempertahankan opsi aktif/nonaktif R98 (localStorage key lama), agar preferensi yang sudah dipilih pengguna tidak hilang.
6. Tidak ada konfigurasi Admin: dukungan getaran tergantung setiap perangkat/browser, sehingga sakelar global tidak dapat memaksakannya.

## Uji pada HP

1. Deploy R99 ke Vercel Preview; buka login di Chrome Android dengan HTTPS. Refresh setelah memastikan versi PWA baru sudah termuat.
2. Pastikan sakelar **Aktif**. Pilih **Normal**, lalu ketuk **Coba Getaran**. Jika belum terasa, pilih **Kuat** dan coba lagi.
3. Matikan mode senyap/DND, periksa pengaturan *Vibration/Haptic feedback* perangkat dan penghemat daya. Beberapa browser/iPhone tidak menyediakan Web Vibration API.
4. Ketuk angka PIN cepat: perubahan visual harus instan, 6 digit maksimal, satu ketuk satu angka, tidak menggandakan getaran.
5. Uji tombol Hapus, Hapus Semua, toggling Aktif/Nonaktif, login PIN salah/benar, refresh sesi.
6. Pada iPhone atau browser tanpa API, label harus **Tidak didukung**; login tetap normal dengan feedback visual.

## Penerapan

```bash
node scripts/test_r99_haptic_diagnostics.mjs
node scripts/test_r98_pin_haptics_responsive.mjs
node scripts/test_r97_login_session_performance.mjs
node scripts/verify_login_toggle_r84.cjs
npm run lint
npm run build
```

**Catatan**: npm lint dan build penuh harus dijalankan pada lingkungan dengan seluruh dependencies proyek. Pengujian kode tidak bisa mendeteksi apakah getaran fisik benar-benar dirasakan pengguna.

**Tidak perlu mengubah Firestore Rules**. Tidak ada backend/authentication changes.
