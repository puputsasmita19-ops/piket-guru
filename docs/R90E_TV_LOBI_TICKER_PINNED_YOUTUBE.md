# R90-E — Running Ticker Tanpa Jeda & Sematan Video YouTube

## Perubahan

1. **Ticker:** teks pertama langsung terlihat di sisi kiri area berjalan (tidak menunggu masuk dari kanan). Dua salinan pesan yang identik bergulir terus-menerus; label PENGUMUMAN berdiri di area tersendiri dan tidak dapat ditimpa tulisan berjalan. Kecepatan dan ukuran teks tetap menggunakan pengaturan lama.
2. **Video:** Admin bisa mengaktifkan **Sematkan video saat slide informasi berjalan**. Di layar TV lebar, video ditempatkan di panel samping kiri/kanan tersendiri, bukan menutupi isi slide. Di layar lebih kecil, sematan menjadi mini-player. Video tetap terpasang saat slide informasi berganti.
3. **Mode lama:** jika sematan dinonaktifkan, video kembali menjadi slide terpisah sesuai R90-D (jika video aktif dan URL valid). Tidak ada dua pemain YouTube bersamaan.
4. **Hemat storage:** tidak mengunggah file video ke Firebase. Streaming dari YouTube **tetap menggunakan kuota internet**, dan autoplay dapat diblokir oleh browser Smart TV. Sematan default **mati** untuk mempertahankan tampilan sebelumnya.

## Cara menerapkan

Patch R90-E harus ditimpa ke root repository **sesudah R90-D**. File yang berubah:
- `src/types/lobbyTv.types.ts`
- `src/features/kiosk/PublicKioskDisplay.tsx`
- `src/features/settings/LobbyTvSettingsCard.tsx`
- `src/index.css`

File tambahan:
- `scripts/test_r90e_ticker_pinned_video.mjs`
- `docs/R90E_TV_LOBI_TICKER_PINNED_YOUTUBE.md`

Jalankan `npm run lint`, `npm run build`, `node scripts/test_r90e_ticker_pinned_video.mjs`. Deploy ke Vercel Preview, uji sebelum produksi. Tidak ada perubahan `firestore.rules` maupun database migration. `lobbyTv` menggunakan field opsional baru dan nilai bawaan yang aman untuk konfigurasi lama.

## Pengaturan Admin

`Pengaturan Sekolah → Pengaturan TV Lobi → Sematan Video Profil Sekolah (YouTube)`:
- Pastikan fitur video aktif, isi URL video HTTPS valid.
- Aktifkan **Sematkan video saat slide informasi berjalan**.
- Pilih **Posisi video:** Kanan (default)/Kiri.
- Pilih **Ukuran sematan:** Kompak (default)/Sedang.
- Atur **Putar otomatis (tanpa suara)**. Simpan, lalu periksa TV.

`Pengaturan Sekolah → Pengaturan TV Lobi → Teks Berjalan`:
- Pilih **Teks Berjalan Halus**, lalu kecepatan/ukuran sesuai jarak pandang.
- Teks akan muncul **langsung**, tanpa jeda kosong sebelum masuk.

## Acceptance Test di browser dan Smart TV

1. Ticker 1 pesan pendek, banyak pesan panjang, mode besar/kecil pada 1080p: teks tidak tumpang tindih dengan label dan tidak muncul ruang kosong sebelum memulai putaran.
2. Uji 2 siklus ticker; transisi akhir→awal terlihat menyambung, tidak lompat atau berhenti lama.
3. Admin aktifkan pinned + URL valid: panel video selalu tampil saat slide `Guru Piket → Guru Inval → Tamu → Pengumuman`; YouTube tidak restart saat slide berubah. Cek di DevTools Network: satu iframe YouTube.
4. Ganti sisi kiri/kanan dan ukuran; konten slide tidak tertimpa pada resolusi desktop 1366×768 dan Full HD 1920×1080.
5. Coba autoplay ON/OFF. Autoplay ON dimute; jika browser menolak autoplay, gunakan tombol play YouTube. Audio harus diatur secara manual melalui pemutar.
6. Klik **Ciutkan**, pastikan iframe dihentikan, lalu **Tampilkan**. Tidak ada suara/video di balik layar saat player diciutkan.
7. Matikan pinned: kembali ke slide Video Profil R90-D; jangan memutar dua iframe sekaligus.
8. Matikan Video Profil: tidak ada pemutar ataupun stream YouTube.
9. Preview draf Admin tanpa simpan; TV pada perangkat lain belum berubah. Setelah disimpan, TV mengambil config baru via listener settings.
10. Uji tema terang/gelap, ticker statis, pengurangan animasi sistem dan tampilan TV bersambung lebih dari 20 menit.

**Batas pengujian lokal:** pemeriksaan sumber, sintaks TS/TSX dan unit regression dilakukan di lingkungan tanpa `node_modules` React/Firebase yang lengkap. Uji build penuh, Firebase aktual, browser fisik dan video YouTube sesungguhnya belum dilakukan pada patch ini.
