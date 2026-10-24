# Piket Guru R60 — Pengujian Beban, Monitoring Error & Stabilitas Produksi

**Tanggal:** 24 Oktober 2026 (WIB). **Basis implementasi:** source yang tersedia lebih lama daripada R59 produksi; patcher dibuat untuk **menolak source berbeda**, bukan menimpa perubahan sebelumnya.

## Tujuan dan temuan source

1. **Request logger lama** di `src/server/app.ts` mencatat `sanitizedBody` untuk endpoint `/api/` selain Drive, dengan hanya beberapa field PIN direduksi. Field lain dapat memuat informasi identitas, sekolah, atau lokasi. **R60 menggantinya** dengan log kategori API (`auth`, `drive`, dll.), status class (`5xx`, `4xx`), indikator 429 dan rentang durasi; tanpa body, URL, path dinamis, header, user ID, GPS, nama, PIN, atau stack.
2. Source memiliki endpoint kesehatan **`GET /api/health`** yang menguji kesiapan limiter auth. **R60 tidak membuat endpoint kesehatan baru**, tetapi menyediakan pemeriksaan satu kali yang read-only dengan validasi URL dan konfirmasi eksplisit untuk domain produksi.
3. Source juga telah memiliki pengujian konkurensi sintetis (`scripts/verify_concurrent_operations.mjs`) dan mekanisme retry/kunci antrean. **R60 tidak mengganti transaksi dan antrean yang sudah berjalan**.
4. Ada error di browser yang tidak dapat terlihat dari log Vercel. R60 memasang penghitung error lokal, jaringan offline/online, LCP tinggi, dan CLS tinggi. Tidak ada fetch/beacon, penyimpanan lintas sesi atau payload pribadi; pengguna perlu mengecek DevTools pada perangkat terkait. Ini **bukan dashboard terpusat**.
5. Logger server dibatasi maksimum **60 event per menit per instance** untuk mengurangi banjir log. Instance baru/berbeda memiliki kuota tersendiri; hitungan event bukan total kesalahan produksi.

## Isi patch incremental

- `scripts/apply_r60_diagnostics.cjs`: installer aman (dry-run, verifikasi pola, rollback ketika gagal menulis, menolak pemasangan berulang).
- `scripts/r60_templates/r60ApiRequestMetrics.ts`: middleware log backend.
- `scripts/r60_templates/r60BrowserDiagnostics.ts`: agregasi kejadian di browser, *tanpa pengiriman data ke server*.
- `scripts/r60_synthetic_load.cjs`: tes beban sintetis loopback 127.0.0.1, default 50 user, maksimal 100 user; tidak menerima URL eksternal.
- `scripts/r60_health_probe.cjs`: tepat satu permintaan GET `/api/health`, tanpa cookie/login/token/query, tidak mengikuti redirect.
- `scripts/r60_log_summary.cjs`: menghitung kejadian dari log Vercel yang sudah disalin ke file lokal (maks 10 MB), tanpa menampilkan isi log mentah.
- Tiga skrip tes dan dokumen ini.

**Setelah installer berhasil**, empat file pada repository akan berubah/bertambah:
- MODIFY `src/server/app.ts`
- MODIFY `src/main.tsx`
- CREATE `src/server/middleware/r60ApiRequestMetrics.ts`
- CREATE `src/services/monitoring/r60BrowserDiagnostics.ts`

## Instalasi pada repository R59

1. Buat checkpoint GitHub terlebih dahulu; gunakan branch percobaan jika memungkinkan.
2. Ekstrak ZIP ke root `piket-guru` yang sudah menggunakan R59. **Jangan** copy source lama dari fixture R60 atau arsip sebelumnya.
3. Jalankan:

```sh
node scripts/apply_r60_diagnostics.cjs --dry-run
```

   Jika menghasilkan `R60 DRY RUN PASSED`, lanjut:

```sh
node scripts/apply_r60_diagnostics.cjs
node scripts/test_r60_diagnostics.cjs
node scripts/test_r60_health_probe.cjs
node scripts/test_r60_log_summary.cjs
node scripts/r60_synthetic_load.cjs --users 50 --concurrency 25
npm ci
npm run lint
npm run build
```

4. Jika source tidak sesuai, skrip berhenti dengan `R60 STOPPED SAFELY` tanpa perubahan. **Jangan push**; perlu penyesuaian terhadap file terbaru.
5. Pastikan build penuh lulus sebelum Commit / Push Origin dan tunggu Vercel **Ready**.

## Pemantauan setelah deployment

- Periksa **Vercel → Logs** (atau log runtime sebenarnya), cari `[R60_HTTP]` untuk `5xx`, `429`, atau respons lambat di atas 3 detik. Contoh hanya label: `{"schema":"R60_HTTP_V1","group":"drive","statusClass":"5xx","rateLimited":false,"duration":"3-10s"}`.
- Jika Anda mengekspor log ke file teks, jalankan `node scripts/r60_log_summary.cjs --file logs-r60.txt`. Skrip hanya membaca kejadian R60 dan mengeluarkan angka agregat.
- Di perangkat guru: buka DevTools → Console untuk ringkasan lokal `[R60_CLIENT]` ketika halaman ditutup/dimuat ulang. Ringkasan tidak dikirim secara terpusat dan tidak menyebut nama/ID.
- Lakukan pemeriksaan kesehatan **satu kali** setelah deployment:

```sh
node scripts/r60_health_probe.cjs --url https://DOMAIN-VERCEL-ANDA/api/health --i-understand-production
```

   Permintaan ini **hanya GET** dan tidak menulis ke database. Jika status `503`, periksa kesiapan limiter auth; jangan berulang kali menjalankan uji beban untuk mendiagnosisnya.

## Pelaporan contoh pada pengujian lokal

Pada mock loopback terpisah, 50 identitas sintetis menghasilkan:

| Indikator | Contoh hasil uji lokal |
| --- | ---: |
| Pengguna simulasi | 50 |
| Operasi logis (50 masuk + 50 pulang) | 100 |
| Permintaan klien duplikat | 200 |
| Retry akibat 503/504 | 16 |
| Operasi tertulis di mock | 100 (tanpa duplikasi) |
| Gagal setelah retry | 0 |
| P95 dari klien mock lokal | ~53 ms |

**Semua angka di atas hanya dari server mock satu mesin, bukan Firebase/Google Drive/Vercel produksi.** Latensi asli dan biaya Firebase tidak dapat disimpulkan dari sini.

## Uji penerimaan dengan staging/Emulator (belum dijalankan)

- Gunakan Firebase Emulator atau proyek staging terisolasi dengan akun dan data sintetis. Pastikan tes tidak mengarah ke Firebase produksi.
- Lakukan 20 kemudian 50 sesi browser sintetis pada jaringan terkontrol, verifikasi presensi masuk/pulang masing-masing sekali, dan cek konflik pada retry/cabang tab.
- Simulasikan offline 30 detik, ulang kirim dengan operationId yang sama, lalu login kembali dan periksa hasil sinkronisasi.
- Coba edit Guru terhadap data Guru lain: harus ditolak oleh backend/Rules, bukan sekadar tombol yang disembunyikan. Periksa audit Admin.
- Cek Vercel Logs, Firebase Metrics (read/write), timing pada HP nyata dan error rate dari total request. **Logger R60 hanya event bermasalah; tidak cukup untuk menghitung persentase error.** Gunakan Analytics platform untuk denominator.
- Pastikan `node scripts/verify_concurrent_operations.mjs` serta skrip regresi lain milik aplikasi lulus setelah `npm ci`.

## Saran ambang kewaspadaan awal (bukan SLA yang sudah tercapai)

- HTTP 5xx: tinjau segera setiap lonjakan, bukan angka absolut semata.
- Banyak 429 auth: periksa abuse, login berulang atau konfigurasi limiter; jangan melonggarkan auth tanpa investigasi.
- Banyak endpoint `drive` dengan rentang `3-10s` / `gte10s`: periksa koneksi dan API quota Google Drive.
- LCP > 2,5 detik atau CLS > 0,1: periksa di perangkat; diagnostik R60 hanya menandai kategori, bukan mengirim data mentah.
- Kenaikan Firestore reads tanpa kenaikan pengguna: audit listener/indeks seperti R55–R56.

## Privasi, batasan dan rollback

- Tidak mengubah Firestore Rules, Firebase auth, data sekolah, antrean offline, schema database, maupun layanan foto R59.
- Logger lain milik aplikasi mungkin masih perlu audit privasi secara menyeluruh. R60 hanya mengganti logger umum `src/server/app.ts` yang cocok dengan source tersedia.
- Browser telemetry lokal tidak menyediakan alert otomatis lintas perangkat. Untuk alert produksi nyata dibutuhkan observability provider resmi dan kebijakan privasi/izin yang sesuai.
- R60 tidak mengklaim lulus build produksi: dependensi NPM lengkap tidak ada pada lingkungan audit ini.
- Rollback: revert commit R60 di GitHub lalu push. Tidak ada migrasi/rollback data yang diperlukan.
