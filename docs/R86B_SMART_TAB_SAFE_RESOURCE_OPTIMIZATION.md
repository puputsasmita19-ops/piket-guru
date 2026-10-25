# Piket Guru R86-B — Smart Tab Detection & Safe Resource Optimization

**Status:** paket incremental untuk **development / staging opt-in** setelah R86-A. Bukan pengambilalihan tab atau sertifikasi siap produksi.
**Tanggal:** 25 Oktober 2026.
**Basis:** source R86-A hasil audit yang tersedia, bukan verifikasi langsung HEAD GitHub. Untuk GitHub terbaru, paket **tidak membawa atau menimpa `src/main.tsx`**; gunakan pemasang aman terhadap file aktual di komputer.

## Tujuan

Mengenali tab Piket Guru lain yang masih terlihat dalam origin dan browser-profile yang sama, lalu menahan **hanya animasi visual dekoratif** ketika tab ini disembunyikan dan ada tab lain yang terlihat. Tab yang kembali aktif otomatis pulih.

- Protokol `BroadcastChannel('piket-guru-r86b-visual-only-v1')`; pesan hanya `{schema,signal,tab,visible}`. `tab` adalah ID acak sementara, bukan UID/NIP.
- Pesan `HELLO`/`STATE`/`LEAVE`, masa kedaluwarsa rekan 90 detik. Interval observasi 15 detik foreground, 40 detik background; browser dapat menunda timer hidden.
- DOM marker `html[data-r86b-visual-quiet="true"]` hanya menyentuh CSS: `.login-gradient-motion > span`, `.login-credit-track`, `.overflow-name[data-scrolling="true"] .overflow-name-track`. Tidak menyentuh animasi progress penyimpanan, notifikasi, atau presensi.
- Tidak ada tab leader, tidak ada enforcement sesi, tidak ada read/write ke Firestore, IndexedDB, localStorage, sessionStorage, offline queue, draft, kamera/foto, atau kredensial.
- Tab yang sama-sama terlihat tetap normal; jika kanal tidak tersedia atau rekan kedaluwarsa, fitur tidak memaksa status pasif. `pagehide/pageshow` mempertimbangkan BFCache; teardown melepas interval, listener, dan marker CSS.

## Kenapa masih staging?

R86-A telah menunjukkan mesin antrean offline menggunakan Web Locks/lease IDB dan listener realtime dashboard/notifikasi. Pekerjaan penting ini **tidak aman** untuk dihentikan secara generik hanya karena ada tab lain. Fase B tidak mengintersepsi atau memutus listener dan tidak menjamin pengurangan Firestore reads. Hanya penghematan animasi di hidden duplicate tabs yang dapat diukur lebih lanjut dengan Performance DevTools. Browser juga sudah melakukan background throttling, jadi besarnya penghematan tambahan bisa kecil.

### Isi ZIP (semua **file baru**, tidak menimpa source aplikasi lama)

- `src/services/multitab/r86bSafeTabCoordination.ts`
- `src/services/multitab/r86bDecorative.css`
- `scripts/apply_r86b_safe.cjs`
- `scripts/verify_r86b_safe.cjs`
- `scripts/verify_r86b_installer.cjs`
- `docs/R86B_SMART_TAB_SAFE_RESOURCE_OPTIMIZATION.md`
- `docs/CHECKLIST_CURSOR_R86B.md`

Hanya setelah menjalankan `apply_r86b_safe.cjs --apply` terdapat **satu blok opt-in baru** pada `src/main.tsx` aktual, tanpa mengganti keseluruhan file.

## Pasang ke repository terbaru (harus sudah R86-A)

1. GitHub Desktop: Fetch origin → Pull origin → cek working tree bersih → simpan checkpoint. Jika source R86-A di repo belum terpasang, instal dan validasi R86-A terlebih dahulu.
2. Ekstrak R86-B ZIP ke root `piket-guru`; file baru menempati folder `src/services/multitab`, `scripts`, `docs`. Pastikan tidak ada file yang tertimpa tanpa sengaja.
3. Jalankan di root:

```sh
node scripts/apply_r86b_safe.cjs                # dry-run, tanpa modifikasi
node scripts/apply_r86b_safe.cjs --apply        # injeksi opt-in pada main.tsx aktual
node scripts/verify_r86b_safe.cjs
node scripts/verify_r86b_installer.cjs
node scripts/verify_r86a_multitab.cjs
npm ci
npm run lint
npm run build
```

4. Jika pemasang menampilkan **STOP**, jangan menyalin `main.tsx` dari snapshot lama. Audit file dengan Cursor dan cocokkan titik bootstrap. Jangan Push sebelum tes dan build berhasil.
5. Periksa `git diff`: seharusnya hanya ada 7 file baru dan satu blok tambahan di `src/main.tsx`. **Tidak boleh ada perubahan:** `AuthContext`, Firestore rules, syncQueueService, offlineStorage, notificationFeedService, hooks presensi, PWA update.
6. Gunakan Preview/Staging. Jika semua uji staging lulus, Commit/Push manual; jangan set variabel flag di lingkungan Production umum.

## Aktivasi opt-in di browser

Local Vite DEV: `http://localhost:5173/?r86_tab_opt=1` (sesuaikan port). Pada staging Vercel, set `VITE_R86_TAB_OPT=enabled` **hanya untuk Preview environment**, rebuild Preview lalu buka `https://<preview-domain>/?r86_tab_opt=1`. Keduanya syarat: build DEV/flag staging **dan** URL flag. Parameter query harus sebelum `#` jika menggunakan hash routing.

Opsional jalankan R86-A bersamaan dengan URL `?r86_audit=1&r86_tab_opt=1`, setelah menyiapkan `VITE_R86_AUDIT=enabled` pada Preview untuk R86-A.

DevTools Console:

```js
window.__PIKET_R86B__?.snapshot()
// Check observedPeers, observedVisiblePeers, visualQuiet, messagesReceived.
// Hanya statistik tanpa identitas.
window.__PIKET_R86B__?.stop() // hentikan tanpa logout/clear cache
```

`observedPeers` menghitung hanya tab yang juga mengaktifkan R86-B, origin/browser yang sama; ini bukan jumlah semua tab Piket Guru yang sedang terbuka.

## Matriks staging wajib

| Pengujian | Ekspektasi | Status |
|---|---|---|
| Satu tab aktif atau hidden, tanpa peer | Tidak masuk visual-quiet | Belum diuji staging |
| Dua tab terlihat | Keduanya aktif, tidak dibatasi | Belum diuji staging |
| Tab A hidden dan B visible | A menahan 3 kelompok animasi dekoratif, B normal | Belum diuji staging |
| A kembali visible | A pulih segera, tanpa reload | Belum diuji staging |
| B ditutup | A tidak terus terpasifkan; LEAVE/TTL bekerja | Belum diuji staging |
| 3–5 tab di HP/desktop | Tidak crash, tidak ada modal/notification ganda akibat R86-B | Belum diuji staging |
| Akun berbeda pada dua tab | Tidak mengirim identitas, session/restrictions unchanged | Belum diuji staging |
| Presensi datang/pulang | Validasi, lokasi, selfie tetap seperti baseline | Belum diuji staging |
| Kirim offline + foto/draf | Tidak ada kehilangan data, Web Lock/lease tetap berlaku | Belum diuji staging |
| PWA update pada tab aktif & pasif | Gate update tetap aman, tidak ada cache wipe | Belum diuji staging |
| Production build tanpa flag | Tidak tersedia `window.__PIKET_R86B__` | Belum diuji deployment |
| Compare CPU/long tasks/Firestore reads | Ukur baseline vs opt-in; jangan klaim angka tanpa pengukuran | Belum diukur |

## Hasil pemeriksaan pembuat patch

- Simulator Node VM dua tab, tanpa Firebase: **20/20 PASS** (visible/hidden, peer TTL, fallback, BFCache, cleanup, pesan tanpa identitas).
- Pemasang dry-run, idempotensi, guard R86-A dan bootstrap: **5/5 PASS**.
- Uji R86-A lama: **11/11 PASS**.
- `tsc --noEmit` terhadap modul R86-B tersendiri: **PASS**.
- Chromium dua frame `about:blank` dari satu origin (simulasi real `BroadcastChannel` dan CSS): **PASS**. Pengujian multi-tab situs staging nyata belum dilakukan; URL localhost diblokir oleh kebijakan browser lingkungan.
- `npm ci`, lint/build penuh: belum dapat diverifikasi karena ketidaklengkapan cache NPM di container.

## Henti / Rollback

Untuk menghentikan fitur sementara: hapus query `r86_tab_opt=1`, atau matikan `VITE_R86_TAB_OPT` pada Preview dan redeploy. Jika perlu rollback commit, kembalikan **blok R86-B saja** di `src/main.tsx`, biarkan R86-A. Tidak perlu menghapus IndexedDB, login, atau data situs; jangan clear browser storage karena bisa ada draf offline.

## Tahap selanjutnya

Sebelum optimasi listener Firestore dan notifikasi, ukur jumlah listener sesungguhnya, frekuensi read, tab yang hidden, dan status kegiatan kritis. Tahap berikutnya baru boleh menerapkan strategi data/listener sesuai hasil pengukuran dan guard nyata, bukan memakai kehadiran tab sebagai alasan membatalkan transaksi.
