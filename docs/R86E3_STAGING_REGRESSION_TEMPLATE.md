# R86-E3 — Template Laporan Perbandingan dan Regresi Staging

> **Ini template kosong, bukan hasil uji produksi.** Isi dari Preview dan Firebase Console yang benar-benar digunakan.

## Metadata

- Git SHA / branch:
- Timestamp pengukuran (WIB):
- URL/environment: **Preview** (tanpa domain/query sensitif)
- Perangkat, OS, browser, versi:
- Jenis akun uji: perangkat pribadi / bersama
- Build flags yang aktif (tanpa secrets):
- Dataset, periode laporan, dan jam sebanding:
- Hasil `npm run lint`:
- Hasil `npm run build`:

## Perbandingan baseline/pilot

| Skenario | JSON baseline | JSON pilot | Avg listener baseline | Avg listener pilot | Selisih | Status/peringatan |
|---|---|---|---:|---:|---:|---|
| 1 tab | — | — | — | — | — | BELUM DIUJI |
| 2 tab | — | — | — | — | — | BELUM DIUJI |
| 3 tab | — | — | — | — | — | BELUM DIUJI |
| 5 tab | — | — | — | — | — | BELUM DIUJI |

Pengukuran: `node scripts/compare_r86e3.cjs --input artifacts/r86e3/raw --out artifacts/r86e3/results`.

## Firebase Usage — sumber resmi, bukan estimasi callback

- Jendela baseline (waktu, reads, traffic lain):
- Jendela pilot (waktu, reads, traffic lain):
- Apakah workload, akun dan data identik?
- Kelebihan reads akibat resubscribe?
- Kesimpulan yang dapat diuji (bukan inferensi otomatis):

## Pengujian integritas dan sesi

| Uji | Hasil | Bukti / catatan |
|---|---|---|
| Login nama / ID-NIP / PIN / Google admin | BELUM DIUJI | |
| Session timeout sesuai pengaturan Admin | BELUM DIUJI | |
| Pengalihan tab 1→5→1 & refresh data Laporan | BELUM DIUJI | |
| Laporan ekspor/cetak/foto di background | BELUM DIUJI | |
| Presensi masuk/pulang tidak duplikat | BELUM DIUJI | |
| Buku piket dan foto tidak hilang | BELUM DIUJI | |
| Offline → online queue sekali terkirim | BELUM DIUJI | |
| Perangkat bersama menyimpan draf aman | BELUM DIUJI | |
| Notifikasi penting dan pembaruan PWA | BELUM DIUJI | |

## Keputusan

- Keputusan: **BELUM DITENTUKAN** (GO ke R86-F / NO-GO / ulang uji)
- Alasan:
- Reviewer:
- Tanggal:
- Rencana rollback apabila terjadi regresi:

**Jangan aktifkan pilot di Production sampai reviewer mengisi dan menandatangani hasil nyata.**
