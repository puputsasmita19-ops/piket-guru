# R86-F — Matriks Regresi Staging

Semua skenario di bawah wajib dijalankan di **Preview dengan akun dan data uji**. Kolom bukti di template JSON dimaksudkan untuk rujukan seperti nomor kasus QA / ringkasan hasil anonim, bukan screenshot identitas pengguna.

| ID di evidence.json | Langkah pengujian singkat | Kriteria PASS |
|---|---|---|
| `login_nama` | Pilih mode Nama, cari akun uji, masukkan PIN | Masuk tepat ke akun terpilih |
| `login_id_nip` | Pilih mode ID/NIP, masukkan ID uji dan PIN | Tidak memakai UID mode Nama sebelumnya |
| `login_google_admin` | Login Google pada akun Admin uji | Hak akses sesuai Admin; tidak bocor ke tab akun lain |
| `session_timeout` | Background melebihi kebijakan Admin | Autentikasi ulang diminta sesuai kebijakan |
| `trusted_device` | Tutup tab normal, buka link baru dalam masa sesi | Dipulihkan hanya jika sesi masih valid |
| `shared_device` | Keluar/masuk pada perangkat bersama | Tidak melewati cek identitas; draft volatile ditangani aman |
| `account_switch_tabs` | Buka dua tab, logout/ganti akun di tab B, pakai tab A | Tab A tidak boleh memakai otorisasi akun lama |
| `presensi_masuk` | Kirim presensi masuk sekali sambil ada 2–5 tab | Satu catatan final, tidak ada double write |
| `presensi_pulang` | Kirim presensi pulang sekali, coba ulangi | Satu catatan final, status benar |
| `piket_draft_photo` | Buat draft buku piket + foto, pindah tab/background, kembali | Draft/foto tidak hilang |
| `offline_replay` | Offline, buat input, online kembali | Queue drained tepat sekali, tidak ada kehilangan |
| `offline_multitab` | Dua tab offline dan bersamaan online | Web Locks/lease mencegah replay ganda |
| `report_resume` | Pilot aktif, background ≥2 menit, kembali ke laporan | Snapshot terbaru muncul; tidak stuck loading |
| `report_busy` | Lakukan ekspor/cetak/review foto saat tab diminta pasif | Proses selesai dan listener tidak ditutup di tengah operasi |
| `notification_urgent` | Picu notifikasi penting dengan data uji | Penerimaan tetap benar |
| `notification_multitab` | Buka 2/3/5 tab dan kirim notifikasi uji | Tidak ada duplikasi tak diharapkan / pembaruan unread rusak |
| `pwa_update_draft` | Simulasikan PWA update saat ada draft/queue | Draft aman, tidak ada loop reload |
| `tab_matrix` | Uji 1,2,3,5 tab dalam Preview yang sama | Tidak crash, hang, kehilangan state |
| `preview_production_flags` | Cek env Preview vs Production & URL opt-in | Tidak ada pilot/diagnostik aktif tak sengaja di Production |
| `firestore_usage` | Bandingkan Firebase Usage di dua rentang terkontrol | Kesimpulan didukung metrik resmi, tanpa estimasi dari listener |

## Kinerja — data yang perlu disertakan

- 22 JSON dari E3 (2 × [1+2+3+5]).
- `summary.json`/`summary.md` E3 lengkap, tanpa `REVIEW_WARNINGS` atau `INCOMPLETE` untuk GO tahap review.
- Perangkat/browser/versi dan commit build identik antara baseline dan pilot.
- Durasi tiap run ≥3 menit, dianjurkan 4–5 menit; background ≥2 menit untuk tab 2–N.
- Snapshot UI callback, listener aktif, dan catatan event presensi/offline; hasil Firebase Usage resmi diukur terpisah.
- Jangan menarik kesimpulan billed Firestore reads dari `collectionAvg` atau `emissions`.

**Jika satu baris belum diuji atau bukti tidak valid, status akhir tetap NO-GO.**
