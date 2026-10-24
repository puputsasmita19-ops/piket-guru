# R60 Tahap Verifikasi Build & Kesiapan Staging — REVISI untuk R61

Tanggal: 24 Oktober 2026. **Urutan: source R61 sudah diterapkan; kit verifikasi R60 ini dipasang setelah R61**. Nama skrip tetap `r60_*` untuk menjaga kompatibilitas, tetapi gerbang sekarang juga mewajibkan regresi R61.

## Prinsip pemasangan

- ZIP ini hanya berisi `scripts/`, `.github/workflows/`, dan `docs/`. **Tidak berisi `src/`, `firebase.json`, atau Firestore Rules**, sehingga tidak menimpa komponen R61 ataupun data sekolah.
- Jangan memasang ulang patch diagnostik R60 apabila sudah terpasang. Ini adalah **kit VERIFIKASI**, bukan patch fitur R60 atau R61.
- Git commit/checkpoint saat ini harus disimpan terlebih dahulu. Gunakan repository lokal **yang sekarang sudah R61**, bukan restore ulang dari source R60 lama.
- Jika muncul FAIL, hentikan Push. Perbaiki penyebabnya pada checkout terbaru, jangan downgrade aplikasi.
- Hasil `--preflight` tidak membuktikan build sudah sukses. Hasil `--run --install` juga **bukan** bukti staging/produksi siap. Field laporan `releaseReady` akan tetap `false` sampai tahapan staging terpisah diverifikasi secara manual.

## A — Pemeriksaan source R61 dan build lokal (wajib)

Buka **GitHub Desktop → Repository → Open in Terminal** atau PowerShell dari folder repository Piket Guru.

```powershell
node --version
node scripts/r60_release_gate.cjs --preflight
node scripts/test_r60_release_gate.cjs
node scripts/r60_release_gate.cjs --run --install
```

Gerbang pemeriksaan memerlukan:
1. Root repository memiliki `package.json` dan `package-lock.json`; Node.js >=22.12.
2. Komponen diagnostik R60 (`r60ApiRequestMetrics.ts`, `r60BrowserDiagnostics.ts`) dan skrip uji R60 masih ada.
3. Form `StudentTardyFormModal.tsx` memiliki marker **`R61 MOBILE TARDY CARD`**, dan `scripts/test_r61_mobile_tardy.cjs` tersedia.
4. `npm ci`, `npm run lint`, dan `npm run build` lulus, serta regresi R61 dan R60 lulus.
5. Simulasi beban R60 50 pengguna berjalan **hanya pada server tiruan lokal**. Ini bukan tes kapasitas Firebase/Vercel.

Opsional regresi versi lama R51, R54, R57, R59 dijalankan jika skripnya tersedia; `NOT_RUN` dicatat untuk skrip opsional yang hilang, tidak dicatat sebagai `PASS`.

**Jika belum punya `package-lock.json`**, jangan membuat lockfile sementara dengan menyisipkan dependency asal. Pertama selesaikan penyesuaian lockfile di branch terpisah, audit dependensi, baru kembali ke gerbang release.

**Jika versi Node belum sesuai**, gunakan Node 22.12+ (atau versi Node yang disyaratkan oleh Vite di `package.json`).

## B — Firebase Emulator, khusus R58 dan keamanan sinkronisasi (wajib)

Gunakan **Firebase project demo terisolasi**, misalnya `demo-piketguru-r61` (jangan ID produksi). Pastikan emulasi Auth dan Firestore aktif, rules diambil dari `firestore.rules` repository terbaru. Contoh **PowerShell**:

```powershell
$env:GCLOUD_PROJECT = 'demo-piketguru-r61'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
node scripts/r60_emulator_preflight.cjs
```

Script ini hanya memvalidasi variabel lingkungan agar tetap lokal. **Tidak memulai Firebase Emulator dan tidak menjalankan pengujian Rules.** Jalankan suite pengujian Rules sesuai perintah di repository Anda, dengan emulator masih aktif; pastikan Guru A tidak dapat mengedit catatan Guru B, Admin dapat mengoreksi dengan audit, dan data guru/siswa sintetis tidak tertimpa. Jangan deploy kandidat Rules R58 ke proyek produksi sebelum hasilnya diperiksa.

## C — Staging Preview terpisah, smoke test hanya GET (wajib)

Gunakan deployment Vercel **Preview/Staging** dengan proyek Firebase **terpisah** dari produksi. Pastikan Google Drive yang dipakai staging juga folder/akun uji atau di-mock. Catat commit SHA dan deployment URL. Konfirmasi nilai ID di pengaturan Vercel, jangan hanya bergantung pada nama hostname.

Contoh PowerShell; **ganti** semua nilai contoh sesuai konfigurasi staging:

```powershell
$env:R60_STAGING_URL = 'https://piket-guru-staging.example.com/'
$env:R60_STAGING_HOST = 'piket-guru-staging.example.com'
$env:R60_STAGING_PROJECT_ID = 'id-proyek-staging'
$env:R60_PRODUCTION_PROJECT_ID = 'id-proyek-produksi'
$env:R60_STAGING_CONFIRMED = 'YES'
node scripts/r60_staging_smoke.cjs --dry-run
node scripts/r60_staging_smoke.cjs
```

Smoke test **hanya mengirim dua GET** (`/api/health` dan `/`), tanpa cookies, autentikasi, redirect, write, upload, maupun tes beban. Jika domain staging tidak mengikuti pola hostname yang diizinkan, jangan mengganti host asal-asalan atau memakai produksi; tinjau dan sesuaikan validasi setelah membuktikan lingkungan Preview sebenarnya.

## D — QA fungsional staging dengan data dummy (wajib)

| Area | Bukti minimal yang diperlukan | Status |
| --- | --- | --- |
| Login dan hak akses | Admin/Guru dummy masuk; Guru A tidak dapat edit data Guru B | BELUM DIUJI |
| R61 Buku Siswa Terlambat Mobile | Pada lebar 320, 375, 390 px: nama tidak terpotong, tombol Foto/Atur/Hapus mudah disentuh, input waktu/alasan/pembinaan & simpan berhasil | BELUM DIUJI |
| R61 Desktop | Pada layar > 1024 px: kartu dan modal tetap rapi; perhitungan keterlambatan tidak berubah | BELUM DIUJI |
| Data siswa | Uji input satu & beberapa siswa, edit/delete, foto dummy, alasan, pengaturan individual, penyimpanan batch dengan request ID tetap | BELUM DIUJI |
| Monitoring/Admin | Update presensi antarbrowser dan riwayat admin, alasan koreksi, jejak audit | BELUM DIUJI |
| Offline/PWA | Koneksi putus-pulih, antrean aman, tidak ada duplikat, tombol pembaruan tidak hilangkan draf | BELUM DIUJI |
| Master/Settings | Navigasi tab dan loading tetap responsif; hak akses terjaga | BELUM DIUJI |
| Foto privat | JPEG/PNG/WebP dummy, upload/retry, akses URL untuk non-pemilik ditolak | BELUM DIUJI |

Uji memakai akun dan siswa sintetis khusus staging. **Jangan mencoba load test pada database sekolah produksi.**

## E — Pengujian beban staging terkendali (wajib untuk klaim 50 pengguna)

Mulai 5 → 20 → 50 pengguna dummy setelah A–D lulus dan kuota Firebase staging dinilai memadai. Gunakan instrumen yang disetujui pemilik staging dengan rate limit dan batas durasi. Catat p50/p95/p99 latency, HTTP 429/5xx, operasi gagal, duplikasi presensi, read/write Firestore dan performa HP. Tes lokal `r60_synthetic_load.cjs` tidak memuat Vercel staging: ia mensimulasikan pola idempoten di proses lokal saja.

## Keputusan

**GO** baru setelah: build lint R60+R61, Firestore Emulator, staging smoke, QA fungsional R61/Admin/Guru, uji beban staging terukur, serta rollback plan seluruhnya lulus dan dicatat.

**NO-GO** jika masih ada tes wajib yang belum berjalan, error tidak terselesaikan, data produksi tersentuh, atau verifikasi Firebase environment tidak jelas. Hasil laporan gerbang lokal adalah `localGatePassed`, **bukan** keputusan deployment produksi.
