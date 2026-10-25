# R86-F — Rollback & Emergency Recovery Runbook

**Tujuan:** mengembalikan kode/fitur ke kondisi stabil tanpa kehilangan data pengguna, transaksi presensi, atau draf offline.

1. **Jangan hapus storage browser.** Jangan melakukan `localStorage.clear()`, menghapus IndexedDB, mengganti Firebase project, atau menghapus PWA/service worker secara paksa. Perangkat pribadi dan bersama memiliki perilaku draf berbeda.
2. **Jika pilot R86-E2 bermasalah di Preview**, cukup hilangkan `r86_e2_pilot=1` dari URL setiap tab (baseline kembali normal). Bila perlu hapus flag `VITE_R86E2_REPORTS_PILOT` dari **Preview** lalu redeploy Preview.
3. **Jika sudah ada kesalahan Production**, matikan flag opt-in yang relevan pada konfigurasi yang tepat dan redeploy versi sebelumnya melalui mekanisme rollback Vercel/Git. **Jangan rollback Firebase Rules/schema/database** tanpa audit terpisah.
4. **Jangan logout paksa semua guru** sebagai solusi teknis. Periksa lebih dahulu apakah terdapat antrean pending, foto lokal, presensi yang belum selesai, dan transaksi server yang masih berjalan.
5. Bandingkan log server, UID yang *boleh diakses oleh admin berwenang* di sistem resmi, serta ID transaksi sesuai kebijakan privasi internal; jangan mencetak identitas/akses ke laporan audit R86-F.
6. Simpan `git rev-parse HEAD` sebelum dan sesudah rollback. Catat nomor deployment, waktu, dan gejala tanpa menyertakan token, PIN, foto, maupun isi data murid.
7. Setelah rollback, ulangi smoke test login, presensi masuk/pulang, buku piket/foto, antrean offline, notifikasi, dan pembaruan PWA.
8. Bila terindikasi transaksi ganda, lakukan rekonsiliasi catatan server dengan prosedur sekolah. Jangan menjalankan script delete/cleanup massal.

**Batasan:** R86-F hanya menambah skrip dan dokumentasi, sehingga pencopotan R86-F sendiri tidak memengaruhi fungsi aplikasi. Rollback pada optimasi R86-E2 harus dilakukan terpisah dan diikuti verifikasi data.
