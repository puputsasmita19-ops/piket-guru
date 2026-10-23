# Piket Guru R33 — Audit Stabilitas Multiakun & Sinkronisasi

Tanggal: 23 Oktober 2026

## Ruang lingkup
Audit terarah dilakukan pada source gabungan hingga R32 (termasuk patch perbaikan R16.1–R16.2), dengan fokus keamanan antrean lokal, pemeriksaan koneksi, serta transaksi IndexedDB saat pengguna berpindah akun. Tidak ada perubahan pada Firebase Rules, API publik, hak akses, jadwal, atau skema database.

## Masalah yang ditemukan dan diperbaiki

1. **Pemeriksaan internet berulang saat banyak komponen memanggilnya sekaligus.**
   - Sebelumnya setiap panggilan membuat permintaan HEAD baru ke `manifest.json`.
   - Sekarang permintaan yang masih berjalan dipakai bersama (*single-flight*) dan diperbarui ketika pemeriksaan sebelumnya telah selesai.
   - Batas waktu koneksi diperpanjang menjadi 4,5 detik agar jaringan mobile lambat tidak terlalu cepat dianggap tidak tersedia. Jika browser menyatakan offline, permintaan tidak dikirim.
   - Pembacaan koneksi tidak dijadikan bukti bahwa data sudah tersimpan; validasi server tetap diperlukan.

2. **Antrean tersisa dari proyek Firebase berbeda dapat tampil pada akun yang sama.**
   - Hasil baca antrean sekarang difilter menggunakan `userId` **dan** `projectId`, pada penyimpanan memori maupun IndexedDB.
   - Antrean lama tidak dibuang diam-diam. Antrean proyek berbeda hanya tidak ditampilkan/diproses di proyek aktif.

3. **Pembersihan data akun sebelumnya selesai terlalu dini.**
   - Sebelumnya penghapusan dilakukan melalui empat transaksi IndexedDB yang dijalankan tanpa menunggu selesai.
   - Sekarang penghapusan data lokal akun memakai satu transaksi lintas store dan menunggu event `oncomplete`, agar pergantian akun tidak dilakukan saat operasi lokal masih berlangsung.
   - Kesalahan IndexedDB dicatat, namun proses logout tidak dibuat macet karena masalah browser storage.

4. **Penyimpanan cache dan profil dianggap selesai setelah `put()` berhasil, bukan setelah transaksi committed.**
   - `setScopedCache()`, `saveVerifiedProfile()`, dan `clearDisplayCacheOnly()` sekarang menunggu transaksi IndexedDB selesai sebelum mengakhiri operasi.
   - Cache tampilan dibersihkan tanpa menghapus draf maupun antrean pengiriman.

## Pengujian yang dijalankan
- `node scripts/verify_stability_round33.mjs` — 10/10 lulus, menggunakan mock IndexedDB dan jaringan. Di antaranya: 100 pemanggilan pemeriksaan koneksi hanya menghasilkan satu permintaan yang berjalan, pembatasan proyek/akun, dan menunggu commit transaksi.
- `node scripts/verify_stability_round7.mjs` — 12/12 lulus, regresi perlindungan antrean dan lease antar-tab.
- `node scripts/verify_data_ownership_r32.cjs` — 25/25 lulus, struktur pembatasan pemilik & hak akses massal.
- `node scripts/verify_visitor_registration_r28.cjs` — 26 pemeriksaan lulus.
- `node scripts/verify_visitor_photo_r29.cjs` — 28 pemeriksaan lulus.
- `node scripts/verify_schedule_day_grid_r31.cjs` — 19 pemeriksaan terarah lulus.
- `node scripts/verify_build_exports_r16_2.cjs` — hubungan impor/ekspor relatif source lulus.
- `node scripts/verify_guide_onboarding_r26.cjs` — 20 pemeriksaan lulus.
- Pemeriksaan lama R22 memiliki asumsi statis tentang kode panduan sebelum revisi R24–R26; gagal pada ekspektasi lama dan tidak dijadikan indikator kerusakan baru.

**Batas verifikasi:** `npm ci` tidak bisa menyelesaikan instalasi dependensi di lingkungan ini (offline cache tidak lengkap dan registry tidak merespons). `npm run lint` terhenti pada berkas `@types` yang tidak lengkap; `npm run build` tidak menemukan `vite`. Karena itu lint/build produksi **belum terverifikasi**. Tidak ada uji beban Firebase/Vercel sungguhan maupun pengujian langsung di ponsel; patch ini bukan jaminan kapasitas atau bebas bug.

## Cara pemasangan
1. Ekstrak ZIP incremental di root repository `piket-guru` lokal. Tidak perlu menimpa `.env`, `.git`, atau source lama yang tidak berubah.
2. Dari lingkungan dengan dependensi lengkap jalankan `npm ci`, `npm run lint`, dan `npm run build`; jalankan pengujian R33 dan R7.
3. Commit dan `Push origin` melalui GitHub Desktop.
4. Pastikan deployment Vercel `Ready` sebelum menguji pada pengguna asli.
5. Uji pada dua HP / beberapa tab: antrean offline, putus-sambung jaringan, perpindahan akun, login ulang, dan data realtime. Jangan menggunakan catatan penting untuk pengujian hapus.

**Tidak diperlukan deployment Firestore Rules khusus R33.** Perubahan aturan R32 harus sudah dipasang terpisah sesuai instruksi R32.
