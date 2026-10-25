# PIKET GURU R86-E3 — Performance Comparison & Regression Validation

**Status:** alat pengukuran/analisis untuk **Development dan Vercel Preview**, **tidak aktif di produksi secara default**. Kode dibuat berdasar paket R86-C/D/E2 sebelumnya, **bukan audit langsung terhadap commit HEAD GitHub milik pengguna**. Periksa pemasang dengan source lokal terbaru sebelum `--apply`.

## 1. Tujuan

Membandingkan **baseline** (R86-E2 nonaktif via URL) vs **pilot** (R86-E2 aktif via URL) untuk **1, 2, 3, dan 5 tab**, menggunakan build dan data uji yang sebanding.

Baseline **bukan** eksperimen menggunakan dua build berbeda: di satu deployment Preview, set `VITE_R86E2_REPORTS_PILOT=enabled`; pada baseline **jangan sertakan** `r86_e2_pilot=1` di URL, pada pilot **sertakan**. Ketentuan eksplisit ini mencegah perbedaan versi kode mengganggu perbandingan.

R86-E3 **hanya** mengamati hasil `__PIKET_R86C__.snapshot()` dan `__PIKET_R86D__.snapshot()`, ditambah jumlah peer teramati dari R86-B **bila** R86-B aktif. Tidak membuka query Firestore baru, tidak menghentikan listener, tidak mengubah sesi, tidak membaca UID/NIP/PIN/identitas/foto/draf/offline queue, dan tidak mengirim telemetri ke server.

**Batasan kritis:** R86-C menghitung registration/callback SDK yang diinstrumentasi; tidak menghitung dokumen yang dibaca dan ditagihkan Firebase. E3 tidak mengukur keamanan sesi, akurasi data, atau penghematan biaya Firestore. Kegagalan atau kelulusan manual wajib dicatat terpisah.

## 2. Isi ZIP

- `src/services/diagnostics/r86e3PerformanceCapture.ts` — probe opt-in dan ekspor JSON lokal setiap tab.
- `scripts/apply_r86e3_safe.cjs` — pemasang dengan dry-run default, menyisipkan hook di **`src/main.tsx`** aktual. `STOP` bila struktur tidak cocok.
- `scripts/compare_r86e3.cjs` — analisis offline; hanya membaca berkas JSON yang penguji masukkan ke folder input.
- `scripts/verify_r86e3.cjs` — tes modul, pemasang dan pembanding sintetis.
- `docs/R86E3_PERFORMANCE_COMPARISON.md` — petunjuk ini.
- `docs/CHECKLIST_CURSOR_R86E3.md` — checklist runbook.
- `docs/R86E3_STAGING_REGRESSION_TEMPLATE.md` — format hasil uji manual dan Firebase Usage.

**Tidak ada `src/main.tsx` snapshot lama dalam ZIP.** Pemasang hanya menambah satu hook ke file aktual. Semua file dalam ZIP adalah file baru.

## 3. Prasyarat

1. Repository lokal sudah memuat R86-A/B/C/D dan R86-E2 (serta laporan audit E1); jalankan Fetch/Pull, lalu buat checkpoint Git.
2. `src/main.tsx` harus memiliki marker R86-C dan R86-D, berikut anchor tunggal `createRoot(document.getElementById('root')!).render(<App />);`. Jika tidak, pemasang akan STOP tanpa menulis.
3. Tes hanya pada **Preview/development + akun uji**, **bukan data sekolah produksi**. Jika user mengaktifkan flag Preview, lakukan **redeploy** sehingga Vite menyertakannya di bundle.
4. `npm ci`, `npm run lint`, `npm run build`, dan `node scripts/verify_r86e3.cjs` harus lulus sebelum membuat deployment staging.

## 4. Pemasangan

Jalankan dari root repository Piket Guru:

```bash
node scripts/apply_r86e3_safe.cjs            # dry-run; tidak menulis
node scripts/apply_r86e3_safe.cjs --apply    # sisipkan hook opt-in hanya di main.tsx
node scripts/verify_r86e3.cjs
npm ci
npm run lint
npm run build
```

Pada sistem baru tanpa `node_modules`, jalankan `npm ci` **sebelum** tes TypeScript. Jika skrip menampilkan `STOP`/lint gagal/build gagal, hentikan proses dan bandingkan source terbaru, jangan menyalin `main.tsx` dari arsip lama. Review `git diff`.

## 5. Konfigurasi Vercel Preview

Pada Environment **Preview** saja (bukan Production):

```text
VITE_R86_LISTENER_AUDIT=enabled
VITE_R86_STABILITY_AUDIT=enabled
VITE_R86E3_COMPARE=enabled
VITE_R86E2_REPORTS_PILOT=enabled
```

Opsional untuk bukti peer antartab R86-B:

```text
VITE_R86_TAB_OPT=enabled
```

Setelah redeploy, gunakan jalur yang menuju menu Laporan pada aplikasi dan **pertahankan parameter URL berikut ketika navigasi**. Jika router menghapus parameter, instrumen bisa tidak aktif pada reload; periksa Console terlebih dahulu.

### Baseline (pilot OFF)

```text
?r86_listener_audit=1&r86_stability_audit=1&r86_e3_compare=1&r86_tab_opt=1
```

### Pilot (pilot ON)

```text
?r86_listener_audit=1&r86_stability_audit=1&r86_e3_compare=1&r86_tab_opt=1&r86_e2_pilot=1
```

`r86_tab_opt=1` opsional. **Jangan set `r86_e2_pilot=1` saat baseline.** Semua tab yang ikut pilot harus memakai parameter pilot yang sama.

## 6. Protokol pengukuran 1 / 2 / 3 / 5 tab

1. Gunakan satu perangkat/browser/profile yang sama, satu versi deployment, akun uji dan data uji sebanding. Buka menu **Laporan** (listener E2 harus benar-benar terpasang pada halaman itu). Jangan melakukan export/cetak/review foto selama segmen pengukuran listener.
2. Mulai **baseline** untuk `tabCount=N`. Buka N tab dan pastikan semuanya mengaktifkan R86-C/D/E3. Masuk menu Laporan dan buka DevTools → Console di masing-masing tab.
3. Dari setiap tab, jalankan `window.__PIKET_R86E3__?.begin('baseline', N, i)` dengan indeks `i` mulai dari 1. Baca hasil `{ok:true}`; jika `ok:false`, **perbaiki flag atau instrumen, jangan simpan hasil sebagai baseline**.
4. Biarkan Tab 1 tetap aktif/terlihat dan **tab lainnya tersembunyi** minimal **4–5 menit**. Pada browser satu jendela, hanya satu tab yang terlihat. Jika menguji multi-window, pastikan ada peer tampak sehingga R86-E2 dapat mendeteksinya.
5. Dari masing-masing tab, jalankan `window.__PIKET_R86E3__?.download()` untuk menyimpan `r86e3_baseline_N_i.json`. Mengaktifkan kembali tab untuk ekspor akan memicu resume: ini diharapkan dan dicatat.
6. **Reload semua tab** dan lakukan **pilot** dengan URL yang memuat `r86_e2_pilot=1` pada **semua** tab. Ulangi langkah sama, gunakan `.begin('pilot', N, i)`, ekspor `r86e3_pilot_N_i.json`.
7. Ulangi untuk N=1,2,3,5. Total **22 file JSON** (2×(1+2+3+5)) jika semua skenario lengkap.
8. Pindahkan seluruh JSON ke `artifacts/r86e3/raw/` (lokal; jangan commit bersama data pengguna). Jalankan CLI pembanding:

```bash
node scripts/compare_r86e3.cjs --input artifacts/r86e3/raw --out artifacts/r86e3/results
```

Hasil: `summary.md` dan `summary.json` di folder hasil. File yang tidak ada = `INCOMPLETE`, file salah/malformed = ditolak. Tidak ada hasil optimasi yang dibuat-buat.

**Perhatian:** timer pada tab background dapat ditunda browser, sehingga pengukuran adalah estimasi aktivitas client berdasarkan sampel, bukan jaminan waktu persis/deteksi pause secara langsung. Jika ekspor satu tab terhambat, tab itu diberi status tidak lengkap; jangan isi angka asumsi.

## 7. Ukuran yang dilaporkan

- `totalAvgActiveCollections` — jumlah **rata-rata listener kategori collection yang terinstrumentasi** seluruh tab, berbobot waktu di setiap tab. Tidak mewakili billed reads.
- `totalListenerMinutes` — akumulasi active collection listener-minutes dari sampel.
- `totalOpenedEvents` dan `totalCallbackEvents` — delta dari counter R86-C; tidak sama dengan jumlah dokumen, biaya, atau query unik.
- `totalHiddenMinutes` — estimasi durasi tab tidak terlihat.
- Persentase perubahan = `(pilot - baseline) / baseline`, jika baseline > 0 dan seluruh tab ada.
- Peringatan jika waktu pengamatan <3 menit, background <2 menit, metrik peer tidak ada, atau terjadi reset counter.

**R86-E3 tidak otomatis menyetujui deploy.** Status `READY_FOR_MANUAL_REVIEW` adalah kesiapan laporan, bukan kelulusan regresi.

## 8. Pengujian non-metrik (WAJIB)

Isi template `R86E3_STAGING_REGRESSION_TEMPLATE.md` untuk setiap skenario:

- login dan timeout sesuai kebijakan Admin, pada perangkat pribadi dan bersama;
- presensi masuk/pulang dan tidak ada kiriman ganda;
- buku piket, upload foto, dan draf offline aman;
- offline → online sinkronisasi tidak duplikat;
- notifikasi tetap diterima dan sesuai;
- halaman Laporan yang diaktifkan kembali menunjukkan snapshot terbaru; filter tanggal tidak berubah;
- cetak/ekspor/foto pada Laporan tidak diblokir dan tidak menyebabkan pause;
- PWA update tidak merusak draft atau autentikasi.

Untuk **biaya Firebase**, periksa Firebase Console Usage pada jendela terisolasi dengan trafik setara (misalnya pengujian terjadwal tanpa pengguna lain) dan bandingkan jumlah reads. Perhatikan resubscribe dapat menyebabkan lonjakan reads. Jangan campur billed reads dengan event callback R86-C.

## 9. Rollback dan batas penerimaan

- **Matikan E3:** hilangkan `VITE_R86E3_COMPARE` dari Preview dan redeploy, atau jangan sertakan `r86_e3_compare=1` di URL.
- **Matikan pilot E2:** hilangkan `VITE_R86E2_REPORTS_PILOT` atau hilangkan `r86_e2_pilot=1` dari URL dan reload (untuk mengakhiri pilot aktif).
- Kode: `git revert` commit terkait setelah review. Jangan hapus `IndexedDB`, `localStorage`, browser cache atau draf hanya untuk rollback.
- **NO-GO** bila lint/build gagal, data real-time tidak pulih, terjadi duplikasi transaksi, antrean offline bermasalah, notifikasi penting hilang, atau hasil listener/cost merugikan.
- **GO ke evaluasi R86-F**, bukan otomatis Production, hanya setelah semua pengujian dan monitoring staging tervalidasi.
