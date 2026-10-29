# R89-C — Penyempurnaan Missing Checkout Monitoring untuk Administrator

**Basis patch:** `piket-guru-main(2).zip` (source yang dikirim 29 Oktober 2026). Pada basis ini R89-B sudah tersedia, sedangkan panel R89-C belum ada.

## Fungsi yang ditambahkan

1. **Pisahkan tanggal hari ini dan lampau.** Pada Aktivitas Piket Hari Ini tersedia filter Semua / Belum pulang / Selesai. Statistik "Belum Pulang Hari Ini" tidak dianggap otomatis sebagai pelanggaran checkout.
2. **Panel historis khusus Admin** dalam Monitoring Piket Realtime. Default tertutup: data historis **tidak dibaca** sebelum Admin menekan *Periksa Checkout Terlewat*.
3. **Rentang 7/14/30 hari sebelumnya (WIB)**, pencarian nama/ID/tanggal dalam data yang telah dimuat, refresh manual dari server, cursor pagination sebanyak 100 dokumen per halaman (membaca hingga 101 untuk menentukan halaman berikutnya). Tidak ada polling baru.
4. **Server-only** dengan `getDocsFromServer`; data offline, snapshot cache atau pending write **bukan** bukti missed checkout. Daftar dikosongkan saat offline dan memerlukan pembacaan server ulang. Data bukan realtime; waktu verifikasi tampil jelas.
5. **Konservatif terhadap duplikasi**: satu identitas+tanggal hanya diklasifikasikan "belum tercatat" apabila hanya terdapat satu dokumen dengan check-in valid tanpa check-out. Duplikat atau nilai pulang tidak valid dipindahkan ke "Perlu Review Data" dan tidak dapat dikoreksi melalui panel ini. Pada paginasi belum lengkap, tanggal batas halaman ditahan hingga semua dokumen tanggal tersebut berhasil diambil.
6. **Dua tahapan pengecekan server** sebelum koreksi: sebelum dialog dibuka dan sebelum Admin mengirim perubahan. Keduanya mengonfirmasi bahwa tidak ada checkout maupun dokumen ganda untuk guru+tanggal tersebut. Transaksi asli `AdminAttendanceService.change` tetap mengecek revisi dokumen, kewenangan Admin dan mencatat audit secara atomik. Pengubahan waktu harus disertai alasan minimal 10 karakter.
7. **Tidak membuat checkout otomatis, mengubah GPS, antrean sync, aturan Firestore, atau kebijakan pengingat R89-B.** "Belum tercatat" hanya status yang ditemukan di server; mungkin ada checkout guru yang masih tertunda dalam antrean offline. Admin perlu memeriksa dengan guru sebelum mengisi waktu secara manual.

## Instalasi patch

1. Commit/backup repository sebelum patch.
2. Ekstrak isi ZIP patch ke **root** repository dengan struktur `src/`, `scripts/`, `docs/` (hanya file yang berubah/baru; jangan menimpa seluruh repository).
3. Jalankan:
   - `node --experimental-strip-types scripts/test_r89c_missing_checkout.mjs`
   - `node --experimental-strip-types scripts/test_r89b_smart_checkout.mjs`
   - `npm ci`
   - `npm run lint`
   - `npm run build`
4. Deploy dulu ke **Vercel Preview**, lalu uji dengan akun Admin dan akun guru.

## UAT sebelum rilis produksi

- **Hari ini**: guru check-in belum checkout tampil hanya pada status hari ini; setelah checkout status berubah menjadi Selesai.
- **Hari lampau**: tidak ada entri bila sudah checkout; muncul satu kasus "Belum tercatat" jika dokumen check-in server tidak memiliki jam pulang.
- **Offline / pending sync**: tidak ada klaim konfirmasi dari cache. Saat online kembali, klik Segarkan dari Server; konfirmasi kondisi guru bila ada proses sync tertunda.
- **Duplikat**: dua presensi orang+tanggal yang sama harus pindah ke review manual, bukan menjadi satu alarm palsu.
- **Paginasi**: bila lebih dari 100 entri, angka diberi tanda parsial. Tanggal yang terbelah antarhalaman harus ditahan hingga halaman berikutnya dimuat. Pencarian hanya pada dokumen terunduh.
- **Koreksi**: sebelum dialog dibuka, klik diverifikasi ke server; jika ada checkout baru/ganda, koreksi ditolak. Saat kirim, verifikasi diulang dan transaksi existing tetap menolak data yang sudah berubah; alasan audit wajib.
- **Role**: non-Admin tidak boleh membuka panel; uji guard server terhadap pengguna tanpa role Admin untuk perubahan.
- **Aksesibilitas**: cek mobile/desktop, dark/light, scroll, fokus, refresh setelah koreksi, dan pindah tanggal WIB.

## Verifikasi di lingkungan penyusunan

- 29/29 pemeriksaan otomatis R89-C **PASS**.
- 14/14 regresi R89-B **PASS**.
- Transpilasi sintaks TypeScript/TSX untuk seluruh file kode yang berubah **PASS**.
- `npm ci` terhenti akibat registry eksternal tidak dapat diakses (`EAI_AGAIN`); `npm run lint` / `npm run build` **belum dapat diverifikasi** di lingkungan ini.
- Tidak ada pengujian terhadap Firestore produksi atau deploy Vercel. Rilis dilakukan setelah gate build dan UAT Preview di lingkungan pengguna.

## Keterbatasan yang disengaja

- Untuk hemat pembacaan Firestore, panel bukan listener realtime. Perubahan guru harus diambil dengan *Segarkan dari Server* atau setelah koreksi Admin.
- Hasil hitung/penelusuran masih **parsial** bila masih ada halaman yang belum diambil, dan pencarian berlaku hanya pada data yang terunduh.
- Re-check guru+tanggal perlu membaca presensi **seluruh tanggal** untuk menangkap duplikat tanpa membutuhkan indeks komposit baru; proses ini hanya terjadi saat melakukan koreksi.
- Deteksi terhadap checkout yang **belum tersinkron di perangkat lain** tidak mungkin dijamin dari data Firestore. Tidak ada sistem yang boleh menjadikan "belum tercatat" sebagai checkout otomatis.
- Ada sela kecil antara verifikasi daftar duplikat dan transaksi pengubahan. Transaksi tetap mengunci versi dokumen yang diedit, tetapi dokumen duplikat baru yang dibuat bersamaan tidak dapat dicegah sepenuhnya oleh transaksi satu dokumen. Admin wajib konfirmasi secara operasional.
