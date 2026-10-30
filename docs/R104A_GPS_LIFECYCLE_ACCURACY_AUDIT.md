# R104-A — GPS Lifecycle & Accuracy Audit

**Source baseline:** R103 (setelah R102), aplikasi Piket Guru v1.0.1.
**Tujuan:** identifikasi dan penutupan bug GPS berdampak tinggi sebelum mengubah mesin pencarian/akurasi pada R104-B.

## Konfigurasi kebijakan (TIDAK diubah)

- Radius presensi sekolah saat ini: **300 meter**, tersimpan pada `settings/school_config.allowedRadiusMeters` (bukan hardcode di patch).
- Batas akurasi GPS: **maksimum 50 meter** (`LocationService.MAX_ATTENDANCE_ACCURACY_METERS`).
- UI panduan swafoto mensyaratkan koordinat segar **≤15 detik**.
- Validasi koordinat pada pengiriman Check-In/Check-Out tetap wajib; tidak ada pengambilan swafoto atau pengiriman presensi otomatis.
- Screenshot contoh menampilkan **jarak** guru 92–137 meter, **bukan akurasi GPS**. Jarak tersebut sesuai dengan radius 300 meter.

## Jejak siklus GPS yang diaudit

1. Masuk ke Presensi GPS → memuat `settings/school_config`; izin sebelumnya `granted` dapat memulai GPS lebih awal tanpa prompt.
2. `LocationService.getCurrentPosition()` → pembacaan cepat lalu watcher akurasi tinggi, filter timestamp/akurasi, dan cache sesi sementara.
3. `AttendancePreview` → koordinat terbaru dinilai menggunakan koordinat sekolah/radius resmi, kemudian status dan highlight swafoto diperbarui.
4. Pengambilan foto → pemeriksaan ulang GPS, radius, dan timestamp sebelum watermark.
5. Check-In → bila foto lebih lama dari 30 detik, refresh GPS baru sebelum menyimpan, lalu validasi ulang di `AttendanceService`.
6. Check-Out → pemeriksaan waktu, kesegaran GPS, lalu geofence sebelum transaksi presensi pulang.
7. Unmount atau pergantian konfigurasi → watcher lokasi dan timeout harus dibatalkan serta Promise yang sedang ditunggu harus terselesaikan melalui `AbortError`.

## Temuan dan tindakan R104-A

| Risiko | Sebelum | Tindakan R104-A | Prioritas |
|---|---|---|---|
| Label *Dalam Radius* tetap hijau ketika koordinat sudah lebih dari 15 detik | Status dapat bertahan tanpa rerender | Timer satu kali mengubah label menjadi `GPS Kedaluwarsa`, menonaktifkan panduan visual berbasis koordinat lama, tanpa polling GPS | Tinggi |
| Check-Out memakai status geofence lama dari state halaman | Kemungkinan tidak sinkron dengan koordinat terbaru | Hitung geofence ulang dari koordinat yang akan dipakai, tolak semua status selain `DALAM_LOKASI` | Tinggi |
| Lapisan layanan Check-In hanya mencatat status geofence, tetapi tidak menghentikan data tidak valid sebelum upload | Guard pada UI saja tidak cukup | `AttendanceService` memeriksa kesegaran ≤30 detik dan status `DALAM_LOKASI` sebelum menyimpan | Tinggi |
| GPS dengan koordinat/akurasi/timestamp tidak valid dapat dianggap segar | `isNaN` dan fallback timestamp terlalu longgar | Validasi angka finite, batas lintang/bujur, akurasi positif, timestamp eksplisit | Tinggi |
| `watchPosition` menerima pembacaan buruk dan mungkin menyelesaikan dengan akurasi tidak valid | Cabang watcher tidak memakai validasi yang sama dengan quick GPS | Validasi `isFreshPosition` di setiap hasil watcher | Tinggi |
| Promise GPS menggantung setelah cleanup | `clearCurrentWatcher()` default tidak menolak promise | Default `AbortError`, mencegah pending promise tanpa akhir | Sedang |
| Watcher bocor ketika callback adapter browser sinkron sebelum ID watcher diterima | Callback dapat selesai lebih awal dari penugasan ID | Bersihkan ID watcher yang dikembalikan setelah callback sudah menyelesaikan permintaan | Sedang |

## Temuan lanjutan (BELUM diubah — R104-B / R104-D)

1. **Satu pencarian aktif global:** beberapa pemanggil `getCurrentPosition()` masih bisa membatalkan permintaan lain (contohnya halaman presensi, warming swafoto, pengaturan sekolah). R104-B perlu koordinasi permintaan in-flight, cancellation ownership, dan pengujian race condition. Jangan langsung menambah watcher paralel.
2. **Refinement akurasi:** masih memakai dua sumber browser (quick reading dan high accuracy watch). R104-B perlu menerapkan retry/refinement berbatas waktu, menghindari proses GPS terus berjalan saat tab tersembunyi, serta berhenti pada pembacaan yang benar-benar layak.
3. **Check-Out server dan metadata:** saat ini `AttendanceService.checkOut` hanya menyimpan waktu pulang dan `checkoutPolicy`; tidak membawa/mencatat bukti lokasi Check-Out untuk verifikasi server. Perubahan skema dan `firestore.rules` memerlukan desain dan pengujian tersendiri sebelum diaktifkan. R104-A **hanya** memperketat validasi UI Check-Out, bukan mengklaim validasi lokasi server saat Check-Out.
4. **Monitoring Admin:** rekap menampilkan jarak saat Check-In, dan data Check-In sudah memiliki `accuracy` tetapi belum ditampilkan sebagai kolom tersendiri. R104-D dapat menambah kolom akurasi/status serta waktu pembacaan; catatan Check-Out belum memiliki akurasi terpisah.
5. **Keaslian lokasi:** Geolocation API di browser tidak dapat membuktikan lokasi fisik sepenuhnya maupun mendeteksi semua bentuk GPS spoofing. Validasi angka, lokasi, dan auth mengurangi kesalahan, tetapi tidak menjamin anti-manipulasi perangkat.
6. **Pengaturan resmi sekolah:** pastikan `school_config` Firestore memang berisi radius 300m. Nilai default pada `src/config/constants.ts` tidak diganti dan tidak menjadi sumber kebenaran setelah pengaturan berhasil dimuat.

## Cakupan berkas patch

- `src/services/location/locationService.ts` — validasi, cleanup dan callback watcher.
- `src/features/attendance/AttendancePreview.tsx` — status kedaluwarsa dan Check-Out recompute.
- `src/services/firebase/attendanceService.ts` — validasi GPS Check-In pada lapisan layanan sebelum upload.
- `scripts/test_r104a_gps_lifecycle_accuracy.mjs` — tes simulasi browser + regresi statis.
- `docs/R104A_GPS_LIFECYCLE_ACCURACY_AUDIT.md` — laporan dan daftar risiko.

## Cara uji

```bash
node scripts/test_r104a_gps_lifecycle_accuracy.mjs
node scripts/test_r93_single_shot_gps.mjs
node scripts/test_r94_fast_selfie_preparation.mjs
node scripts/test_r95_smart_gps_selfie_guide.mjs
node scripts/test_r96_checkin_checkout_highlight.mjs
node scripts/test_r102_mobile_login_gps.mjs
npm run lint
npm run build
```

**Uji pada HP Android (manual):**

1. Buka Presensi GPS di dalam radius; pastikan status berubah menjadi Dalam Radius ketika akurasi ≤50m. Tanpa berinteraksi selama >15 detik, status harus menjadi GPS Kedaluwarsa; tombol Perbarui GPS tetap dapat digunakan.
2. Tekan Perbarui GPS; pastikan koordinat baru segera memperbarui status dan tombol Swafoto tetap disorot ketika layak.
3. Simulasikan sinyal buruk (di dalam gedung), pastikan akurasi >50m tidak boleh menghasilkan status Dalam Radius.
4. Ambil swafoto, lalu tunggu >30 detik sebelum mengirim; aplikasi harus memperbarui GPS namun mempertahankan foto.
5. Pada Check-Out, matikan izin lokasi atau pindah ke luar radius. Pastikan lokasi gagal tidak dianggap Dalam Radius dan Check-Out ditolak saat guard UI gagal.
6. Tutup halaman saat GPS masih mencari; buka lagi dan pastikan tidak ada loading menggantung.
7. Amati apakah Check-Out menyimpan metadata lokasi: belum pada versi ini, merupakan temuan desain untuk R104-D, bukan janji patch R104-A.

**Keterbatasan:** tes node memverifikasi logika dan sintaks tanpa Firebase maupun perangkat fisik. Build/lint penuh membutuhkan dependensi proyek terinstal (`npm ci` di mesin pengembangan/Vercel). Tidak mengubah `firestore.rules`, database, maupun setelan radius.
