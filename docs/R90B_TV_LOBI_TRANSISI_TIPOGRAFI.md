# R90-B — TV Lobi: Transisi Lebih Halus & Tipografi Lebih Terbaca

**Basis:** Repository setelah R90-A. **Jenis:** Patch incremental; tidak mengubah Firebase Rules, database, autentikasi, presensi, ataupun jadwal.

## Perbaikan

1. **Animasi masuk–keluar dua tahap**: panel lama menghilang dulu; konten berganti saat tersembunyi; panel baru masuk dengan opacity dan transform pendek (14px), tanpa perpindahan tajam dan tanpa efek blur bergerak. Pilihan Admin `none`, `fade`, dan `slide` tetap tersedia, termasuk durasi 300/500/800/1200 ms. Hormati `prefers-reduced-motion`.
2. **Jam terisolasi**: pembaruan detik hanya me-render komponen jam; daftar guru dan slide tidak lagi ikut dirender tiap detik. Format jam dibuat sekali per perubahan pengaturan. Pergantian hari diperiksa tiap menit dan ketika tab aktif kembali.
3. **Skala tipografi sebenarnya**: pengaturan `Kompak`, `Standar`, `Besar / Jauh` benar-benar mengubah font pada judul, nama, rincian, statistik, tanggal/jam dan ticker (bukan sekadar padding). Ukuran menyesuaikan lebar layar, dengan fallback untuk browser yang lebih tua.
4. **Daftar panjang dipecah per halaman otomatis**: guru piket, guru inval, tamu, dan pengumuman tidak lagi memaksakan semua kartu di satu layar. Urutan panel Admin dipertahankan dan tidak ada data yang dibuang karena pagination. Tampilan merangkum jumlah slide + bagian.
5. **Setting ukuran ticker dihormati**: `Kecil / Sedang / Besar` tetap berfungsi dan tidak ditimpa ukuran dasar font TV.

## Perilaku penting

- Teks pengumuman tetap dibatasi lima baris per kartu seperti sebelum patch; jika teks sangat panjang, lanjutkan pengumuman dengan kartu terpisah agar tidak terpotong.
- Jika data aktif bertambah/berkurang hingga jumlah halaman berubah, rotasi kembali ke panel awal (untuk konsistensi tampilan). Ini tidak mengubah datanya.
- Tidak ada notifikasi baru, panggilan API baru, atau penyimpanan tambahan.

## Rekomendasi Pengaturan

**Pengaturan Sekolah → TV Lobi**:

- Transisi: **Fade** (TV yang lebih tua), atau **Geser Lembut** (TV baru).
- Durasi: **800 ms** untuk pergantian elegan (500 ms untuk perangkat lambat).
- Jeda pergantian slide: **10–15 detik** supaya nama/informasi terbaca.
- Skala Tipografi: **Standar** untuk 32–55 inci; **Besar / Jauh** untuk jarak >5 meter; **Kompak** hanya bila layar sempit.
- Ticker: ukuran **Sedang/Besar** bila terlihat dari jauh.

## Penerapan

1. Ekstrak patch ke root repo setelah R90-A sambil mempertahankan struktur folder.
2. Jalankan dari root: `npm run lint`, `npm run build`, dan `node scripts/test_r90b_kiosk_motion_readability.mjs`.
3. Commit & push ke GitHub, tunggu Vercel Preview berhasil, lalu verifikasi manual.
4. Tidak diperlukan deploy `firestore.rules`.

## Checklist Uji Vercel Preview / TV Fisik

- [ ] Mode Gelap dan Terang tetap terbaca; ubah tema lalu simpan dan buka TV lagi.
- [ ] Efek Fade, Geser, dan Tanpa Animasi mengikuti pilihan dan durasi Admin.
- [ ] Uji 500 ms dan 800 ms pada Smart TV/PC 1080p; pastikan tidak ada jeda hitam, flash putih, atau animasi tersendat parah.
- [ ] Uji Standar vs Besar: ukuran teks **jelas berbeda**, nama guru dan jam tetap terlihat.
- [ ] Tambah 8+ guru piket / 5+ inval / 7+ tamu / 5+ pengumuman; pastikan halaman bergilir dan data terakhir ikut muncul.
- [ ] Ubah urutan/aktivasi panel dari Admin; pastikan TV Live dan Preview mengikuti.
- [ ] Uji ukuran ticker Kecil/Sedang/Besar serta kecepatan yang berbeda.
- [ ] Uji pada Chrome PC dengan `prefers-reduced-motion: reduce` → perpindahan instan.
- [ ] Uji ketika tab TV aktif selama 15+ menit (jam terus bergerak, rotasi lancar), termasuk kembali dari tab tersembunyi.
- [ ] Tinjau scrolling apabila konten pengumuman atau alamat sekolah ekstrem panjang.

## Pengujian yang benar-benar dijalankan di lingkungan patch

- R90-B: 34/34 lulus (logika pagination, isolasi jam, sintaks TS/TSX, pemeriksaan struktur).
- Regresi R90: 24/24 lulus.
- Regresi R90-A: 23/23 lulus.
- Parser CSS: berhasil.

**Batasan:** Tanpa dependensi `node_modules`, build penuh/lint dan pengujian performa pada Smart TV fisik belum terverifikasi. Hasil uji lokal tidak menjamin frame rate perangkat yang sebenarnya.

## Rollback

Jika ditemukan regresi di Vercel Preview: revert commit R90-B, deploy kembali patch R90-A. Pengaturan di database tidak perlu dimigrasi/dikembalikan.
