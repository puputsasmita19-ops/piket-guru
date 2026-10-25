# R87-S1 — Pilihan Jeda Logout Saat Aplikasi Ditinggalkan

**Pembaruan incremental — hanya pilihan durasi dan teks bantuan pada pengaturan sesi.** Basis file diambil dari source `piket-guru-main.zip` (versi aplikasi 1.0.1) yang tersedia dalam percakapan, **bukan git HEAD produksi yang dapat diverifikasi**. Periksa diff repository lokal Anda sebelum menimpa.

## Perubahan

- Pilihan terdahulu `Langsung`, `15 detik`, `30 detik`, `1 menit`, `5 menit` tetap ada.
- Tambahan `10 menit`, `15 menit`, `30 menit (direkomendasikan)`, `1 jam`, `2 jam`.
- `backgroundDelaySeconds` tetap disimpan dalam **detik**; `sanitizeSessionPolicy` mengizinkan nilai baru, tanpa mengubah kebijakan yang telah tersimpan.
- **Tidak** mengubah `AuthContext.tsx`, timer inaktivitas global 30 menit, `backgroundSession.ts`, kebijakan login/PIN/Firebase, draf offline, maupun Firestore Rules.
- Admin mendapat penjelasan bahwa jeda background dan timeout inaktivitas 30 menit adalah **dua aturan terpisah**; yang kedaluwarsa lebih dahulu dapat meminta login ulang.
- Pengaturan berlaku **per kategori perangkat** (HP/tablet vs desktop/laptop), bukan per pengguna/perangkat tepercaya.

## Rekomendasi pengaturan

- Mobile/tablet pribadi guru: ON, **30 menit**.
- Laptop pribadi: boleh OFF jika batas inaktivitas 30 menit sudah memenuhi kebijakan sekolah. Jika ON, 15–30 menit sudah memadai untuk kebanyakan alur.
- Komputer atau perangkat bersama: pilih jangka lebih singkat (5–15 menit), **tapi waspadai** saat ini setting per kelas perangkat sehingga berpengaruh ke semua pengguna desktop atau semua pengguna mobile.
- Opsi 1–2 jam disediakan atas kebijakan Admin; mungkin **tidak memperpanjang sesi** melewati timeout inaktivitas global 30 menit.
- **Nilai aktif Admin pada Firestore tidak otomatis berubah saat ZIP dipasang.** Admin harus memilih durasi baru dan menekan Simpan pengaturan sesi.

## Instalasi

1. Fetch/Pull GitHub Desktop dan buat checkpoint commit.
2. Periksa diff terhadap dua file yang akan ditimpa; bila file HEAD Anda punya perubahan lain, lakukan merge alih-alih menimpa.
3. Salin dua file `src/` pada ZIP ke path yang sama di repository, beserta skrip verifikasi pada `scripts/`.
4. `npm ci`, lalu `node scripts/verify_r87_session_delays.cjs`.
5. Jalankan `npm run lint` dan `npm run build`, hanya Push setelah keduanya lulus.
6. Uji Vercel Preview dengan akun Admin: opsi baru muncul, pilih 30 menit pada mobile, simpan, reload, pastikan tersimpan; uji ketika aplikasi tidak terlihat selama < dan > 30 menit tanpa menyentuh data produksi.
7. Uji tidak terjadi logout prematur pada perpindahan tab singkat; timeout inaktivitas 30 menit tetap bekerja; draf lokal dan antrean offline tetap utuh.

## Catatan keamanan

Tidak ada sinkronisasi otomatis antara tab pada modul ini. Sesi dan background timers tetap mengikuti implementasi existing, termasuk perbedaan antara tab background dan inaktivitas (idle). Jangan menganggap opsi 1 jam atau 2 jam menjamin sesi sampai durasi tersebut.

## Rollback

Revert dua file `src/` lewat Git pada commit patch ini. Nilai baru yang telanjur disimpan di Firestore (misal `1800`) perlu disetel ulang Admin ke nilai yang tersedia pada versi lama **sebelum** rollback, untuk menghindari sanitasi durasi tidak dikenal menjadi `0` (langsung logout jika fitur ON). Jangan menghapus cache atau antrean offline sebagai langkah rollback.
