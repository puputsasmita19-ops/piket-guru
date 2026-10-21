# Piket Guru R19 — Respons Klik Dialog & Pencarian

Tanggal: 21 Oktober 2026

## Tujuan
Mengurangi jeda ketika guru/admin mengetuk Berhalangan, Batalkan, Edit, Hapus, dan tombol lain di halaman Jadwal Piket. Optimasi juga diterapkan pada pilihan pencarian bersama agar daftar guru yang panjang tidak membuat dialog berat pada HP.

## File source diubah
- `src/features/schedules/SchedulePreview.tsx`
- `src/features/schedules/ScheduleFormModal.tsx`
- `src/features/schedules/OfficerPicker.tsx`
- `src/components/common/SearchableSelect.tsx`

## Detail perubahan
1. **Daftar Jadwal Piket dipisah dari siklus render dialog**
   - Daftar kartu dan baris tabel (`gridRows`, `tableRows`) di-memoize.
   - Status jadwal, penugasan pengganti, dan pembatalan tetap mengikuti `schedules`, `attendanceForDate`, dan `selectedDate`, sehingga tetap berubah saat snapshot Firestore berubah.
   - Tombol aksi kini mempertahankan callback stabil sehingga membuka/menutup dialog tidak perlu membuat ulang seluruh kartu guru dan avatar.
   - Perhitungan filter jadwal serta jumlah per hari dihitung ulang hanya saat sumbernya berubah.
2. **Form jadwal lebih ringan**
   - Daftar pos aktif, hari efektif, dan pemeriksaan konflik memiliki cache per dependensi, bukan menghitung ulang pada setiap render yang tidak relevan.
3. **Pencarian menu serupa lebih responsif**
   - Komponen `SearchableSelect` (dipakai juga oleh pilihan petugas pengganti) hanya merender 40 hasil pada kondisi awal atau 80 hasil selama pencarian.
   - Semua opsi **tetap dapat dicari**, termasuk nama, ID, dan kata kunci; pembatasan hanya jumlah hasil yang ditampilkan sekaligus.
   - Pencarian dinormalisasi sekali setiap daftar opsi diperbarui; tidak diulang untuk setiap huruf yang diketik.
   - `OfficerPicker` pada form Jadwal Piket juga membatasi jumlah elemen DOM; operasi **Pilih semua hasil** tetap mencakup seluruh hasil filter.

## Tidak diubah
- Hak akses role, validasi penugasan, audit, transaksi database, GPS, presensi masuk/pulang, subscription Firestore, dan mekanisme pembatalan.
- Tidak ada perubahan Firestore Rules, Vercel, atau skema data.

## Pemeriksaan
```bash
node scripts/verify_instant_dialogs_r19.cjs
node scripts/verify_duty_replacement_search_r15.cjs
npm run lint
npm run build
```
- Verifikasi R19: 21/21 lulus.
- Regresi R14, R15, R16, R17, R18: pemeriksaan yang dapat dijalankan lulus.
- Pemeriksaan ekspor lokal: tidak ada modul/ekspor relatif yang hilang.
- **Lint/build penuh belum lulus pada lingkungan pengujian ini**: instalasi `npm ci` gagal/terbatas dan dependensi `@types`/`vite` tidak lengkap. Wajib diverifikasi di mesin pengembang atau log Vercel.

## Catatan perilaku
Patch bertujuan mengurangi pekerjaan render dan penggunaan memori; peningkatan kecepatan aktual belum diukur pada HP maupun Vercel. Pemuatan pertama modul yang belum pernah diunduh masih dapat bergantung pada jaringan/browser. Pastikan uji klik berulang dan kasus banyak guru di perangkat nyata.
