# R86-G — Release Review & Production Readiness

**Aplikasi:** Piket Guru  
**Tujuan:** penilaian kesiapan rilis rangkaian R86-A/B/C/D/E1/E2/E3/F.  
**Perubahan runtime aplikasi:** **Tidak ada**. Paket hanya menambahkan pemeriksa release dan dokumentasi; tidak mengganti berkas `src/`, login, presensi, listener, Firebase Rules, atau antrean offline.

## Keputusan default: NO-GO

Tidak boleh menyimpulkan siap produksi hanya karena ZIP R86-G terpasang. Hingga tersedia bukti pengukuran R86-E3 di Vercel Preview, hasil R86-F strict, dan persetujuan rilis, status harus **NO-GO**. Pemeriksaan R86-G **tidak melakukan deployment**. Bahkan ketika semua bukti lulus, hasilnya adalah `READY_FOR_SEPARATE_DEPLOYMENT_APPROVAL`, bukan publikasi otomatis.

## Prasyarat teknis

1. GitHub Desktop → Fetch origin/Pull origin; pastikan checkout yang diaudit adalah commit calon rilis yang sama dengan Vercel Preview.
2. R86-F harus dipasang, dan `node scripts/r86f_release_gate.cjs --strict` harus exit `0` dan menghasilkan `GO_FOR_SEPARATE_RELEASE_REVIEW` berdasarkan bukti nyata, **bukan fixture sintetis**.
3. R86-E3 harus menyertakan **22 rekaman JSON** untuk 1/2/3/5 tab baseline dan pilot sebagaimana diwajibkan R86-F; periode background harus cukup untuk E2 (2 menit) dan tanpa warning.
4. Hasil `npm ci`, `npm run lint`, `npm run build` dan staging login/presensi/offline/notification/PWA dicatat dalam bukti R86-F.
5. Pastikan calon rilis tidak memiliki perubahan source Git yang belum di-commit (`git status`). Hasil `artifacts/` disimpan lokal dan **tidak** dipush.
6. Periksa Environment Variables pada **Vercel → Project → Settings → Environment Variables** dan pilih scope **Production** secara eksplisit. Jangan mengasumsikan environment `Preview` juga berlaku di Production.

## Pemeriksaan enam flag R86 di Production

Semua berikut harus **tidak ada** atau **disabled**, dan dicek di Vercel Production. Pada source R86, beberapa probe memerlukan flag build + parameter URL; membiarkan flag `enabled` tetap memperlebar permukaan aktivasi dan tidak diizinkan oleh gerbang rilis ini.

| Flag | Keterangan |
|---|---|
| `VITE_R86_AUDIT` | Instrumen multi-tab R86-A |
| `VITE_R86_TAB_OPT` | Opt-in optimasi visual R86-B |
| `VITE_R86_LISTENER_AUDIT` | Penghitung listener R86-C |
| `VITE_R86_STABILITY_AUDIT` | Probe stabilitas R86-D |
| `VITE_R86E2_REPORTS_PILOT` | Pilot pause listener laporan R86-E2 (harus OFF) |
| `VITE_R86E3_COMPARE` | Probe perbandingan E3 |

**Perhatian:** Variabel `VITE_*` terkompilasi di bundle saat build. Mengganti Environment Variable di dashboard Vercel **tidak mengubah deployment lama**. Sesudah perubahan flag, buat deployment baru dan verifikasi build produksi terpilih. Mematikan flag setelah fakta tanpa redeploy bukan rollback yang lengkap.

Script `r86g_release_readiness.cjs` memindai deklarasi keenam flag dari `.env`, `.env.local`, `.env.production`, `.env.production.local`, dan `vercel.json` lokal. Ia tidak menampilkan **nilai mentah** dari file env. Scan lokal hanya pendukung: **tidak dapat membaca konfigurasi Environment Variables dashboard Vercel**, sehingga bukti pemeriksaan manual diwajibkan secara terpisah.

## Bukti yang harus disiapkan

- SHA Git calon rilis yang sama dengan Preview deployment yang diuji.
- Ringkasan `artifacts/r86f/results/summary.md` dari gerbang R86-F strict dan pengujian E3 lengkap.
- Bukti dashboard Vercel Production yang menunjukkan enam flag di atas ABSENT/DISABLED (simpan bukti tanpa secret, **jangan** unggah file `.env` atau screenshot berisi credential).
- SHA dan ID deployment versi terakhir yang diketahui stabil; penanggung jawab rollback; catatan smoke test.
- Persetujuan reviewer independen yang memahami dampak login, presensi, data offline, dan notifikasi.

Gunakan template `docs/R86G_RELEASE_EVIDENCE_TEMPLATE.json` dan salin ke `artifacts/r86g/release-evidence.json`. Jangan tandai `APPROVED` sampai bukti nyata tersedia. File evidence bukan sertifikat otomatis: kebenaran screenshot, metrik Firebase, dan verifikasi pengguna masih harus ditinjau manusia.

## Perintah

```bash
node scripts/verify_r86g_readiness.cjs
node scripts/r86f_release_gate.cjs --strict --out artifacts/r86f/results
node scripts/r86g_release_readiness.cjs --out artifacts/r86g/results
node scripts/r86g_release_readiness.cjs --strict --out artifacts/r86g/results
```

`--strict` exit `2` jika ada BLOCK. Tanpa `--strict`, script dapat exit 0 tetapi tetap mencetak `NO-GO`; exit 0 pada mode laporan **bukan** bukti lulus. Hanya `--out` menulis laporan `summary.json` dan `summary.md` di bawah folder `artifacts/`. Tidak ada jaringan, Firebase, perubahan source, commit, push, maupun deployment.

## Keputusan

- **NO-GO**: terdapat satu saja pemeriksaan yang gagal/tanpa bukti, termasuk semua flag Production belum diverifikasi.
- **READY_FOR_SEPARATE_DEPLOYMENT_APPROVAL**: semua pemeriksaan dokumen lulus dan reviewer menyetujui. Ini masih mengharuskan persetujuan deployment dan smoke test pascadeploy.
- **STOP/ROLLBACK**: setelah deploy, jika terjadi kegagalan login, presensi, sync offline, notifikasi, PWA, atau kehilangan data, lakukan mitigasi dan pemulihan versi stabil dengan prosedur di `R86G_ROLLBACK_AND_POSTDEPLOY.md`.

## Apa yang sengaja belum dioptimalkan

R86-G tidak mengurangi jumlah listener Firestore, tidak menutup tab, tidak memodifikasi sesi, dan tidak mengubah Firestore Rules. Pengurangan pemakaian Firebase **tidak** boleh disimpulkan hanya dari jumlah listener atau callback R86-C/E3. Perbandingan billed reads membutuhkan metrik Firebase Usage dengan traffic setara.

## Keterbatasan sumber

Paket ini disusun dari file R86-F dan arsip R86-A sampai E3 yang ada di percakapan. **Tidak ada akses langsung ke HEAD GitHub terbaru, konfigurasi Vercel, Firebase staging, ataupun hasil E3 nyata pengguna pada saat pembuatan.** Script dijalankan pada checkout GitHub Anda sebagai sumber sebenarnya.
