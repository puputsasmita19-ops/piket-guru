# Piket Guru — Patch R30: Jadwal Piket Responsif dan Ringkas

**Lingkup:** Menu Jadwal Piket Guru & Staff (mobile dan desktop). Paket incremental; hanya `SchedulePreview.tsx` yang mengganti kode aplikasi.

## Perbaikan

1. **Pergantian hari lebih responsif**
   - Penanda hari terpilih diperbarui terlebih dahulu, sementara daftar jadwal diproses melalui pembaruan tertunda React (`useDeferredValue`).
   - Status piket dan pengecualian harian (pembatalan/pengganti) dihitung melalui indeks sekali per tanggal, bukan mencari ulang seluruh data untuk setiap kartu.
   - Filter diawali dengan jadwal yang benar-benar ada pada hari terpilih.
   - Respons data presensi Firestore tetap realtime, dengan penanda tanggal untuk mencegah data hari lain dipakai saat berpindah cepat.
   - Ketika pergantian belum selesai, tampil pesan singkat agar tombol dari tanggal sebelumnya tidak dapat ditekan secara keliru.

2. **Tanggal Pemantauan hanya role ADMIN**
   - Form pilihan tanggal dan keterangan perubahan status tidak tampil untuk role lain.
   - Guru tetap dapat memilih hari SENIN–SABTU; tanggal kerja yang dipakai di belakang layar mengikuti hari pilihan.
   - Validasi akses server dan izin perubahan jadwal tidak dilonggarkan.

3. **Kartu jadwal lebih hemat ruang pada HP**
   - Foto, nama guru, lokasi, jam shift, dan status diringkas.
   - Catatan biasa bisa dibuka melalui `Catatan tugas`, bukan selalu mengisi kartu.
   - Info penting seperti pembatalan dan penggantian tetap langsung terlihat.
   - Tombol bantuan/WhatsApp serta tindakan Admin dipertahankan dengan layout lebih rapat.

## File
- `src/features/schedules/SchedulePreview.tsx`
- `scripts/verify_schedule_mobile_r30.cjs`
- `docs/CHANGELOG_JADWAL_MOBILE_R30.md`

## Verifikasi

`node scripts/verify_schedule_mobile_r30.cjs`

Pemeriksaan ini mencakup sintaks, struktur role, pemilihan tanggal aman, dan kesetaraan lookup presensi. Ini **bukan pengujian beban nyata perangkat Android**.

## Instalasi
Salin isi ZIP ke repository lokal, periksa perubahan, jalankan `npm ci`, `npm run lint`, `npm run build` jika lingkungan lokal tersedia, lalu Commit dan Push ke GitHub Desktop. Periksa status Vercel **Ready** dan uji klik hari berulang pada HP.
