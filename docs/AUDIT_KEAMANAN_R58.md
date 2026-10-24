# Piket Guru R58 — Audit Keamanan, Hak Akses & Integritas Data

Tanggal: 24 Oktober 2026.

## Status verifikasi
**Audit source yang tersedia, bukan audit produksi.** Source yang dapat diperiksa pada sesi ini berasal dari arsip lebih lama daripada R57 terpasang. R58 adalah *candidate Rules hardening* yang dihasilkan dari file Rules **aktual** di checkout Anda dengan pengaman pola (fail-closed). Skrip **tidak** menerapkan Rules ke Firebase produksi secara otomatis. Perubahan Rules dapat memutus alur jika data lama tidak lengkap atau alur pergantian petugas memang perlu akses lintas akun.

## Temuan berprioritas

| Prioritas | Area | Temuan di source audit | Risiko | Kandidat R58 |
|---|---|---|---|---|
| Tinggi | `substitutions` | `allow create, update: if isStaff()` tanpa cek `petugasPiketId` | Petugas lain dapat mengubah catatan inval | Bind `petugasPiketId` pada pembuatan/perubahan, Admin boleh koreksi |
| Tinggi | `studentPermits` | Semua staf bisa create/update data yang dimiliki petugas lain | Perubahan surat izin tanpa tanggung jawab pembuat | Owner-only update; Admin override |
| Tinggi | `visitors` | Semua staf bisa edit riwayat tamu | Risiko manipulasi data dan status kunjungan | Owner-only update; Admin override |
| Tinggi | `studentTardiness` | Koreksi Admin sudah diproteksi tetapi staf selain pembuat bisa edit data biasa | Tidak konsisten dengan aturan pengelolaan data | Owner-only update; metadata correction Admin-only tetap dijaga |
| Tinggi | `auditLogs` | Klien aktif bisa create event tanpa mengikat `userId` dan `role` ke token login | Audit dapat mengatasnamakan pengguna atau Admin lain | Ikat `userId`, `role`, `id` dan format timestamp; log deskripsi tetap *untrusted* |
| Sedang | `dutyBooks` | Approver non-admin diizinkan mengubah isi jurnal bersamaan transisi status | Isi jurnal berpotensi berubah saat pengesahan | Blok perubahan field konten jurnal untuk jalur approver |
| Perlu tinjauan lanjutan | `incidents` | Kepala Sekolah punya hak update semua kolom | Perubahan reporter/konten di luar penyelesaian | **Tidak diubah** agar tidak mematahkan workflow investigasi; butuh matrix field/rules terpisah |
| Perlu tinjauan lanjutan | `notificationEvents` | Ringkasan event ditulis klien, aksi dan modul bisa dipilih klien dari nilai yang diizinkan | Tidak bisa menjadi bukti forensik satu-satunya | **Tidak diubah**; bangun server-side audit sebagai sumber otoritatif dalam tahap lanjutan |
| Perlu tinjauan lanjutan | `users` | Semua pengguna aktif dapat membaca direktori user penuh | Informasi email, NIP, nomor HP bisa terekspos secara berlebihan | **Tidak diubah**; perlukan direktori publik yang disanitasi sebelum membatasi read agar daftar guru tidak rusak |
| Terpantau baik | `attendance`, `user_credentials`, `login_ids` | Owner check-in/checkout, Admin edit, credential store ditolak dari klien | Proteksi dasar sudah ada | Tidak diubah |

## Detail tindakan kandidat

- Ubah 4 koleksi operasional menjadi: Admin boleh membuat/memperbarui semua; non-Admin hanya dapat membuat atas UID sendiri dan edit jika `resource.data.petugasPiketId == request.auth.uid`. `petugasPiketId`, identitas dokumen, `createdAt`, `createdBy`, dan flag arsip tidak boleh diganti.
- Pembaruan keterlambatan biasa tetap tidak boleh menyentuh `adminCorrection`, `isCorrectedByAdmin`, atau `menitTerlambatAsli`.
- Audit klien harus menyatakan UID/role aktual. **Tetap bukan log yang dapat dibuktikan secara independen**, karena `action`, `details` dan `metadata` masih ditulis klien. Perubahan berisiko tinggi idealnya dicatat dari backend berotorisasi/transaksi server.
- Jalur pengesahan Buku Piket oleh non-admin tidak boleh mengubah narasi isi jurnal. Alur pengembalian ke DRAFT melalui metadata revisi masih diperbolehkan.

## Cara aman memakai paket

1. Di GitHub Desktop, buat commit/tag `backup-r57`, pastikan Anda memakai repository versi R57.
2. Ekstrak R58 ke folder repository. Jangan menimpa file Rules secara manual.
3. Jalankan pemeriksaan kompatibilitas `node scripts/prepare_r58_security.cjs --dry-run`. Jika Rules disimpan sebagai `firestore.rules`, tambahkan `--rules=firestore.rules` pada perintah ini dan perintah berikutnya.
4. Bila **R58 DRY RUN PASSED**, jalankan `node scripts/prepare_r58_security.cjs`. Output hanya `security-review/r58/firestore_rules_R58_CANDIDATE.txt`; Rules aktif **tidak** diubah.
5. Jalankan `node scripts/test_r58_rule_patch.cjs` dan `node scripts/test_r58_installer.cjs`. Kedua pemeriksaan ini hanya statis dan tidak membuktikan Firestore Rules benar-benar diterapkan.
6. **Wajib** jalankan Firebase Emulator dengan kandidat Rules, lalu `node scripts/test_r58_rules_emulator.mjs` (memerlukan `npm ci`, `firebase-tools`, dan emulator berjalan lokal). Skrip emulator akan gagal jika emulator tidak aktif.
7. Uji alur normal dengan data staging: masing-masing Guru membuat dan mengedit **data miliknya sendiri**, Guru lain ditolak; Admin dapat mengoreksi; Kepala Sekolah masih dapat menyetujui buku piket tanpa mengubah isinya; QR/buku tamu, izin siswa dan pengganti shift tidak rusak.
8. Periksa record lama dengan `petugasPiketId` kosong/tidak konsisten dan alur petugas pengganti. Jika perlu mekanisme serah-terima, desain izin delegasi yang diverifikasi server **sebelum** deploy Rules.
9. Setelah emulator, lint/build dan acceptance lulus, **tinjau diff kandidat**, lalu deploy Rules secara **terpisah dan eksplisit** melalui Firebase CLI/Console. Melakukan Push Origin saja tidak otomatis menerapkan Rules.

### Contoh uji Firebase CLI

```
# 1. Dari root proyek lokal, sesudah npm ci
node scripts/prepare_r58_security.cjs --dry-run
node scripts/prepare_r58_security.cjs
node scripts/test_r58_rule_patch.cjs
node scripts/test_r58_installer.cjs

# 2. Di terminal lain, jalankan Firestore emulator secara lokal
firebase emulators:start --only firestore

# 3. Di terminal utama (PowerShell):
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
node scripts/test_r58_rules_emulator.mjs

# 4. Periksa aplikasi sebelum melanjutkan produksi
npm run lint
npm run build
```

`test_r58_rules_emulator.mjs` secara eksplisit memakai `demo-piket-guru-r58` dan hanya menerima host lokal. Ia tidak memakai Firebase produksi.

## Hasil yang bisa dibuktikan dalam sesi ini

- **26/26** pemeriksaan statis perubahan Rules: lulus pada file Rules sumber arsip yang tersedia.
- **5/5** pengujian installer (dry-run, pembuatan kandidat, tidak overwrite, kegagalan aman saat berbeda, tolak traversal): lulus.
- Pemeriksaan sintaks semua skrip Node: lulus.
- Firestore Emulator, `npm run lint`, `npm run build`, pengujian banyak akun dan verifikasi Firebase produksi: **BELUM DILAKUKAN / BELUM LULUS**. Dependensi dan lockfile proyek terbaru tidak tersedia pada sesi ini.

## Fitur yang tidak diubah

Firebase Auth, PIN/Google Login, Firestore data yang sudah ada, antrean offline R57, UI Guru/Admin, foto Drive, riwayat/presensi dan pengiriman PWA **tidak diubah oleh paket ini**. Semua perubahan bersifat kandidat Firestore Rules; belum aktif sampai Rules direview, diuji, dan dideploy secara sengaja.

### Dokumen rujukan

- [Menguji Firestore Rules pada Emulator](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Membatasi perubahan field dengan `diff().affectedKeys()`](https://firebase.google.com/docs/firestore/security/rules-fields)
