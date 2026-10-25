# Cursor — Checklist Release Review R86-G

> **Tidak ada perubahan pada src/**; jangan deploy otomatis, jangan reset browser storage.

- [ ] GitHub Desktop: Fetch origin → Pull origin; pastikan commit calon rilis & branch teridentifikasi.
- [ ] Ekstrak ZIP R86-G ke root repository yang sudah memiliki R86-F.
- [ ] Jalankan `npm ci`, `npm run lint`, `npm run build` dan simpan output pada bukti R86-F.
- [ ] `node scripts/verify_r86g_readiness.cjs` harus PASS.
- [ ] `node scripts/r86f_release_gate.cjs --strict --out artifacts/r86f/results` harus PASS (bukti staging asli).
- [ ] Di Vercel Preview, verifikasi login Nama, ID/NIP, Google Admin, sesi/perangkat bersama, presensi masuk/pulang, draf/foto, antrian offline, notifikasi, PWA, serta skenario 1/2/3/5 tab.
- [ ] Cocokkan SHA Preview deployment dengan `git rev-parse HEAD`.
- [ ] Lengkapi perbandingan E3 dari **22 JSON**; jangan mengklaim Firebase billed reads dari callback.
- [ ] Periksa keenam flag R86 pada **Vercel Production**: ABSENT atau DISABLED; dokumentasikan bukti dengan rahasia disamarkan.
- [ ] Pastikan sebelumnya ada deployment stabil yang dapat dipulihkan, dan tanggung jawab rollback jelas.
- [ ] Salin `docs/R86G_RELEASE_EVIDENCE_TEMPLATE.json` ke `artifacts/r86g/release-evidence.json`, isi berdasarkan bukti nyata.
- [ ] Jalankan `node scripts/r86g_release_readiness.cjs --strict --out artifacts/r86g/results`; jangan lanjut jika hasil NO-GO.
- [ ] Lakukan review independen sebelum keputusan deployment Production.
- [ ] Bila rilis disetujui, lakukan smoke test pascadeploy dan pemantauan error, login, presensi, antrean offline, serta Firebase Usage.
- [ ] Jangan menambahkan file `artifacts/` yang mengandung data sensitif ke Git.

**Jika keluar NO-GO:** perbaiki bukti atau konfigurasi yang relevan; jangan memalsukan PASS. Jangan menghapus IndexedDB/localStorage/draf/antrean offline ataupun mengubah Firebase rules sebagai langkah troubleshooting.
