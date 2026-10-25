# Cursor — Checklist Eksekusi R86-F

## A. Sebelum menjalankan alat

- [ ] GitHub Desktop → Fetch origin → Pull origin; git status bersih/backup commit dibuat.
- [ ] Repo sudah mengandung R86-A/B/C/D/E1/E2/E3; pemeriksaan difokuskan pada source aktual terbaru.
- [ ] Jangan menjalankan perintah audit ini pada database produksi dengan akun murid/guru sungguhan.
- [ ] Ekstrak R86-F ke root repository. Pastikan ZIP hanya berisi file `scripts/` dan `docs/`.

## B. Pemeriksaan otomatis

- [ ] `npm ci`
- [ ] `node scripts/verify_r86f.cjs` — tes gate 19 skenario (fixture sintetis, bukan sistem sekolah).
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Jalankan ulang verifier relevan dari R86-A/B/C/D/E1/E2/E3 pada source aktual.
- [ ] Jalankan pembanding E3 dan periksa `summary.json` punya 22 file diterima dan empat skenario 1/2/3/5 tab.
- [ ] Jalankan `node scripts/r86f_release_gate.cjs --out artifacts/r86f/results`; baca semua `BLOCK`.

## C. Pengujian staged (akun uji, jangan data produksi)

- [ ] 1,2,3,5 tab: baseline OFF dan E2 pilot ON di build Preview yang sama (flag dan URL sesuai dokumentasi E3).
- [ ] Pastikan tab lama kembali menerima snapshot laporan baru.
- [ ] Uji login Nama / ID-NIP / Google Admin, trusted device / perangkat bersama dan session timeout.
- [ ] Uji presensi masuk dan pulang: tidak terduplikasi atau tertahan.
- [ ] Uji offline → online, tab ganda dan pending foto: tidak hilang, tidak terkirim ganda.
- [ ] Uji pengiriman dan indikator notifikasi; monitor read/outbox tanpa duplikasi.
- [ ] Uji export, cetak, review foto laporan selama ada tab background.
- [ ] Uji update PWA ketika draf masih pending.
- [ ] Baca Firebase Usage resmi untuk periode baseline dan pilot yang setara.
- [ ] Simpan bukti berupa catatan ringkas/log anonim, tanpa PIN/token/UID/nama/foto/isi data sekolah.

## D. Keputusan GO/NO-GO

- [ ] **Commit lokal** source/script/docs R86-F dan perubahan sebelumnya yang diuji, lalu Push ke **branch pengujian/Preview** bila perlu membuat deployment staging; jangan Push/merge ke Production. Pastikan `git status` bersih di luar folder `artifacts/`.
- [ ] `git rev-parse HEAD`: isi commit tepat 40 digit hex pada `artifacts/r86f/evidence.json`.
- [ ] Salin template JSON dari `docs/`, isi semua `automation.*.status`, `tests[].status`, dan `evidence` berdasarkan uji nyata.
- [ ] Reviewer memberi persetujuan tertulis atau tandai `PENDING`/`REJECTED` bila belum lengkap.
- [ ] Pastikan `pilotEnabledInProduction: false` dan env flag Preview tidak tersalin ke Production.
- [ ] Jalankan `node scripts/r86f_release_gate.cjs --strict --out artifacts/r86f/results`.
- [ ] Jika `NO-GO`, **jangan aktifkan pilot E2 di Production**. Jika lengkap, lanjut review rilis yang terpisah.
- [ ] Simpan rollback plan dan SHA commit sebelumnya sebelum deployment.

## E. Push GitHub

Setelah `npm ci`, lint, build, dan tes script selesai, **commit lokal** source/script/docs baru terlebih dahulu. Bila perlu Vercel Preview, Push branch pengujian saja. Jalankan gate terhadap SHA commit tersebut; **Merge/Push ke Production baru dilakukan setelah keputusan final GO untuk review disetujui**. File bukti di `artifacts/` sebaiknya jangan di-commit karena dapat berisi metadata pengujian. R86-F tidak mengubah perilaku aplikasi Production sampai fitur pilot diaktifkan secara terpisah.
