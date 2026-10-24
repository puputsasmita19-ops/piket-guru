# Piket Guru R68 — Audit Source Terbaru, Multi-User, Offline & Privasi

**Basis:** Arsip `piket-guru-main.zip` yang diberikan pengguna pada 24 Oktober 2026, setelah R67. Source kode aplikasi, Firestore Rules, skrip dan konfigurasi diperiksa tanpa membaca isi backup sekolah. **R68 adalah patch incremental** dan hanya berisi berkas yang diubah/ditambah.

## Temuan aktual dan penyelesaian

| Prioritas | Temuan dari source aktual | Perubahan R68 | Batasan |
| --- | --- | --- | --- |
| Tinggi | `StudentTardyService.getBatchRecordId` memasukkan batchRequestId dalam ID. Dua HP bisa mencatat siswa+tanggal yang sama dengan ID berbeda setelah sama-sama membaca tanggal kosong. | ID batch baru **kanonis `trd-<tanggal>-<studentId ter-encode>`**, bukan berdasarkan ID permintaan. Penulisan memanfaatkan CAS `FirestoreService.setDocument(...,{expectedState})` yang sudah menggunakan transaksi. Pengiriman ulang dengan batch sama idempoten, batch lain ditolak. Antrean lama yang masih menyimpan ID batch dinormalisasi dengan pengecekan data lama. | Aturan Firestore sekarang belum memaksa ID kanonis; klien lama yang belum update masih bisa membuat ID lama. Ini mitigasi untuk klien baru, bukan jaminan universal exactly-once dari semua versi. Uji emulator lintas perangkat sebelum deployment besar. |
| Tinggi | `src/server/app.ts` masih mencetak isi beberapa request API (bukan cuma metrik), berisiko mencatat informasi pribadi. | Pasang middleware sanitasi R60 yang hanya mencatat kategori endpoint, kelas status HTTP dan kelompok waktu respons tanpa isi, URL, atau nama. | Vercel bisa menyimpan log lama berdasarkan kebijakan retensinya; tinjau dan kelola retensi secara terpisah. |
| Tinggi | Backend menyajikan `/artifacts` tanpa autentikasi dan `public/artifacts/` mengandung berkas audit untuk Vite public-dir. | Endpoint `/artifacts` menjadi 404. Plugin Vite menghapus `dist/artifacts` dari hasil build. `.gitignore` mengabaikan berkas backup/artefak baru. | **File yang sudah terlacak Git harus di-untrack secara terpisah**; `.gitignore` tidak menghapus file dari riwayat Git atau deployment lama. |
| Sedang | R56 ditambahkan sebagai installer tetapi source `MasterDataTabs`/`SettingsView` belum dimodifikasi; 5/18 pemeriksaan lulus. | Terapkan R56 langsung ke dua file source. | Pengukuran penghematan pembacaan Firebase produksi belum tersedia. |
| Sedang | R57 modul `pwaUpdateSafety.ts` belum ada; risiko reload saat antrean/draf masih aktif. | Terapkan R57 ke banner update dan modul safety. | Perilaku browser/IndexedDB produksi tetap perlu diuji di HP sungguhan. |
| Sedang | R59 optimasi gambar masih berupa skrip; template upload belum aktif. | Terapkan R59 ke AuthenticatedImage, route/DriveStore dan validasi server. | Foto/Drive API produksi belum diuji dengan koneksi asli. |
| Sedang | Release gate R60 hanya mengenali marker R61 dan menolak formulir R67 meskipun sudah ada perbaikan; metrik R60 belum terpasang. | Release gate menerima marker R67 dan wajib menjalankan R68 security/duplikasi. Import dan pemasangan metrics serta browser diagnostics dilengkapi. | Gate preflight lulus bukan berarti lint/build/staging lulus. |

## Status pengujian dalam lingkungan audit

- Semua file TypeScript/TSX sumber diparsing dengan TypeScript API global: tidak ada kesalahan sintaks.
- R68 uji dua pengguna dan transisi antrean lama: **13/13 lulus** memakai dummy database atomik, tanpa Firebase/Drive produksi.
- R68 sanitasi server logs/pengamanan artefak: **14/14 lulus** memakai request dummy, tanpa akses jaringan produksi.
- R60 release gate unit tests: **18/18 lulus**, R68 preflight source: **15/15 lulus** (`releaseReady` masih **false**).
- Regresi R55, R56, R57, R59, R60, R66, R67, dan simulasi 50 pengguna lokal diperiksa; lihat output pemeriksaan terlampir di dokumentasi pengguna bila dibutuhkan.
- `npm ci --offline` **gagal** karena `yargs-parser@21.1.1` tidak tersedia dalam cache. Percobaan instalasi online tidak selesai pada runtime ini.
- `npm run lint` **belum lulus** karena paket deklarasi tipe tidak terinstal (`@types/express`, dll.).
- `npm run build` **belum lulus** (`vite: not found`) karena dependensi tidak terinstal.
- **Belum** menjalankan Firestore Emulator, Firebase staging, aplikasi produksi, ataupun uji HP nyata. **Jangan menyatakan siap beban tinggi/GO sebelum tahapan tersebut sukses.**

## Pemasangan di repository setelah R67

1. **Cadangkan / commit checkpoint** sebelum mengubah source. Pastikan semua antrean offline tersinkronisasi.
2. Ekstrak ZIP incremental R68 ke root repository `piket-guru`. Berkas berisi struktur path asli (tanpa backups/artifacts/rahasia).
3. Buka terminal repository dan jalankan:

   ```sh
   npm ci
   node scripts/test_r68_tardy_multidevice.cjs
   node scripts/test_r68_privacy.cjs
   node scripts/r60_release_gate.cjs --preflight
   npm run lint
   npm run build
   ```

4. **Jika tes gagal, jangan push** ke branch yang langsung men-deploy Vercel. Jika lulus, Commit/Push, tunggu Vercel Ready, uji role Admin/Guru, upload Drive, formulir 320–390px, antrean offline, dan pembaruan PWA.
5. Untuk 20–50 pengguna sungguhan, gunakan **Firebase Emulator atau staging terpisah**, bukan produksi. Test case wajib: dua HP mencatat siswa dan tanggal sama; satu berhasil, lainnya menunjukkan duplikasi, tidak ada dua dokumen. Juga tes satu HP offline (batch lama) kemudian sinkronisasi saat catatan sudah ada; jangan membuat catatan kedua.

## Penanganan backup/arsip yang ditemukan di Git source

Arsip yang diberikan mencakup beberapa file backup dan bundel audit di `backups/`, `backup-pre-purge.json`, `artifacts/`, serta `public/artifacts/`. **Saya tidak menyertakan isinya dalam patch.** Hindari menyimpan backup berisi data sekolah pada repository publik atau aset web.

Jika file sudah terlacak Git, `.gitignore` baru tidak cukup. Setelah memindahkan salinan backup ke penyimpanan privat, di terminal root repo gunakan **jika sesuai kebijakan sekolah**:

```sh
git rm -r --cached --ignore-unmatch backups backup-pre-purge.json artifacts public/artifacts
```

Perintah ini menghapus berkas dari pelacakan Git **tanpa menghapus salinan lokal**, tetapi harus di-commit untuk menghentikan penyertaan di checkout/deployment baru. Berkas mungkin tetap dapat ditemukan melalui **riwayat Git, arsip publik lama, atau deployment terdahulu**; audit akses dan penanganan penghapusan riwayat/rotasi rahasia bila relevan dilakukan terpisah.

## Pekerjaan keamanan lanjutan (belum diubah)

- `firestore.rules` pada `/auditLogs` mengizinkan create untuk setiap pengguna aktif tanpa mengikat `request.resource.data.userId` dan role secara eksplisit. Service klien sendiri memeriksa UID, tetapi rules belum menolak klien yang dimodifikasi. Perlu kandidat Rules dan tes Firebase Emulator sebelum deployment, khususnya kompatibilitas antrean audit offline.
- Aturan `/studentTardiness` belum memastikan penggunaan ID dokumen kanonis untuk semua versi klien; perlu strategi migrasi antrean lama dan tes Firebase Emulator sebelum menerapkan validasi ID di Rules.
- Uji observabilitas log Vercel, pengendalian biaya Firestore, penggunaan memori mobile dan toleransi network real belum dilakukan.
