# Piket Guru R78 — Penyempurnaan R76 setelah Hotfix R77

Tanggal: 25 Oktober 2026.
Basis: R76 **yang sudah terpasang**, dilanjutkan **R77 yang sudah memperbaiki Dashboard**.

## Penting: jangan memasang ulang ZIP R76 lama

R76 memasang fitur watermark ringkas, sapaan dan login nama panjang, pengaturan Admin, dan 21 dropdown mobile. R77 memperbaiki `sanitizeNameMarqueeConfig(undefined)` yang sebelumnya membuat Dashboard gagal dimuat. **Jika ZIP R76 lama ditimpa di atas R77, error Dashboard akan muncul kembali.**

R78 dibuat khusus **di atas R77**. Paket incremental ini *tidak menimpa* `src/types/dashboardInfo.types.ts`; regression checker **menolak source yang belum memiliki perbaikan R77**.

## Penyempurnaan yang dilakukan

1. `OverflowName.tsx` + `index.css`: nama panjang tetap dapat dibaca dan turun baris saat animasi marquee dimatikan oleh Admin, serta saat perangkat menggunakan `prefers-reduced-motion`. Tidak ada perubahan interval animasi yang sudah disimpan.
2. `DashboardWelcome.tsx`: ulangi pengukuran penempatan nama setelah webfont selesai dimuat; lepaskan listener saat unmount. Mencegah hasil pengukuran awal yang tidak akurat pada ponsel dengan font lambat.
3. `MobileChoiceSelect.tsx`: saat pilihan berubah menjadi disabled atau akun kehilangan hak, opsi tidak bisa disimpan dari dialog lama; dialog otomatis ditutup saat kontrol dinonaktifkan. `optgroup disabled` juga dihormati. Ketika bidang wajib tidak dipilih pada mobile, pemilih terbuka agar pengguna dapat memperbaikinya. Nilai enum yang dikirim ke handler tetap identik.
4. `verify_mobile_ux_r76.cjs`: menyesuaikan tes regresi lama agar menerima guard tambahan tanpa mengubah cakupan dasar.
5. `verify_r78_r76_r77_compat.cjs`: uji khusus kecocokan konfigurasi lama, pilihan mobile, Pause, watermark, dan preferensi nama. Termasuk pengujian sanitizer R77 dengan nilai kosong yang dahulu menyebabkan crash.

Semua fitur R76 lainnya **tetap**: watermark foto ringkas, tombol Pause di bawah avatar dan terpisah dari teks, teks berjalan di Dashboard + Login, pengaturan Admin, 21 pemilih pilihan dalam 10 formulir. Tidak ada perubahan Firestore, aturan akses, upload Drive, maupun format rekaman.

## Pemeriksaan yang telah dilakukan

- `verify_mobile_ux_r76.cjs`: **34/34 PASS**.
- `verify_hotfix_r77.cjs`: **19/19 PASS**.
- `verify_r78_r76_r77_compat.cjs`: **31/31 PASS**.
- Regresi R73 **22/22**, R74 **20/20**, R75 PWA **18/18**, R75 UI **26/26**: PASS.
- CSS `src/index.css`: tidak ditemukan error parsing top-level.
- `npm ci --offline`: BLOCKED karena paket `yargs-parser@21.1.1` tidak tersedia di cache.
- `npm run lint`: tidak berhasil diverifikasi karena dependency tipe React/Firebase/Node belum terpasang.
- `npm run build`: tidak berhasil diverifikasi (`vite: not found`).
- Belum ada uji melalui Firebase/Vercel produksi, perangkat Android/iOS asli, atau build dari commit aktual milik sekolah.

## Pemasangan

1. **Pastikan Dashboard dapat dibuka** pada R77 dan buat checkpoint GitHub Desktop.
2. **Jangan** ekstrak ulang ZIP R76 lama.
3. Ekstrak ZIP R78 incremental ke root repository `piket-guru`, timpa hanya file yang disebutkan di arsip.
4. Jalankan di terminal repository:

```bash
npm ci
node scripts/verify_hotfix_r77.cjs
node scripts/verify_mobile_ux_r76.cjs
node scripts/verify_r78_r76_r77_compat.cjs
npm run lint
npm run build
```

5. Jika semuanya lulus, lakukan Commit dan Push secara manual. Pastikan deployment Vercel Ready dan sesuai commit R78.
6. Uji Dashboard dan Login dalam dua kondisi: dengan pengaturan teks berjalan ON dan OFF, nama panjang, serta `prefers-reduced-motion`. Uji modal Laporan Kejadian dan Siswa Terlambat saat field wajib belum dipilih serta ketika dropdown tidak boleh diubah.

## Stop / rollback

Jika `verify_hotfix_r77.cjs` gagal, jangan push: source Anda mungkin masih memiliki bug R76 lama. Terapkan kembali **hanya hotfix R77**, bukan semua file R76.

Jika build atau operasi gagal, rollback perubahan R78 menggunakan GitHub Desktop dan kembali ke commit R77 yang diketahui berfungsi. Jangan membersihkan IndexedDB, storage browser, atau antrean offline untuk troubleshooting UI.
