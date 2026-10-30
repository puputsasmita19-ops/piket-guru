# R96 — Outline Tombol Check-In & Check-Out

## Tujuan
Menambahkan outline animasi ringan dan petunjuk langkah berikutnya pada tombol **Kirim Presensi Masuk (Check-In)** dan **Kirim Presensi Pulang (Check-Out)**. Tidak mengubah alur server, GPS, selfie, maupun jadwal.

## Perilaku
- **Check-In:** outline muncul sesudah swafoto tersedia, pembacaan GPS ada dan status di dalam radius dengan akurasi sesuai kebijakan, jadwal/mode presensi memenuhi syarat, tidak offline, serta tidak sedang diproses. Tidak tampil sebelum swafoto atau setelah check-in.
- **Check-Out:** outline muncul setelah check-in dicatat dan kebijakan waktu pulang mengizinkan. Lokasi GPS akan diperbarui/ditinjau kembali ketika guru menekan Check-Out seperti mekanisme R93–R95. Tidak muncul sebelum jendela pulang, saat proses, atau setelah check-out.
- **Outline:** animasi `box-shadow` sebanyak 3 siklus, tanpa mengubah ukuran tombol atau menggulir layar otomatis.
- **Aksesibilitas:** jika perangkat mengaktifkan `prefers-reduced-motion`, outline tetap tampak namun tanpa animasi.
- **Waktu:** saat panel presensi terbuka, izin checkout dievaluasi ulang setiap 30 detik tanpa tambahan request Firebase atau GPS.

## Cara menerapkan
1. Terapkan ke root repository yang sudah memiliki patch R95.
2. Jalankan:
   ```bash
   node scripts/test_r96_checkin_checkout_highlight.mjs
   npm run lint
   npm run build
   ```
3. Commit/push, lalu cek di Vercel Preview sebelum deployment ke produksi.

## Skenario uji HP
1. Sebelum GPS valid dan sebelum swafoto: **tidak** ada outline Check-In.
2. GPS valid lalu foto diambil: **Check-In** mendapat outline dan petunjuk.
3. Setelah Check-In tersimpan: outline Check-In hilang.
4. Mode terjadwal sebelum jam pulang: Check-Out tanpa outline.
5. Ketika jam pulang dibuka: Check-Out mendapat outline tanpa refresh halaman (toleransi pembaruan maksimal 30 detik).
6. Ketika Check-Out diproses/selesai: outline menghilang.
7. Test kondisi offline dan mode pengurangan animasi: tidak ada petunjuk palsu atau animasi berkedip.

## Batasan
Validasi nyata pada perangkat dan Firebase belum dilakukan dari lingkungan pembuatan patch. Perubahan ini tidak menyunting `firestore.rules`.
