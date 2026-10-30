# R98 — Login PIN lebih responsif + Haptic Feedback

**Basis:** Source Piket Guru setelah R97. Patch incremental, tidak mengubah Firestore Rules maupun login backend.

## Perubahan

- Keypad PIN menerima ketukan cepat, dengan guard **fungsional** yang selalu membatasi input maksimal 6 digit (termasuk ketika beberapa ketukan datang sebelum React merender ulang).
- `touch-action: manipulation` dan pressed-state CSS ringan memberikan respons visual cepat pada tombol.
- Latar video/animasi login menggunakan komponen memoized, sehingga **pengetikan PIN tidak merender ulang media latar**.
- Pencocokan akun yang dipilih tidak memfilter daftar lagi pada setiap ketukan PIN.
- Tombol **Getaran tombol** di bawah keypad adalah preferensi lokal per perangkat. Getaran pendek 7–13 ms dan hanya dicoba saat interaksi langsung. Fitur **otomatis tidak aktif jika `navigator.vibrate` tidak didukung** (misalnya banyak browser iOS).
- Jika pengguna mengetuk tombol masuk beberapa kali secara cepat, penguncian sinkron mencegah permintaan autentikasi paralel sebelum React memperbarui status loading.
- Login PIN, Google Login, pemeriksaan sesi & keamanan server tetap sama. PIN tidak disimpan dalam preferensi haptic.

## Cara pasang

1. Ekstrak ZIP ke **root repo setelah R97**, timpa file yang sesuai.
2. Jalankan `node scripts/test_r98_pin_haptics_responsive.mjs`.
3. Jalankan `node scripts/test_r97_login_session_performance.mjs` dan `node scripts/verify_login_toggle_r84.cjs`.
4. Pada workstation dengan `node_modules` lengkap, jalankan `npm run lint` dan `npm run build`.
5. Deploy ke Vercel Preview dahulu, uji pada HP Android dan (jika ada) iPhone.

## Pilot uji cepat

- Ketuk PIN cepat 8–10 kali: kolom harus tetap maksimal 6 digit.
- Hapus satu angka, hapus semua, lalu isi ulang PIN; tidak boleh ada angka ganda/tertunda.
- Pada perangkat yang mendukung: tombol **Getaran tombol** bisa diaktifkan/dinonaktifkan; pilihan tetap sama setelah refresh.
- Pada perangkat yang tidak mendukung: keypad tetap responsif dan tidak muncul error.
- Pastikan mengirim PIN tetap perlu menekan **Masuk Sekarang**, bukan otomatis ketika 6 digit lengkap.
- Klik masuk berkali-kali secara cepat: cukup satu proses verifikasi aktif.
- Uji PIN benar, PIN salah, lockout, offline, Google Login, refresh sesi dan logout seperti R97.

## Keterbatasan

- Getaran fisik bergantung API browser, perangkat keras, pengaturan sistem, dan kebijakan hemat daya. Tidak dijamin pada setiap HP.
- Tidak ada pengukuran milidetik aktual pada perangkat fisik. Respons visual lebih cepat dioptimalkan secara kode, bukan klaim waktu nyata.
- Jika npm dependensi tidak tersedia pada lingkungan pengujian, build lengkap tidak dapat diverifikasi di sini.
