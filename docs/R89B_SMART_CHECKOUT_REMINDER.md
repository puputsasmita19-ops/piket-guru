# R89-B — Smart Checkout Reminder (Dashboard Guru)

## Implementasi
- Komponen `SmartCheckoutReminder` dipasang hanya untuk role `GURU` di Dashboard Guru dan hanya jika mempunyai izin `ATTENDANCE_VIEW`.
- Sumber kebenaran untuk guru: **listener 1 dokumen** dengan ID deterministik `att-{YYYY-MM-DD}-{userId}` (sesuai implementasi check-in existing). Mengaktifkan `includeMetadataChanges` dan **hanya** menampilkan CTA bila `fromCache=false` dan `hasPendingWrites=false`, online, serta dokumen milik guru/tanggal tersebut. Data query dashboard yang mungkin berasal dari cache hanya dipakai untuk mendeteksi ID legacy yang ambigu.
- Berbasis `Asia/Jakarta`. Mode TERJADWAL mulai mengingatkan pada `checkOutStart` selama tanggal yang sama, termasuk setelah `checkOutEnd` (checkout existing tetap menerima checkout terlambat). Jika jadwal nonaktif, reminder tidak muncul.
- Mode BEBAS tidak menetapkan batas waktu baru; hanya menampilkan pintasan tenang ketika guru sudah check-in.
- Tombol **Presensi Pulang** hanya menavigasi ke halaman presensi existing. GPS, validasi jendela, dan transaksi Firestore tetap dilakukan di sana.
- Tombol **Ingatkan lagi 20 menit** menyimpan angka batas waktu lokal dengan identitas pengguna+tanggal. Tab lain pada origin yang sama disinkronkan via `storage`. Penyimpanan gagal tidak menggagalkan snooze selama tab aktif. Tidak ada token ataupun payload presensi di LocalStorage.
- Tidak ada popup berulang, push notification, checkout otomatis, modifikasi Firebase Rules, atau perubahan antrean offline.
- Status offline tidak dianggap checkout otomatis dalam antrean. Jika ada cache check-in tetapi server belum dapat diverifikasi, hanya tampilkan keterangan informasional, bukan CTA agresif.
- Kasus tanggal sebelumnya belum checkout tetap menjadi ranah R89-C/koreksi Admin, bukan checkout mundur tanggal dari dashboard.

## Cara menerapkan
1. **Backup/commit HEAD** yang digunakan untuk deploy; cek diff agar tidak menimpa pekerjaan lain.
2. Ekstrak patch incremental di **root** repo agar struktur `src/`, `scripts/`, `docs/` tetap utuh.
3. Jalankan `node --experimental-strip-types scripts/test_r89b_smart_checkout.mjs` (Node 22+) lalu `npm ci`, `npm run lint`, `npm run build`.
4. Uji dengan akun guru di Vercel **Preview**: sebelum/tepat/setelah `checkOutStart`, sudah checkout, mode BEBAS, dua tab + snooze, offline/reconnect, tab bangun dari tidur, pergantian tanggal WIB, GPS mati/di luar radius, serta koreksi Admin.
5. Periksa aturan Firestore deploy dan hasil audit R89-A terhadap HEAD, lalu rilis produksi hanya setelah lulus UAT.

## Hasil validasi di lingkungan pembuat patch
- **PASS**: 14/14 pengujian fungsi klasifikasi dan durasi snooze (`scripts/test_r89b_smart_checkout.mjs`).
- **PASS**: pemeriksaan sintaks via TypeScript `transpileModule` untuk ketiga file `.ts/.tsx` yang berubah.
- **BLOCKED**: `npm ci` tidak dapat menyelesaikan unduhan registry npm (`EAI_AGAIN`), sehingga `npm run lint` dan `npm run build` belum dapat dinyatakan lulus.
- **NOT RUN**: UAT Firestore online, Android/desktop, dan Vercel Preview/Production. Tidak ada transaksi produksi yang dieksekusi.

## Batasan
- Reminder hanya di dashboard saat pengguna login dan aplikasinya terbuka. Tidak membangunkan ponsel yang ditutup dan tidak mengirim push.
- Jam pengingat menggunakan jam perangkat yang dinormalisasi ke WIB. Jika jam perangkat salah, waktu muncul reminder bisa bergeser; **jam checkout tetap ditetapkan transaksi server existing**, tidak digantikan jam reminder.
- Penggunaan 1 listener dokumen tambahan saat Dashboard Guru terbuka dapat menambah sedikit pembacaan Firebase; tidak ada polling koleksi baru.
