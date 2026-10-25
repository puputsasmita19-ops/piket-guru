# Piket Guru R86-E2 — Controlled Listener Optimization (Pilot Laporan)

## Ruang lingkup dan status

**Pilot opt-in untuk development/Vercel Preview saja. NONAKTIF secara default.** Menjadi aktif bila kedua syarat terpenuhi pada setiap tab percobaan:

1. build `VITE_R86E2_REPORTS_PILOT=enabled`
2. URL memuat `?r86_e2_pilot=1`

**Tidak ada perubahan Firebase Rules, autentikasi, notifikasi, modul presensi, input siswa, buku piket, offline queue, update PWA, atau storage data pengguna.** R86-E2 tidak mengubah `FirestoreService`, `sharedLiveSource`, dan tidak mengirim kredensial/data ke `BroadcastChannel`.

### Kenapa Laporan?

Audit E1 pada *arsip* mencatat **7 pemanggilan subscribeToCollection** untuk laporan operasional dalam `ReportsPreview.tsx`, yang aktif selama modul laporan di-mount, bahkan jika browser menaruh tab di background. Data laporan adalah **view read-only** dan tujuh source operasional itu memiliki cleanup jelas. Ini menjadikannya kandidat *pilot* yang lebih terbatas dibanding dashboard, presensi, session atau feed notifikasi.

**Belum ada baseline runtime dari Git HEAD terbaru yang diberikan di percakapan.** E2 adalah *eksperimen terkontrol* untuk mengukur manfaat, **bukan klaim sudah mengurangi billed reads**. Source penyusunan: snapshot lokal + patch R86-A sampai E1; bukan checkout HEAD pengguna yang diverifikasi.

## Perilaku

- Tujuh listener laporan yang ada tetap utuh. Tidak ada perubahan query, filter tanggal, cache, atau cleanup.
- Jika tab yang menampilkan **Laporan** menjadi tersembunyi, tab R86-E2 lain **masih terlihat**, tidak ada ekspor/cetak/modifikasi foto aktif, dan kondisi bertahan selama **2 menit**, hook memberi `reportRealtimeEnabled=false` sehingga cleanup React yang sudah ada melepas tujuh listener itu.
- Saat tab terlihat lagi, peer menghilang, atau operasi penting dimulai, hook kembali `true` dan effect mendaftarkan ulang semua listener dengan query periode yang sama. Status memuat kembali menunggu callback snapshot yang diperlukan.
- `schedules`, `teachers`, `incidentCategories` sebagai master data tetap live; tab lain, halaman Dashboard/Presensi/notifikasi/auth tidak disentuh.
- Tanpa `BroadcastChannel`, tanpa peer lain, halaman tetap terlihat, kerja sensitif masih aktif, atau flag opt-in tak lengkap: **listener tetap aktif**.
- Browser dapat menunda timer saat tab tidak terlihat. Durasi 2 menit adalah minimum sebelum upaya pause; bukan SLA pasti.

## Persyaratan pemasangan

- Repository GitHub lokal terbaru telah **Fetch origin → Pull origin** dan checkpoint commit.
- R86-A/B/C/D dan E1 sudah terpasang. Ini bukan dependensi runtime wajib R86-E2, tetapi diperlukan untuk audit dan pembandingan.
- Source `src/features/reports/ReportsPreview.tsx` masih memiliki struktur listener yang kompatibel. Jika tidak, installer **STOP**; jangan paksa.
- Baseline E1 hasil **checkout HEAD terbaru** sebaiknya sudah diambil sebelum pilot.

## Isi ZIP (hanya file baru)

- `src/services/multitab/r86e2ReportPilot.ts` — peer-presence lokal yang dibatasi untuk pilot.
- `src/services/multitab/useR86E2ReportLive.ts` — React hook untuk grace period, kerja penting, pemulihan.
- `scripts/apply_r86e2_safe.cjs` — dry-run lalu patch satu file `ReportsPreview.tsx` aktual; idempoten dan fail-closed.
- `scripts/verify_r86e2_controlled.cjs` — uji source, guard, parse, installer.
- `docs/R86E2_CONTROLLED_OPTIMIZATION.md` — dokumen ini.
- `docs/CHECKLIST_CURSOR_R86E2.md` — checklist eksekusi.

**Pemasang mengubah tepat satu existing file**: `src/features/reports/ReportsPreview.tsx`. ZIP tidak memasukkan snapshot versi lama dari file tersebut.

## Eksekusi aman

Di root repository lokal:

```bash
node scripts/apply_r86e2_safe.cjs            # dry run; tidak menulis source
node scripts/apply_r86e2_safe.cjs --apply    # mengubah satu file setelah anchor cocok
node scripts/verify_r86e2_controlled.cjs
npm ci
npm run lint
npm run build
```

Jika `STOP` / lint / build gagal, **jangan push**. Jangan menyalin `ReportsPreview.tsx` dari snapshot lama untuk melewati STOP. Review `git diff` setelah pemasangan: hanya komponen Laporan, dua modul baru, script dan docs R86-E2 yang boleh berubah.

### Vercel Preview (bukan produksi)

1. Atur `VITE_R86E2_REPORTS_PILOT=enabled` pada environment **Preview saja**, kemudian build Preview baru.
2. Pada **masing-masing** 2-5 tab yang ingin diuji, gunakan Preview URL `/...?r86_e2_pilot=1`.
3. Buka menu **Laporan** pada tab pilot, gunakan data uji, bukan data produksi.
4. Di tab lama, arahkan ke background selama minimal 2 menit saat tab pilot lain tetap terlihat.
5. Periksa R86-C (jika instrumennya opt-in) untuk `active` count kategori collection; saat tab lama menjadi aktif, pastikan kembali ke angka normal dan semua laporan memuat data terkini.
6. Uji tab dengan ekspor dokumen, modal cetak, review foto dan upload; jangan ada data hilang atau operasi gagal.
7. Tutup tab kedua: tab pertama tidak boleh bertahan dalam keadaan suspend jika tidak ada peer terlihat.
8. Uji browser tanpa BroadcastChannel (fallback), BFCache, offline→online, ganti akun, dan 1/2/3/5 tab.

**Perbandingan terisolasi:** ambil runtime `__PIKET_R86C__?.snapshot()` dan `__PIKET_R86D__?.report()` serta baseline E1 dan Firebase Console Usage sebelum/sesudah. Callback listener tidak setara billed reads, dan penghematan satu skenario belum membuktikan penurunan biaya jangka panjang. Waspadai read tambahan akibat resubscribe.

## Gate produksi dan rollback

**Jangan aktifkan di produksi dulu.** Semua skenario login/logout, presensi, buku piket, draf offline, foto dan notifikasi harus lolos staging. Pastikan penghematan nyata > dampak biaya resubscribe, tidak ada keterlambatan data dan error.

**Rollback instan:** hapus flag `VITE_R86E2_REPORTS_PILOT` dari Preview dan rebuild. Tanpa flag, hook selalu mengembalikan `true`, jadi ketujuh listener berjalan seperti versi sebelum E2. Rollback kode: `git revert` commit E2 (jangan menghapus cache/IndexedDB).

## Verifikasi yang sudah/yang belum

- Uji statis + installer pada snapshot lokal: 24/24.
- Pengujian browser Chromium pada dua iframe *same-origin* (uji komunikasi peer, bukan 2 tab produksi): 10/10.
- Parse TSX dan TypeScript berhasil.
- Uji lint/build app penuh: **belum selesai di lingkungan pembuat paket** (dependensi proyek/HEAD aktual belum tersedia).
- Pengujian Firebase staging, data presensi/offline nyata, dan perbandingan billed reads: **belum dilakukan**.

## Batasan desain

- Pausing hanya berlaku bagi report subscriptions saat **halaman Laporan di-mount pada tab yang tersembunyi**. Bila browser membongkar komponen saat navigasi, cleanup normal sudah berlaku.
- Perangkat/browser yang memisahkan origin/profil tidak saling mendeteksi; ini fail-open.
- Peers adalah sinyal observasi, **bukan security leader, hak akses, ataupun kunci antrean**.
- Nilai `VITE_...` masuk bundle frontend; bukan tempat rahasia/token. Tetap gunakan kebijakan Preview dan akun uji.
