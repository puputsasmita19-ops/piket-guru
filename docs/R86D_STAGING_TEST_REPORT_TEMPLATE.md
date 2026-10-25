# R86-D — Template Bukti Pengujian Staging

Tanggal/waktu: ____________________  
Branch/commit GitHub: ____________________  
Vercel Preview URL (tanpa token atau kredensial): ____________________  
Perangkat/OS/browser: ____________________  
Network dan kondisi akun uji: ____________________  
R86-A/B/C enabled? ____________________

## A. Multi-tab dan performa

| Tab aktif | R86-A observedPeers | R86-B visualQuiet hidden | R86-C active per kategori | R86-D resumes / maxHiddenMs | Browser heap (jika tersedia) | Firebase Reads dashboard (jika tersedia) | PASS/FAIL/BELUM DIUJI |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |

> Jangan bandingkan hitungan callback dengan *billable reads* secara langsung. Gunakan pengukuran pada waktu/perangkat/jaringan yang sebanding.

## B. Penerimaan fungsional

| Scenario | Expected | Actual | PASS/FAIL/BELUM DIUJI |
|---|---|---|---|
| Sesi tepercaya, background singkat | Sesuai session policy Admin |  |  |
| Sesi terlalu lama di background | Login kembali jika policy mengharuskan |  |  |
| Session revoked | Ditolak sesuai validasi backend |  |  |
| Sesi perangkat bersama | Tidak memulihkan state tanpa validasi |  |  |
| Presensi masuk dan pulang pada tab ganda | Tidak dobel |  |  |
| Foto/draf lokal pada tab lama | Tidak hilang |  |  |
| Offline → online + dua tab | Tidak ada antrean terkirim ganda |  |  |
| Notifikasi urgent dan tandai dibaca | Terima & sinkron |  |  |
| PWA update saat ada draf tertunda | Draf tidak terhapus |  |  |
| BFCache / tab hide / resume | Tampilan pulih dan sesi tetap aman |  |  |

## C. Masalah, log anonim, dan keputusan

Anomali (tanpa nama/UID/NIP/PIN/token/foto): ____________________

Kondisi sebelum/selama/sesudah: ____________________

Hasil lint/build: ____________________

Keputusan deployment: **LULUS / TUNDA / ROLLBACK**  
Penanggung jawab validasi: ____________________

> Template kosong bukan bukti kelulusan. Semua skenario harus diisi dari pengujian nyata sebelum dinyatakan lulus.
