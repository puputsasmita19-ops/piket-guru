# Piket Guru R57 — Penguatan Sinkronisasi Offline & Pembaruan PWA

Tanggal: 24 Oktober 2026. Sasaran: repository Piket Guru yang **sudah menerapkan R56 dan R53**.

## Audit source yang tersedia
Source dalam sesi ini lebih tua daripada R56 produksi, sehingga installer R57 **tidak menimpa** `syncQueueService.ts`, `offlineStorage.ts`, `draftService.ts`, maupun `appUpdateManager.ts` yang mungkin telah berubah. Pada source lama, antrean sudah mempunyai:

- ID operasi deterministik `userId + collection + recordId` dan `submissionFingerprint`.
- Penyimpanan antrean `createOnly` untuk mencegah perubahan diam-diam saat item sedang dikirim.
- Proteksi Web Locks + lease untuk menghindari proses sinkronisasi ganda lintas tab.
- Pengiriman dengan autentikasi/izin pemilik serta retry/backoff.
- Hitungan draf + antrean di `getPendingCount`, dan `flushPending` untuk draf yang masih menunggu debounce.

R57 mempertahankan mekanisme tersebut. **Tidak ada klaim exactly-once** bila backend tidak menjamin idempotensi; itu harus diuji terpisah menggunakan transaksi Firestore/staging.

## Perubahan R57

### PWA Update Safety Gate
Sebelum tombol **Perbarui** memerintahkan service worker untuk mengganti versi:

1. Blokir bila form/modal dengan input masih terbuka dan terlihat. Pengguna diminta menyimpan/menutupnya dahulu.
2. Selesaikan penulisan draf debounce (`DraftService.flushPending(uid)`) dan periksa apakah identitas akun berubah.
3. Baca jumlah antrean/draf dan detail status dari IndexedDB **strictly**; kegagalan membaca penyimpanan tidak boleh diperlakukan sebagai antrean kosong.
4. Blokir pembaruan saat ada data berstatus `SENDING`.
5. Jika ada draf/kiriman belum selesai di **perangkat bersama**, blokir karena penyimpanan mungkin hanya ada di RAM.
6. Jika ada antrean/draf di **perangkat pribadi tepercaya**, tampilkan konfirmasi eksplisit sebelum update. Pengguna dapat membatalkan dan menyinkronkan dahulu.
7. Jika tidak ada hambatan, panggil kembali mekanisme pembaruan R53 yang sudah ada. Tidak ada penghapusan data lokal, cache, storage, atau cookies pada pengaman R57.

Pesan kesalahan muncul pada banner update melalui `catch` yang sudah ada pada R53.

## Berkas dalam ZIP incremental

- `scripts/apply_r57_offline_pwa.cjs` — memasang patch setelah mengecek kecocokan R53+.
- `scripts/r57_templates/pwaUpdateSafety.ts.template` — sumber utilitas, ditempatkan otomatis pada `src/services/offline/pwaUpdateSafety.ts` ketika patch diterapkan.
- `scripts/verify_r57_offline_pwa.cjs` — pemeriksaan statis setelah pemasangan.
- `scripts/test_r57_gate.cjs` — pengujian perilaku helper tanpa Firebase produksi.
- `docs/CHANGELOG_OFFLINE_PWA_R57.md` — panduan dan audit.

Tidak ada folder `src` lama yang ditimpa mentah-mentah.

## Instalasi pada Windows / GitHub Desktop

1. Buat titik pemulihan **commit/tag `backup-r56`** bila belum ada.
2. Ekstrak ZIP R57 ke root repository lokal yang sudah menggunakan R56.
3. Buka GitHub Desktop → **Repository → Open in Command Prompt** (atau terminal).
4. `node scripts/apply_r57_offline_pwa.cjs --dry-run`
5. Bila tertulis `R57 DRY RUN PASSED`, jalankan `node scripts/apply_r57_offline_pwa.cjs`.
6. `node scripts/verify_r57_offline_pwa.cjs`
7. `node scripts/test_r57_gate.cjs` (memerlukan TypeScript; jalankan `npm ci` terlebih dahulu bila belum ada).
8. `npm run lint` dan `npm run build` harus lulus **sebelum Push origin**.
9. Commit/Push origin di GitHub Desktop. Setelah Vercel `Ready`, uji dengan **akun uji** pada HP dan desktop.

Jika `R57 STOPPED SAFELY`, **jangan push**. Source saat ini tidak cocok dengan pola R53 yang telah diaudit. Upload file `src/components/layout/AppUpdateBanner.tsx`, `src/services/offline/syncQueueService.ts`, `src/services/offline/draftService.ts`, dan `src/services/offline/offlineStorage.ts` dari repository terbaru untuk patch langsung.

## Hasil pengujian pada lingkungan ini

- Runtime unit test pengaman update: **11/11 PASS** menggunakan Firebase/IndexedDB tiruan; tidak menyentuh data sekolah.
- Installer pada fixture R53 yang kompatibel: **DRY RUN, APPLY, 16/16 pemeriksaan statis PASS**; pemasangan ganda ditolak.
- Pada source R56 produksi sesungguhnya: **BELUM DIUJI** (source tidak terlampir pada sesi ini).
- `npm run lint`, `npm run build`, Playwright multi-tab, Firestore Emulator, serta Vercel/HP produksi: **BELUM LULUS VERIFIKASI** untuk source R56 sesungguhnya.

## Pengujian penerimaan yang wajib

- Buka formulir Buku Piket, ketik tanpa simpan, tekan Perbarui → harus ditolak.
- Saat ada antrean `SENDING`, tekan Perbarui → harus ditolak.
- Offline pada perangkat bersama: buat draf, tekan Perbarui → harus ditolak.
- Perangkat pribadi tepercaya: buat draf, tekan Perbarui → harus menampilkan konfirmasi; Batalkan tidak boleh reload.
- Tidak ada draf/antrean: Perbarui tetap responsif dan melakukan mekanisme aktivasi normal R53.
- Putuskan internet selama pengiriman; pulihkan koneksi, pastikan data tidak hilang/terkirim dua kali di backend (gunakan **data uji** dan periksa audit).
- Uji kedua tab pada akun yang sama, logout dan ganti akun; status antrean harus terisolasi sesuai UID.

## Batasan

Pengaman ini tidak dapat mendeteksi setiap perubahan state pada komponen yang tidak menggunakan form, modal, atau draft yang tersedia. Juga tidak mengubah logika idempotensi server. Risiko pengiriman sekali-atau-lebih saat koneksi terputus setelah server menerima write harus ditangani dengan ID operasi unik dan transaksi server. Jangan menghapus antrean atau memakai tombol Update pada form aktif.
