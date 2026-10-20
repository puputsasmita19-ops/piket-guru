# Piket Guru — Audit Stabilitas Putaran 7
Tanggal: 21 Oktober 2026  
Basis: ZIP source terbaru `piket-guru-fix-notifikasi-update-vercel-2026-10-21.zip`.

## Ruang lingkup patch

Hanya **dua berkas aplikasi** yang diubah; Firebase Rules, API, tampilan, konfigurasi Vercel, service worker, dan sistem izin/role **tidak diubah**.

1. `src/services/offline/offlineStorage.ts`
   - Pada `IndexedDB` `versionchange`, tutup koneksi lama dan izinkan penyimpanan dibuka lagi; mengurangi masalah koneksi usang setelah pembaruan atau saat beberapa tab dibuka.
   - Penghapusan item antrean di perangkat tepercaya memakai **satu transaksi readwrite** untuk memeriksa status `SENDING`, identitas akun, dan proyek Firebase sebelum menghapus.
   - Pada perangkat bersama, penghapusan item memori tidak memaksa pembukaan IndexedDB dan tetap memeriksa pemilik serta status.
2. `src/services/offline/syncQueueService.ts`
   - Penghapusan manual memvalidasi sesi Firebase dan mengirim UID ke pemeriksaan atomik di penyimpanan; tidak lagi mengandalkan pembacaan item yang bisa menjadi usang.
   - Percobaan ulang berhenti jika akun berganti selama proses asinkron.
   - Pembaruan lease/kunci sinkronisasi antar-tab diserialkan; pelepasan kunci menunggu pembaruan yang sedang berlangsung agar tidak menghidupkan kembali kunci yang baru dilepas.
   - Pembersihan kiriman sukses juga membawa UID pemilik.

## Hasil pengujian

- **12 PASS** pada `scripts/verify_stability_round7.mjs` (input simulasi/mocks): termasuk pemilik salah, status sedang dikirim, proyek berbeda, operasi 100 UID independen, pemulihan IndexedDB setelah `versionchange`, race renewal-versus-release, dan autentikasi saat hapus.
- **20 PASS** pada `scripts/verify_flash_inval_split_local.mjs` (regresi Flash Info Inval dan responsive layout).
- **15 PASS** pada `scripts/verify_pwa_updates.mjs` (regresi update banner/service worker).
- **424 file TS/TSX** dibaca dengan parser TypeScript; **0 kesalahan sintaks**.
- `npm ci` sudah dicoba, tetapi gagal di lingkungan eksekusi (`npm error Exit handler never called`). Instalasi dependensi tidak selesai.
- `npm run lint` dicoba, tetapi tidak lulus karena banyak tipe npm belum terinstal (`TS2688 Cannot find type definition file`). **Bukan bukti bahwa kode bebas type error.**
- `npm run build` dicoba, tetapi tidak lulus karena CLI `vite` tidak tersedia (`vite: not found`). **Belum terverifikasi sebagai production build.**
- **Belum melakukan** pengujian beban simultan terhadap Firebase/Vercel yang sedang beroperasi dan belum menjalankan browser E2E produksi. Test 100 UID adalah simulasi lokal, bukan hasil kapasitas pengguna nyata.

## Instalasi patch pada repo GitHub Desktop

1. Simpan cadangan/commit keadaan repository saat ini sebelum menimpa file.
2. Ekstrak ZIP patch di luar repo; salin **folder `src/`, `scripts/`, dan `docs/`** dari patch ke **root repository**, pertahankan struktur dan pilih replace/merge file. Jangan mengganti seluruh repo dan jangan menghapus `.git` atau file lain yang tidak tercantum.
3. Di root repo jalankan `npm ci`, `npm run lint`, `npm run build`, dan `node scripts/verify_stability_round7.mjs` **setelah dependensi lengkap**. Jangan lakukan deploy jika lint/build gagal tanpa memahami penyebabnya.
4. Periksa `Changes` di GitHub Desktop. Seharusnya hanya 4 file patch yang terlihat ditambahkan/diubah (sebagaimana daftar isi ZIP); bila ada file lokal yang sudah memiliki revisi lebih baru, tinjau perbedaannya terlebih dahulu agar tidak menimpa perbaikan lain.
5. `Commit` → `Push origin`, lalu pastikan deployment Vercel `Ready` dan lakukan smoke test dengan sedikitnya dua perangkat/akun berbeda.

## Smoke test manual setelah Vercel Ready

- Login dua akun dengan izin berbeda pada perangkat terpisah; pastikan navigasi/izin tidak berubah.
- Buka akun yang sama pada dua tab, buat draf dan kiriman saat offline lalu kembali online; pastikan kiriman tidak dobel dan hanya pemilik yang dapat menghapus antreannya.
- Coba menghapus antrean berstatus `SENDING`: harus ditolak tanpa menghilangkan data.
- Periksa Flash Info Inval desktop/mobile dan banner update saat deployment berikutnya benar-benar tersedia.
- Cek konsol browser, Firebase Firestore metrics, Vercel runtime logs, dan laporan gagal sinkronisasi selama penggunaan bersamaan nyata.

Tidak ada perubahan migrasi database server, konfigurasi API, atau environment variables yang dibutuhkan untuk patch ini.
