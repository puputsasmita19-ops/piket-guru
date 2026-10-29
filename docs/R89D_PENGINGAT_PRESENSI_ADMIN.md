# R89-D — Pengingat Presensi (Admin)

## Lokasi

Login sebagai ADMIN > **Pengaturan Sekolah** > **Profil & GPS** > tombol pintas **Pengingat Presensi** (bagian atas tab). Kartu pengaturan berada setelah form profil dan jadwal. Simpan dengan tombol **Simpan Pengingat Presensi** pada kartunya sendiri.

## Konfigurasi

- **Aktifkan pengingat presensi pulang**: ON (bawaan), atau OFF untuk menyembunyikan seluruh pengingat R89-B di dashboard GURU.
- **Mulai ingatkan setelah jam pulang dibuka**: 0 (bawaan), 5, 10, 15, atau 30 menit sesudah `checkOutStart` sesuai jadwal shift pada hari itu. Tidak ada pengingat sebelum jam checkout dibuka; tidak menambahkan peristiwa checkout.
- **Durasi tombol Ingatkan lagi**: 10, 20 (bawaan), 30, atau 60 menit. Pilihan Admin juga menjadi label tombol di dashboard GURU.
- **Tampilkan petunjuk pada mode presensi bebas**: ON (bawaan) atau OFF. Hanya petunjuk ringan, bukan alarm berdasarkan jam.

Konfigurasi disimpan di `settings/school_config.checkoutReminderConfig`, dengan metadata `updatedAt` dan `updatedBy` dan audit pengubahan. Pengaturan lama yang belum punya field ini otomatis menggunakan nilai bawaan yang mempertahankan R89-B. Form ini menyimpan **hanya field** konfigurasi pengingat, tidak menyentuh GPS, konfigurasi presensi, profil, atau aturan jam sekolah. Profil umum juga tidak boleh menimpa field pengingat saat disimpan.

## Batasan yang disengaja

- Hanya ADMIN aktif yang dapat menyimpan. Ada validasi role server-authoritative, pilihan whitelist, validasi konflik dua Admin, dan aturan Firestore yang membatasi penulisan school_config kepada ADMIN.
- Perubahan tersedia pada dashboard guru melalui listener pengaturan sekolah Firestore; tidak membutuhkan reload pada kondisi terkoneksi. Saat offline, data bisa tertunda, sehingga tidak boleh digunakan sebagai bukti bahwa checkout belum dilakukan.
- Pengingat tampil **di dashboard saat aplikasi terbuka**; bukan push, WhatsApp, atau background alarm. Ini tidak menambahkan peringatan per guru/hari, tidak mengubah R89-C, dan tidak menciptakan checkout otomatis.
- Penundaan yang sudah dipilih guru di browser tetap berlaku hingga waktu tunda sebelumnya habis, meskipun Admin mengubah durasi tunda.
- Sesi logout otomatis tidak menyimpan jam checkout. Data presensi tetap memerlukan aksi nyata / koreksi Admin dengan audit sesuai R89-C.

## Pengujian

Jalankan dari root repository:

```bash
node --experimental-strip-types scripts/test_r89b_smart_checkout.mjs
node --experimental-strip-types scripts/test_r89c_missing_checkout.mjs
node --experimental-strip-types scripts/test_r89d_checkout_reminder_settings.mjs
npm run lint
npm run build
```

**Manual (penting di Vercel Preview):**

1. Login ADMIN, buka Profil & GPS dan pintasan Pengingat Presensi. Set OFF, simpan; akun GURU yang sudah check-in belum checkout tidak lagi menerima banner R89-B.
2. Set ON, delay 15 menit, snooze 30 menit; saat waktu hari itu >= jadwal `checkOutStart + 15 menit`, dashboard GURU menampilkan banner dan tombol **Ingatkan lagi 30 menit**. Sebelum ambang itu banner belum muncul.
3. Lakukan checkout yang valid; banner hilang. Uji status tanpa check-in, internet offline, dan rekaman historis; tidak boleh ada checkout otomatis / banner palsu.
4. Pada mode BEBAS, matikan dan nyalakan petunjuk bebas untuk memverifikasi toggle tanpa alarm jadwal. Kembalikan pengaturan yang diinginkan.
5. Dengan Admin kedua, ubah konfigurasi dan kemudian coba simpan draft lama dari Admin pertama; tampil peringatan konflik, tidak menimpa konfigurasi terkini.
6. Edit kartu pengingat saja, pastikan koordinat GPS, batas presensi masuk/pulang dan mode shift tidak berubah. Selanjutnya simpan profil sekolah dan pastikan konfigurasi pengingat tetap ada.
7. Pastikan R89-C menampilkan history missing checkout dan koreksi Admin tetap berjalan seperti sebelumnya. Cek tampilan mobile dan desktop.

## Isi ZIP incremental

```text
src/types/checkoutReminder.types.ts
src/types/index.ts
src/config/constants.ts
src/features/dashboard/checkoutReminderPolicy.ts
src/features/dashboard/SmartCheckoutReminder.tsx
src/features/settings/CheckoutReminderSettingsCard.tsx
src/features/settings/SettingsView.tsx
src/services/firebase/schoolSettingsService.ts
scripts/test_r89d_checkout_reminder_settings.mjs
docs/R89D_PENGINGAT_PRESENSI_ADMIN.md
```

Ekstrak ke root repo yang **sudah menerapkan R89-C** agar direktori `src/`, `scripts/`, `docs/` ditimpa pada lokasi yang sama. File lain tidak disertakan.
