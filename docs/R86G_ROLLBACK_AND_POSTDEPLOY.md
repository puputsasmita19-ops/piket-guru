# R86-G — Rollback & Post-deployment Smoke Tests

## Sebelum rilis

1. Catat git SHA dan ID Vercel Production terakhir yang telah teruji stabil, beserta langkah memilih deployment tersebut di Vercel.
2. Catat siapa yang berwenang menjalankan rollback dan cara menghubungi operator sekolah.
3. Pastikan pemeriksaan R86-F strict dan R86-G strict lulus pada SHA Preview yang sama.
4. Validasi semua flag R86 Preview/Production; pilot E2 tetap OFF di Production.
5. Gunakan akun pengujian dan data dummy jika perlu mengecek transaksi; jangan membuat catatan ke database sekolah aktif hanya untuk tes.

## Smoke test setelah rilis (di Production)

- Halaman login terbuka tanpa HTTP 500 atau error import ESM.
- Login dengan Nama/ID-NIP dan sesi perangkat bersama/tepercaya mengikuti aturan Admin.
- Presensi masuk dan pulang tidak menghasilkan catatan ganda.
- Daftar guru, jadwal dan buku piket dapat dimuat sesuai izin akun.
- Notifikasi penting tetap tampil; tidak menggandakan bunyi/tab tak diharapkan.
- Tab lama dibuka kembali setelah halaman disembunyikan tanpa crash, bocor sesi, atau data stale yang menyesatkan.
- Draf/foto offline tetap ada dan antrean sinkronisasi tidak hilang.
- PWA update tidak masuk loop refresh serta tidak menghapus data pending.
- Periksa Firestore Usage, error Vercel dan keluhan pengguna sesuai kebijakan internal tanpa mengekspos informasi pribadi.

## Jika terjadi insiden

1. Tahan rollout lebih lanjut; catat waktu, SHA, deployment ID dan gejala, tanpa PIN/token/foto/identitas siswa.
2. Jangan logout massal, jangan hapus `localStorage`, IndexedDB, atau Cache Storage, dan jangan unregister service worker secara paksa.
3. Jika hanya pilot E2 pada Preview terganggu, hapus parameter `r86_e2_pilot=1` dan/atau matikan flag Preview lalu **redeploy**. Jangan salah menganggap flag Vite berubah pada build lama.
4. Jika versi Production bermasalah, gunakan fitur **rollback/redeploy versi stabil yang sudah dicatat** melalui Git/Vercel sesuai hak akses operator. Jangan ubah Firebase Rules atau schema database tanpa investigasi terpisah.
5. Verifikasi kembali login, presensi, draf/foto, sinkronisasi offline, notifikasi, dan PWA pada versi hasil rollback.
6. Jika ada transaksi duplikat, lakukan rekonsiliasi hanya dengan prosedur resmi sekolah; jangan menjalankan cleanup/delete otomatis.
7. Catat hasil pemulihan dan butir perbaikan untuk rilis berikutnya.

**Penting:** `--strict` pada R86-G hanya memvalidasi dokumen/sumber lokal dan catatan bukti manusia. Alat tidak menekan tombol Vercel, tidak melakukan rollback, dan tidak menilai Firebase dalam waktu nyata.
