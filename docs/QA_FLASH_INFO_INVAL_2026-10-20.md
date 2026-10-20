# QA perubahan Flash Info Guru Inval — 20 Oktober 2026

## Ruang lingkup

- **Guru berhalangan:** nama, mata pelajaran / kelas, JP, dan keterangan berhalangan hadir ditampilkan dalam satu blok.
- **Guru pengganti / inval:** nama pengganti atau status koordinasi, status tugas, serta tindak lanjut / tugas kelas ditampilkan dalam blok terpisah.
- **Mobile:** dua blok tersusun vertikal (`<=639px`). **Tablet / desktop:** dua blok berdampingan (`>=640px`).
- Teks panjang tetap ada, dapat digulir di dalam blok Flash Info; tombol navigasi tetap di luar area gulir.
- Tidak ada modifikasi pada Firestore Rules, layanan real-time, RBAC, maupun penulisan data.

## Hasil validasi di lingkungan penyuntingan

| Pemeriksaan | Hasil |
| --- | --- |
| `node scripts/verify_flash_inval_split_local.mjs` | **20 PASS** (parse TS/TSX & CSS, rangkuman data, alur update, fallback, permission/listener code path, layout) |
| `node --check scripts/verify_substitution_flash_ui.mjs` | **PASS**, sintaks test browser valid |
| `npm ci --no-audit --no-fund --prefer-offline` | **GAGAL**: koneksi/DNS ke `registry.npmjs.org`, `EAI_AGAIN`; paket tidak dapat diunduh |
| `npm run lint` | **TIDAK LOLOS**: paket tipe `@types/*` belum terpasang; bukan hasil lint penuh |
| `npm run build` | **TIDAK LOLOS**: perintah `vite` tidak tersedia karena instalasi dependensi gagal |
| `node scripts/verify_substitution_flash_ui.mjs` | **BELUM DIJALANKAN**: membutuhkan `esbuild`, React dan Playwright yang belum tersedia |

**Catatan:** Hasil 20 PASS adalah tes regresi logika/sintaks **lokal**, bukan pengganti lint/build/browser end-to-end. Keberhasilan build produksi belum dikonfirmasi.

## Verifikasi akhir di komputer dengan NPM berfungsi

```bash
npm ci
npm run lint
npm run build
node scripts/verify_flash_inval_split_local.mjs
# Opsional jika Playwright + Chromium tersedia sesuai environment QA:
node scripts/verify_substitution_flash_ui.mjs
```

Lakukan inspeksi manual pada lebar 320px, 390px, 768px dan 1440px, termasuk teks panjang, warna terang/gelap, scroll konten dan penarikan hak akses saat sesi aktif. Pengaturan dan data realtime tetap melalui jalur dashboard saat ini.

## File yang diedit

- `src/features/dashboard/substitutionFlashSummary.ts`
- `src/features/dashboard/DashboardFlashInfo.tsx`
- `src/index.css`
- `scripts/verify_substitution_flash_ui.mjs` (ekspektasi regresi layout baru)
- `scripts/verify_flash_inval_split_local.mjs` (baru)
- `CHANGELOG.md`

`MANIFEST.sha256` dari sumber asli adalah artefak historis dan **bukan** manifest SHA terkini paket revisi ini. Daftar file patch dan SHA-256-nya ada di `PATCH_SHA256.txt`. Arsip legacy bernama `piket_guru_buku_piket_final_bundle.zip` di dalam source merupakan bagian sumber lama, bukan paket pembaruan ini.
