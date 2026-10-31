# R105 — Single Login Error Alert (mobile + desktop)

## Masalah
Pada layar login, pesan kegagalan koneksi/verifikasi yang sama muncul dua kali: tepat di bawah input PIN dan setelah keypad numerik. Keduanya membaca `errorMessage` dari state yang sama.

## Perbaikan
- Pertahankan **satu** `role="alert"` setelah kolom PIN, termasuk `id="pin-error-message"` agar `aria-describedby` tetap bekerja.
- Hapus duplikasi alert di bawah keypad; layar mobile menjadi lebih ringkas.
- `role="alert"` sudah menyertakan perilaku pengumuman untuk pembaca layar sehingga `aria-live="polite"` yang bertentangan dihapus.
- Tidak mengubah logika autentikasi, koneksi server, PIN, Firebase, token, cache, atau Firestore Rules.

## Implementasi
Terapkan ZIP incremental ke repository **setelah R104-D**. Jalankan:

```sh
node scripts/test_r105_single_login_error_alert.mjs
npm run lint
npm run build
```

Uji di Chrome Android: coba login ketika offline; pastikan peringatan tampil satu kali di bawah kolom PIN. Uji juga PIN salah, berhasil masuk, dan penghapusan pesan saat mengubah PIN. Jika pesan "Tidak dapat terhubung ke server" masih muncul, itu menandakan kegagalan koneksi/API yang perlu didiagnosis terpisah; R105 hanya menghapus pesan yang tampil ganda.

## Risiko
Risiko perubahan rendah: hanya 1 lokasi rendering JSX diubah. Tidak ada penambahan jaringan atau skema data.
