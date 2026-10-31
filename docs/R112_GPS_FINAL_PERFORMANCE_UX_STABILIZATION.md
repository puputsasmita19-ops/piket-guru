# R112 — GPS Final Performance & UX Stabilization

## Tujuan
Membuat pengalaman Presensi GPS lebih stabil dan terasa langsung responsif pada HP, mengikuti R111. **GPS <2 detik tetap sasaran uji lapangan, bukan jaminan waktu hardware.** Tidak mengubah ambang akurasi, radius, izin lokasi, aturan presensi atau Firestore.

## Perbaikan teknis
1. **Pembatalan khusus pemanggil GPS:** `LocationService.getCurrentPosition` menerima opsi `signal?: AbortSignal`. Saat halaman Presensi pindah tab, tidak aktif, atau me-refresh pencarian, hanya subscriber milik halaman yang dibatalkan. Watcher GPS bersama dari R104-B dapat tetap melayani warm-start atau persiapan swafoto. Watcher dihentikan hanya jika tak ada lagi subscriber.
2. **Tidak ada hasil telat yang mengubah status:** setiap pembaruan halaman menggunakan `requestId` dan `AbortController`. Callback dari permintaan yang dibatalkan tidak mengubah UI.
3. **Navigasi swafoto tanpa jeda tetap 160 ms:** setelah GPS memenuhi akurasi dan radius, highlight muncul dan `requestAnimationFrame` menavigasi ke tombol. Jika tombol sudah tampak di layar, tidak dilakukan scroll yang tidak perlu. Marking "sudah dipandu" hanya setelah target ada dan halaman terlihat.
4. **Spinner langsung hilang ketika koordinat valid:** indikator pencarian tidak dipertahankan saat status Dalam Radius sudah terkonfirmasi.
5. **Kontrol akses/performa tetap:** satu GPS watcher bersama, tanpa polling/interval GPS baru, radius dari konfigurasi sekolah (saat ini 300 m), akurasi maksimum 50 m, umur koordinat dibatasi 15 detik pada UI. Check-In, Check-Out, dan swafoto tetap menjalankan validasi GPS masing-masing.

## Berkas patch
- `src/services/location/locationService.ts`
- `src/features/attendance/AttendancePreview.tsx`
- `scripts/test_r104c_mobile_gps_lifecycle.mjs` (ekspektasi pembatalan kini per-pemanggil)
- `scripts/test_r112_gps_ux_stabilization.mjs` (pengujian baru)
- `docs/R112_GPS_FINAL_PERFORMANCE_UX_STABILIZATION.md`

## Penerapan
Ekstrak ZIP **setelah R111**, tanpa mengganti file lain. Jalankan:

```bash
node scripts/test_r112_gps_ux_stabilization.mjs
node scripts/test_r104b_instant_gps_engine.mjs
node scripts/test_r104c_mobile_gps_lifecycle.mjs
node scripts/test_r111_gps_fast_warm_start.mjs
npm run lint
npm run build
```

Commit & push via GitHub Desktop dan tunggu deployment Vercel Ready. Tidak perlu mengubah `firestore.rules` maupun `vercel.json` (`sin1` tetap berlaku).

## Checklist uji HP Android
1. Izin GPS sudah diberikan, buka dashboard lalu Presensi GPS (`?gps_diag=1#attendance`) dan catat waktu GPS valid untuk lima percobaan.
2. Pastikan Dalam Radius segera tampil pada jarak <=300 m dan akurasi <=50 m. Jarak di luar radius, akurasi >50 m, atau koordinat >15 detik **tidak** mendapat status hijau.
3. Saat posisi valid, outline Swafoto terlihat dan tombol digulir ke layar **sekali**. Tidak ada kamera atau pengiriman presensi otomatis.
4. Berpindah Presensi ↔ Riwayat, lock/unlock layar, buka/tutup kamera; pastikan tidak ada pencarian menggantung, status lama, atau scroll berulang.
5. Selesaikan satu Check-In dan Check-Out pada akun uji untuk memastikan GPS benar-benar diverifikasi kembali saat aksi.

## Hasil pengujian lokal
- Skrip R112: 16/16 PASS (simulasi browser, bukan GPS hardware).
- Regresi terpilih R93–R111: 183/183 PASS.
- Total 199/199 PASS dari 11 skrip.
- TypeScript khusus `locationService.ts`: PASS.
- `npm run lint` seluruh proyek belum lulus di lingkungan ini karena paket React/Firebase dan tipe lain tidak terinstal; `npm run build` belum diverifikasi. Pengujian HP/Vercel diperlukan untuk mengukur waktu nyata.
