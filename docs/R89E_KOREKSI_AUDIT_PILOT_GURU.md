# R89-E — Koreksi Checkout Terlewat dengan Audit Trail dan Pilot Terbatas

**Acuan:** full source `piket-guru-main(2).zip` dengan patch R89-C dan R89-D diterapkan. ZIP R89-E bersifat **incremental**, bukan source lengkap. Tidak ada perubahan fitur logout otomatis, GPS/check-in, pengingat (R89-B/D), atau mekanisme penjadwalan.

## A. Perubahan fungsi

**Lokasi Admin:** `Monitoring Piket Realtime` → `Checkout Belum Tercatat · Hari Sebelumnya` → `Periksa Checkout Terlewat` → `Tinjau & Koreksi`.

1. Pastikan kasus terverifikasi server dua kali seperti R89-C (sebelum dialog dan sebelum transaksi). Jika ada duplikat / checkout sudah terisi, batalkan. Jika antrean sinkronisasi guru belum jelas, **jangan koreksi**.
2. Pada dialog, Admin wajib memasukkan **jam pulang yang dikonfirmasi**, sumbernya (langsung dari guru / catatan piket / dokumen pendukung), catatan konfirmasi 10–300 karakter, dan **alasan koreksi** 10–500 karakter.
3. Admin wajib mencentang pernyataan sudah meninjau bukti dan antrean offline. Tidak ada pilihan otomatis "jam sekarang", jam shift default, atau logout otomatis untuk mengisi pulang.
4. Koreksi khusus checkout terlewat hanya mengubah `jamPulang`, `keteranganCheckout`, `updatedAt`, dan `adminCorrection`. **`jamMasuk` asli (termasuk detik), status GPS, bukti foto, koordinat, identitas, dan tanggal dipertahankan.**
5. Audit disimpan di `auditLogs` bersama pembaruan attendance pada satu transaksi atomik; menyimpan pelaku, timestamp klien dan `recordedAt` server, `before/after`, alasan, sumber dan catatan konfirmasi. Tidak menyimpan foto penuh atau data URL.
6. Di dialog tersedia `Lihat Jejak Audit Presensi (Server)` on-demand, menampilkan riwayat edit/hapus untuk dokumen itu (maksimal 100 entri). Untuk pemeriksaan lebih lengkap gunakan `Master Data → Audit Log Sistem` dan filter `ATTENDANCE`. Audit historis tidak otomatis dibaca saat panel tertutup.
7. Firestore Rules R89-E membatasi pembuatan audit ATTENDANCE dengan action UPDATE/DELETE ke ADMIN yang sesuai `request.auth.uid`; create log presensi biasa dan log modul lain tetap berlaku. Log yang sudah ada tidak diubah; update/delete audit tetap dilarang.

**Batasan keamanan:** Firestore Rules masih mengizinkan Admin mengubah `attendance` secara langsung. Jadi audit atomik berlaku pada jalur koreksi resmi ini, **bukan jaminan semua aksi Admin di luar aplikasi diaudit**. Peningkatan berikutnya dapat mengunci setiap perubahan lewat backend terpusat. Sinkronisasi offline di perangkat guru lain tidak dapat dibuktikan hanya dengan query Firestore.

## B. Cara terapkan dan uji

1. Commit atau backup repository terakhir (sesudah R89-D). Ekstrak R89-E ke **root** repo dengan struktur `src/`, `scripts/`, `docs/`, `firestore.rules`. Hanya timpa file yang disebut dalam manifest ZIP.
2. Jalankan dari root repo:

```bash
node --experimental-strip-types scripts/test_r89b_smart_checkout.mjs
node --experimental-strip-types scripts/test_r89c_missing_checkout.mjs
node --experimental-strip-types scripts/test_r89d_checkout_reminder_settings.mjs
node --experimental-strip-types scripts/test_r89e_checkout_correction_pilot.mjs
npm ci
npm run lint
npm run build
```

3. Deploy ke **Vercel Preview** dan deploy **Firestore Rules** dari source yang telah direview (contoh Firebase CLI: `firebase deploy --only firestore:rules --project <PROJECT_ID>`; pastikan CLI mengarah ke rules yang dimaksud). **Hati-hati:** aturan Firestore berlaku terhadap database proyek, termasuk produksi, bukan hanya URL Vercel Preview. Jika Preview menggunakan Firebase produksi, gunakan akun dan data pilot yang terkendali, lakukan di waktu maintenance/review, dan siapkan prosedur rollback. Lebih aman gunakan proyek Firebase staging + rules staging.
4. Uji autentikasi GURU / ADMIN setelah rules diterapkan, termasuk check-in/out dan Audit Log normal. Jangan rilis tanpa verifikasi Firebase Rules emulator dan UAT peran nyata.
5. Untuk rollback kode, gunakan commit sebelumnya. Untuk rollback rules, deploy `firestore.rules` dari commit sebelumnya dan catat alasan/hasilnya; jangan menghapus audit yang telanjur tersimpan.

## C. Pengujian regresi (wajib sebelum pilot)

| ID | Peran | Skenario | Hasil yang diharapkan |
| --- | --- | --- | --- |
| R89-01 | Guru | Check-in lalu checkout normal di jam sekolah | Jam masuk dan pulang akurat; tidak perlu koreksi |
| R89-02 | Guru | Logout otomatis setelah check-in | Tidak menciptakan checkout maupun jam pulang |
| R89-03 | Guru | R89-B/D pengingat OFF, ON dan snooze | Pengaturan Admin diikuti; tidak melakukan checkout |
| R89-04 | Admin | Hari ini check-in belum pulang | Hanya `Belum Pulang Hari Ini`, bukan kasus historis |
| R89-05 | Admin | Satu rekaman kemarin tanpa jam pulang | Tampil `Belum Tercatat` setelah refresh server |
| R89-06 | Admin | Jam pulang sudah ada atau rekaman ganda | Tidak dapat dikoreksi dari panel terlewat |
| R89-07 | Admin | Form kosong / tidak ada bukti / checkbox kosong | Simpan ditolak, tidak ada update atau audit sukses |
| R89-08 | Admin | Waktu pulang sebelum masuk, masa depan, tanggal hari ini | Simpan ditolak |
| R89-09 | Admin | Koreksi jam valid dengan konfirmasi | Sukses; jam masuk, GPS, foto tetap; audit before/after ada |
| R89-10 | Admin | Buka `Lihat Jejak Audit Presensi` | Log koreksi terbaca dari server, alasan dan sumber ada |
| R89-11 | Admin | Edit ganda di dua tab / checkout guru saat dialog terbuka | Koreksi stale ditolak; audit tidak ditulis |
| R89-12 | Admin | Offline, kemudian kembali online | Offline diblokir; refresh server diwajibkan |
| R89-13 | Guru/non-Admin | Coba buat log ATTENDANCE UPDATE langsung | Firestore Rules menolak |
| R89-14 | Guru | Check-in/check-out normal sesudah rules deploy | Tidak tertolak oleh perubahan aturan audit |
| R89-15 | Admin | Mobile layar kecil & desktop, dark/light | Dialog, scroll, fokus dan tombol terjangkau |
| R89-16 | Admin | Dua sesi berbarengan dan pengaturan sekolah | R89-C/D, profil & GPS, jadwal tetap konsisten |

## D. Pilot terbatas yang disarankan

- **Peserta:** 5–8 guru sukarela (mewakili Android, iPhone bila tersedia, koneksi stabil dan tidak stabil) + 1 Admin + 1 petugas pengawas. Gunakan akun riil tetapi **hindari rekayasa presensi produksi**: untuk skenario konflik/duplikat gunakan staging.
- **Durasi:** 3 hari sekolah. Hari 1 uji pengingat dan checkout normal; Hari 2 uji jaringan/offline dan monitoring; Hari 3 validasi koreksi yang sudah memiliki bukti, audit, serta review Admin.
- **Pencatatan:** kode guru (tanpa menyebarkan identitas penuh), perangkat & browser, waktu mulai-selesai, hasil, screenshot tanpa data sensitif, kondisi jaringan, ID presensi/log audit, apakah retry diperlukan.
- **Kriteria lulus:** 100% koreksi yang disimpan memiliki audit before/after, alasan, sumber dan pelaku; 0 checkout otomatis karena logout/pengingat; 0 presensi asli hilang; 0 akses koreksi untuk non-Admin; 0 perubahan salah setelah data stale/duplikat; 100% skenario kritis R89-01, 02, 06–14 lulus. Angka ini adalah **target penerimaan**, bukan hasil pilot.
- **Kondisi stop:** jika ada duplikasi, audit hilang, server menolak check-in normal, koreksi tanpa konfirmasi, gangguan login, atau mismatch waktu WIB: hentikan pilot, catat kasus dan kembalikan versi stabil sampai masalah selesai.
- **Go/No-Go:** Admin dan pengawas menandatangani checklist; hanya lakukan rollout setelah seluruh blocker selesai, tes build & Rules lulus, serta guru mengonfirmasi pengalaman penggunaan.

## E. Hasil pengujian saat penyusunan

- Tes logika R89-E: 29/29 PASS (simulasi lokal + inspeksi kode). R89-B 14/14, R89-C 29/29, R89-D 37/37 PASS.
- Pemeriksaan sintaks TS/TSX dari kode yang diubah PASS.
- **Belum terverifikasi:** typecheck lint/build lengkap pada dependensi proyek, Firebase Rules emulator, Vercel Preview, operasi Firestore nyata, atau pilot guru. Jangan menyamakan hasil tes lokal dengan bukti kesiapan produksi.

## F. Manifest patch

`firestore.rules`, `src/services/firebase/adminAttendanceService.ts`, `src/features/attendance/AdminAttendanceDialog.tsx`, `src/utils/missedCheckoutCorrectionPolicy.ts`, `scripts/test_r89e_checkout_correction_pilot.mjs`, `docs/R89E_KOREKSI_AUDIT_PILOT_GURU.md`.
