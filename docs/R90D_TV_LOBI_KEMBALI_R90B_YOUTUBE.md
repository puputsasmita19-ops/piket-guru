# R90-D — TV Lobi: Kembali ke Tampilan R90-B + Sematan YouTube

## Tujuan
- Mengembalikan sepenuhnya susunan slide TV Lobi R90-B (bukan dashboard kolom R90-C).
- Mempertahankan pengaturan R90-B (tema, tipografi, transisi, tanggal, ticker, fullscreen).
- Menambahkan satu slide **Video Profil Sekolah** di akhir rotasi jika URL YouTube valid dan opsi aktif.
- Mengganti ikon kilau/petir pada pengumuman/ticker dengan ikon Megaphone bergaris tipis.

## Menu Admin
`Pengaturan Sekolah → Pengaturan TV Lobi → Sematan Video Profil Sekolah (YouTube)`.

1. Isi `URL video YouTube` (contoh `https://youtu.be/dQw4w9WgXcQ` sebagai format, **jangan gunakan video contoh** untuk tayangan sekolah).
2. Isi judul/subjudul jika perlu.
3. Nyalakan `Tampilkan Video Profil Sekolah`.
4. Pilih `Putar otomatis (tanpa suara)` dan `Durasi tampil slide video` (default 90 detik). YouTube mungkin membatasi autoplay di Smart TV; video masih bisa dimainkan manual.
5. Klik `Pratinjau` untuk mencoba draf, lalu `Simpan Pengaturan TV` untuk menerapkan.

## Perilaku video
- Sumber hanya HTTPS YouTube yang dikenali; URL dari domain lain, URL berbahaya, dan ID tidak valid ditolak.
- Tidak ada upload video atau penyimpanan video di Firebase. **Streaming YouTube tetap memakai kuota perangkat TV.**
- Iframe hanya ada ketika slide video aktif; ketika berganti slide, iframe otomatis dilepas sehingga streaming berhenti.
- Saat autoplay nonaktif, yang tampil awalnya thumbnail; klik play untuk memulai dan menahan rotasi sampai tombol `Lanjutkan rotasi slide` diklik.
- Jika video pendek/panjang, atur durasi slide yang sesuai. Durasi ini tidak bergantung pada interval slide informasi.
- Video embed memerlukan internet dan izin embed dari pemilik kanal.

## Pengujian
Jalankan dari root repository (setelah instalasi dependensi):

```bash
npm run lint
npm run build
node scripts/test_r90d_restore_youtube.mjs
node scripts/test_r90b_kiosk_motion_readability.mjs
node scripts/test_r90a_kiosk_theme.mjs
node scripts/test_r90_tv_lobby_daily_recap.mjs
```

Pastikan tema terang/gelap, urutan panel, ukuran font, ticker, dan kontrol fullscreen tetap normal. Uji autoplay di browser TV fisik, karena kebijakan media browser berbeda-beda.

`firestore.rules` tidak berubah. Jangan deploy rules untuk patch ini.
