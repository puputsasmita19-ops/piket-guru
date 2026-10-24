# Piket Guru R59 — Audit & Optimasi Foto Google Drive

24 Oktober 2026 · Paket pembaruan inkremental yang aman untuk basis R58.

## Kondisi awal yang teridentifikasi

1. **Sudah baik:** watermarkService menghasilkan JPEG terkompresi (target ~380 KB Data URL, fallback sampai ~550 KB); antrean offline menyimpan lampiran/ID operasi dan unggahan Drive menggunakan `clientPhotoId` untuk cek retry. R59 tidak mengubah algoritme kompresi, Firebase, rules atau mekanisme antrean itu.
2. **Perlu optimasi:** `AuthenticatedImage.tsx` langsung memulai pengambilan gambar privat walau foto dokumentasi berada jauh di luar viewport. Hal ini dapat memboroskan request Google Drive/Vercel saat daftar panjang di-scroll.
3. **Perlu validasi lebih awal:** `driveRoutes.ts` semula men-decode string Base64 secara permisif; Node dapat menerima sebagian string korup. Dengan payload besar, decoding memakai CPU/memori backend sebelum ukuran diverifikasi.
4. **Perlu keandalan:** proxy gambar privat tidak selalu menghentikan stream upstream jika pengguna menutup modal/berpindah halaman saat unduhan berlangsung.
5. **Perlu konsistensi metadata:** nama upload selalu `.jpg` meski MIME dinyatakan PNG/WebP.

## Perbaikan R59

- **Lazy private-image fetch** lewat `IntersectionObserver` dengan `rootMargin=250px`. Foto baru diunduh saat mendekati viewport; fallback untuk browser tanpa IntersectionObserver. Sinyal abort dan `URL.revokeObjectURL()` tetap berlaku. Efek langsung: mengurangi permintaan pada foto yang tidak pernah dilihat. Tidak berlaku untuk setiap format gambar, hanya endpoint privat `/api/drive/photo/` yang dipakai di UI. Jika fallback icon tertentu tidak menyediakan elemen observasi, komponen akan menggunakan pembacaan langsung demi kompatibilitas.
- **Strict validation foto** di backend: panjang Base64 sebelum decode, canonical Base64, ukuran maks 10 MB (batas lama), pemeriksaan *signature dasar* JPEG/PNG/WebP, kecocokan MIME, dan format watermark historis `#wtmk_v1` tetap diterima. Ini bukan pemeriksaan bahwa seluruh foto dapat didekode sebagai gambar sempurna; scanner lebih mendalam dapat ditambahkan jika diperlukan.
- **Sanitasi `clientPhotoId`** di backend untuk mencegah karakter khusus menyisip ke query idempotency Google Drive; pembatasan ID catatan hanya pada panjang dan tipe. ID yang digunakan aplikasi tetap diterima.
- **Stream download abort** ketika respons klien ditutup sebelum selesai, sehingga proses proxy tidak terus menghabiskan bandwidth apabila popup sudah ditutup.
- **Ekstensi Drive sesuai MIME**, untuk unggahan baru saja, tidak mengubah metadata file lama.

## Pengaman pemasangan

Arsip ini **tidak berisi file React lama untuk ditimpa langsung** karena source lengkap R58 belum tersedia di sesi ini. Sebagai gantinya, patcher (`scripts/apply_r59_photo_drive.cjs`) menyunting source yang benar-benar ada di repository Anda. Ia terlebih dulu mengecek *seluruh pola* source, menolak jika ada perbedaan dan mempersiapkan semua hasil sebelum satu file diubah. Installer dapat dibatalkan/revert melalui GitHub Desktop sebelum commit.

### Pemasangan

1. Pastikan repository lokal sudah memakai R58 dan tidak memiliki perubahan yang belum di-commit.
2. Ekstrak isi ZIP ini ke root repository (struktur `scripts/` dan `docs/`).
3. Dari terminal di root repository: `node scripts/apply_r59_photo_drive.cjs --dry-run`.
4. Jika tampil **R59 DRY RUN PASSED**: jalankan `node scripts/apply_r59_photo_drive.cjs`.
5. Instal dependensi: gunakan `npm ci` **jika package-lock.json ada**. Jika tidak ada, gunakan `npm install` (cek perubahan package-lock yang dihasilkan). Selanjutnya jalankan `node scripts/test_r59_photo_drive.cjs`, `npm run lint`, dan `npm run build`.
6. Baru setelah lulus, commit/push via GitHub Desktop dan pastikan Vercel Ready.

Bila tampil **R59 STOPPED SAFELY**, jangan mencoba copy source versi lama. Kirim file source terkait untuk adaptasi patch sesuai revisi aktual.

### Tes fungsi setelah deploy

- Admin/Guru: buka daftar keterlambatan/insiden berisi banyak foto. Saat gambar masih di bawah layar, pengambilan Drive harus tertunda; gulir mendekat dan foto muncul normal.
- Buka/tutup modal foto berulang saat koneksi lambat. Pastikan tidak ada crash atau foto bocor setelah logout.
- Tes unggah foto dokumentasi dengan watermark. Uji penyimpanan Drive, foto kembali dapat dilihat, dan ID foto dapat digunakan di laporan.
- Matikan jaringan setelah mengambil foto, simpan antrean offline, nyalakan lagi. Pastikan antrean lama tetap berhasil sync dan tidak membuat duplikasi (uji dengan data dummy).
- Uji foto lama di Google Drive: URL/file-id historis tetap dapat dibaca.

### Batasan dan risiko yang perlu ditinjau

- Penghematan request/biaya **belum diukur pada Firebase, Vercel, atau Drive produksi**. Ukur Network dan metrik layanan sebelum/sesudah.
- PWA cache, autentikasi, izin foto, R52 login thumbnail, dan Firestore Rules R58 **tidak diubah**.
- Tidak menghapus berkas Drive lama atau memindahkan folder (untuk menghindari kehilangan data).
- Validasi MIME dapat menolak klien lama/nonstandar yang mengirim data gambar rusak, MIME berbeda dengan isi gambar, atau Base64 yang tidak canonical. Gunakan dry-run dan staging sebelum produksi.
- Patcher hanya bisa diterapkan jika kode endpoint foto cocok dengan kontrak yang diuji pada arsip sumber sebelumnya; tidak boleh memaksa pembaruan bila menolak.

## Verifikasi lokal

- Tes JavaScript/TypeScript, validasi Base64, watermark, MIME, panjang file, serta instalasi dry-run dan penolakan source tidak kompatibel telah dijalankan pada *salinan source lama yang tersedia*, **bukan R58 produksi**.
- TypeScript lint/build penuh perlu dijalankan di komputer dengan dependensi NPM lengkap. Pada arsip sumber yang tersedia tidak ada `package-lock.json`, sehingga `npm ci` tidak dapat dijalankan; `npm run lint` menemukan paket Firebase/types Node belum tersedia dan `npm run build` terhalang karena Vite belum terpasang. Tidak ada tes koneksi Google Drive/Firebase produksi yang dilakukan.
