# Piket Guru R56 — Optimasi Listener Master Data dan Pengaturan Sekolah

**Tanggal:** 24 Oktober 2026.

## Mengapa patch R56 menggunakan skrip pemasangan?

Source terbaru **R55 tidak tersedia sebagai berkas utuh pada sesi ini**. Arsip proyek yang dapat diperiksa berisi versi lebih lama daripada revisi antarmuka R41–R55. Agar tidak menimpa perubahan penting, R56 disediakan sebagai **patcher konservatif**, bukan berkas `MasterDataTabs.tsx` / `SettingsView.tsx` dari arsip lama. Patcher membaca **source R55 yang sudah ada di repository lokal Anda**, memeriksa struktur, lalu hanya memodifikasi dua blok listener dan badge. Jika kode tidak sesuai, proses berhenti **sebelum mengubah satu pun berkas**.

## Hasil audit terhadap arsip yang tersedia

- **Master Data:** lima listener `teachers`, `staff`, `students`, `rooms` dan `incidentCategories` selalu aktif saat membuka menu.
- **Pengaturan Sekolah:** tujuh listener operasional (`users`, `schedules`, `substitutions`, `studentTardiness`, `studentPermits`, `visitors`, `announcements`) selalu aktif, padahal `users` hanya dipakai di tab `security` dan enam sumber lain di tab `lobby_tv` pada arsip yang diperiksa.
- **Jadwal Pelajaran:** memakai `teachers` dan `students` sekaligus. R56 mempertahankan **dua** listener ini saat tab Jadwal Pelajaran dibuka agar guru dan kelas tetap terisi.

## Perubahan ketika patcher sukses dijalankan pada R55

- **Master Data:** hanya membuka listener koleksi sesuai tab aktif. Jumlah badge kategori diperoleh melalui agregasi `getCollectionCount`, yang tidak mengunduh semua dokumen; ketika permintaan gagal, tampil **…**, bukan angka nol yang menyesatkan. Ketika tab dibuka, jumlah dikoreksi oleh hasil realtime. Jumlah pada tab yang belum dibuka adalah snapshot saat masuk, **bukan angka realtime**.
- **Pengaturan Sekolah:** tetap memuat dokumen konfigurasi sekolah seperti sebelumnya. Listener `users` dipasang di tab Keamanan (Admin). Enam listener operasional hanya dipasang saat tab TV Lobi dibuka.
- Menghentikan semua listener saat pengguna meninggalkan tab. Aksi edit/hapus, validasi data, autentikasi, Firestore Rules, dan berkas desain **tidak diubah**.

## Instalasi di Windows / GitHub Desktop

1. Pastikan sudah memasang R55 di repository lokal `piket-guru` dan `Changes` di GitHub Desktop bersih (commit perubahan lain lebih dulu).
2. **Ekstrak ZIP ini** ke root `piket-guru` (menambahkan berkas baru di `scripts/` dan `docs/`, tidak mengganti source Anda secara langsung).
3. Buka GitHub Desktop > Repository > Open in Command Prompt / Open in Terminal.
4. Jalankan **pengecekan aman:** `node scripts/apply_r56_listener_optimization.cjs --dry-run`.
5. Jika muncul `R56 DRY RUN PASSED`, jalankan: `node scripts/apply_r56_listener_optimization.cjs`.
6. Verifikasi: `node scripts/verify_r56_listener_optimization.cjs`, `npm ci`, `npm run lint`, `npm run build`.
7. **Jangan Push jika lint/build gagal.** Pastikan hasil GitHub Desktop Changes hanya menambah skrip & docs dan mengubah `src/features/master/MasterDataTabs.tsx` serta `src/features/settings/SettingsView.tsx`.
8. Commit dan Push origin, tunggu Vercel Ready. Uji Guru, Siswa, Jadwal Pelajaran, Keamanan, dan TV Lobi di mobile serta desktop.

Jika pengecekan menyatakan `R56 STOPPED SAFELY` karena struktur source tidak cocok, **jangan mengganti file lama dari ZIP lain**. Kirim source R55 terbaru agar patch bisa dibuat akurat.

## Status verifikasi

- Patcher **dry-run berhasil** pada arsip source lama yang dapat diperiksa.
- Patcher **aplikasi berhasil** pada salinan arsip lama; parsing TypeScript hasil modifikasi **tanpa error sintaks**.
- Fungsionalitas R55 produksi, Firestore realtime sungguhan, dan Vercel belum dapat diuji tanpa source/dependensi terbaru.
- Penghematan biaya Firebase **belum diukur** dan tidak dijamin nominal tertentu.

**Batas risiko:** ada ketergantungan lintas-tab yang mungkin ditambahkan setelah arsip lama. Patcher menolak saat pola/pemakaian data di Pengaturan berubah, tetapi pemeriksaan lint/build dan QA tetap wajib sebelum deployment.
