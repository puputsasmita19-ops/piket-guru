# Piket Guru R86-F — Final Multi-Tab Security, Stability & Performance Regression

**Lingkup:** validasi final implementasi R86-A/B/C/D/E1/E2/E3. **Paket hanya menambah `scripts/` dan `docs/`; tidak menimpa `src/`, Firestore Rules, Firebase, sesi, atau antrean offline.**

**Status bukti saat paket disusun:** semua uji Firebase live/staging dan perbandingan E3 pengguna **BELUM TERSEDIA**. Pengujian 19/19 lulus pada fixture sintetis adalah tes _alat gate_, **bukan** kelulusan R86-F pada aplikasi pengguna. 

## Keputusan rilis

- **NO-GO** jika source fitur, Git SHA, E3 1/2/3/5 tab, lint/build, atau skenario manual kritis belum lulus / belum dibuktikan.
- **GO_FOR_SEPARATE_RELEASE_REVIEW** jika file lengkap, hasil E3 tidak memuat warning, reviewer mencatat semua pemeriksaan PASS dengan bukti, dan memberi persetujuan tertulis. Ini **bukan** otorisasi otomatis mengaktifkan pilot E2 di Production.
- Tidak boleh memakai angka `onSnapshot` atau callback R86-C/E3 untuk mengklaim jumlah billed Firestore reads. Perbandingan Firebase Usage membutuhkan panel/tagihan Firebase, trafik setara, dan interpretasi terpisah.
- `VITE_R86E2_REPORTS_PILOT` tetap harus **tidak diaktifkan di Production** sampai ada keputusan rilis terpisah yang mendukungnya.

## Isi ZIP

- `scripts/r86f_release_gate.cjs`: audit read-only source, SHA Git, E3 comparison JSON, bukti staging, dan keputusan final.
- `scripts/verify_r86f.cjs`: pengujian keamanan logika gate menggunakan _fixture sintetis di folder sementara_; tidak menyentuh repository pengguna.
- `docs/R86F_STAGING_EVIDENCE_TEMPLATE.json`: template status `NOT_RUN` yang harus diisi setelah uji nyata.
- `docs/R86F_REGRESSION_MATRIX.md`: daftar skenario dan cara bukti.
- `docs/R86F_CHECKLIST_CURSOR.md`: petunjuk implementasi dan eksekusi.
- `docs/R86F_ROLLBACK_RUNBOOK.md`: prosedur rollback yang menjaga draf dan antrean offline.
- `docs/R86F_FINAL_REGRESSION_GATE.md`: dokumen ini.
- `docs/R86F_SNAPSHOT_VALIDATION_RESULTS.md`: hasil regresi unit pada salinan source lokal, bukan staging pengguna.

## Prasyarat dan batasan akses

1. GitHub Desktop → **Fetch origin / Pull origin**. Source lokal harus mengandung patch yang pengguna sudah terapkan sampai R86-E3.
2. Gunakan Node.js yang sesuai dengan repository; `npm ci` membutuhkan akses ke registry. Tidak ada dependensi baru dalam ZIP R86-F.
3. R86-E3 harus telah diekspor **22 file JSON** dari 1/2/3/5 tab, untuk dua arm (`baseline` dan `pilot`), dan sudah dihitung dengan `compare_r86e3.cjs`.
4. **Commit lokal** file source/script/docs yang akan diuji sebelum pemeriksaan akhir, sehingga `git status` bersih (folder hasil di `artifacts/` dikecualikan). Catat SHA dari commit tersebut; **Push boleh dilakukan ke branch pengujian untuk membuat Vercel Preview**, tetapi jangan merge/deploy ke branch Production sebelum gate final dan review lulus.
5. Uji manual melalui **Vercel Preview / akun uji / data dummy**, bukan menulis uji presensi ke database sekolah produksi.
6. Berkas `artifacts/r86f/evidence.json` diisi manual, `status: PASS` hanya setelah benar-benar diuji dan ada rujukan hasil. Jangan tulis nama/ID murid/guru, email, PIN, token, foto, atau payload notifikasi.
7. Catatan: paket ini disusun dari paket R86-A hingga E3 tersedia di percakapan, **bukan dari pemeriksaan langsung HEAD GitHub yang terhubung**. Skrip harus dijalankan di clone HEAD yang sebenarnya.

## Langkah instalasi dan tes

Ekstrak isi ZIP ke root `piket-guru` (jalur `scripts/` dan `docs/` akan tercipta). **Tidak ada pemasang / perubahan `src/main.tsx`.**

```
npm ci
node scripts/verify_r86f.cjs
npm run lint
npm run build
```

Setelah melakukan commit lokal pada source yang diuji (belum Push), pastikan `git status` bersih di luar `artifacts/`. Buat folder `artifacts/r86f` lalu salin template `docs/R86F_STAGING_EVIDENCE_TEMPLATE.json` menjadi `artifacts/r86f/evidence.json`. Isi berdasarkan uji nyata dan SHA `git rev-parse HEAD`.

Jika E3 belum dihitung, jalankan:

```
node scripts/compare_r86e3.cjs --input artifacts/r86e3/raw --out artifacts/r86e3/results
```

Lalu jalankan gate dalam mode laporan (tidak akan mengubah source):

```
node scripts/r86f_release_gate.cjs --out artifacts/r86f/results
```

Setelah bukti lengkap, jalankan versi ketat untuk menetapkan gate:

```
node scripts/r86f_release_gate.cjs --strict --out artifacts/r86f/results
```

Output ada di `artifacts/r86f/results/summary.json` dan `summary.md`. Exit code `0` hanya ketika seluruh gate otomatis dan manual lulus; exit `2` saat `--strict` dan ada BLOCK. Tanpa `--strict`, gate selalu mencetak NO-GO/GO tetapi dapat exit 0 agar laporan awal dapat dihasilkan, **tidak berarti lulus**.

### Cara membaca laporan

| Hasil | Tindakan |
|---|---|
| `NO-GO` karena E3 tidak lengkap | Selesaikan 1, 2, 3, 5 tab baseline/pilot; ulangi pembanding |
| `NO-GO` karena `repo:clean` | Commit lokal seluruh perubahan source/script/docs; bukti harus merujuk commit itu |
| `NO-GO` karena SHA | Samakan hasil staging dan source commit HEAD; jangan memalsukan SHA |
| `NO-GO` karena penanda R86 tidak ada | Periksa pemasangan patch dari source aktual; jangan timpa file dengan snapshot lama |
| `NO-GO` karena skenario manual | Uji dan dokumentasikan; jangan tandai PASS tanpa bukti |
| `NO-GO` karena `REVIEW_WARNINGS` E3 | Investigasi durasi, coverage, background peer, reset counter; ulangi jika dibutuhkan |
| `GO_FOR_SEPARATE_RELEASE_REVIEW` | Lakukan review independen terhadap bukti nyata dan kebijakan flag Production |

## Kriteria teknis yang harus diperiksa manual

- Semua alur login: Nama/ID-NIP/PIN/Admin Google, perangkat tepercaya dan bersama; tab lama tidak boleh memulihkan akun yang sudah logout atau melanggar kebijakan session timeout.
- Presensi masuk dan pulang tetap tepat satu transaksi per tindakan; tidak ada retry duplikat dari dua tab.
- Form buku piket, foto, IndexedDB, Web Locks/lease dan antrean offline tetap aman; dilarang clear storage sebagai tindakan rollback.
- Saat tab laporan kembali aktif, data harus terbaru; saat export/print/photo, pilot E2 tidak boleh mengakhiri listener.
- Notifikasi penting tetap tersedia; tampilan unread/outbox benar; tidak ada double notification tak diharapkan di tab yang sama.
- PWA update aman saat draf pending; tanpa loop refresh/update.
- Pembacaan Firestore nyata dibandingkan hanya melalui metrik pemakaian Firebase dengan workload dan jendela waktu setara.

## Keamanan alat

Gate hanya membaca berkas source, memeriksa SHA-256 dari beberapa file kritis, dan membaca JSON bukti yang secara eksplisit disediakan penguji. Tidak ada Firebase SDK, tidak ada login, tidak ada telemetry/network, tidak menyentuh IndexedDB. `--out` hanya diperbolehkan di bawah `artifacts/`; jangan menambahkan JSON pengujian sensitif ke Git.

**Batasan:** Pemeriksaan marker dan test fixture bukan static typecheck penuh dan bukan audit keamanan formal. Konfirmasi lint, build, integrasi Firebase, dan staging tetap wajib.
