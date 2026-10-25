# CHECKLIST EKSEKUSI CURSOR — R85

**Nama:** Piket Guru R85 — Login Toggle Compact Right Alignment & Friendly Student Leave Labels  
**Basis wajib:** repository setelah R84. **Jangan** memasang kembali R76/R77/R80 dari arsip lama.  
**Ruang lingkup:** UI login dan label pilihan izin saja, tanpa perubahan backend, AuthContext, Firestore Rules, enum, PIN, atau PWA.

## A. Persiapan

- [ ] Pastikan branch GitHub Desktop adalah branch aplikasi Piket Guru yang terbaru dan login R84 berjalan.
- [ ] Buat checkpoint commit/tag sebelum R85; pastikan tidak ada perubahan lokal yang belum ditinjau.
- [ ] Ekstrak ZIP R85 ke akar repository `piket-guru`, pertahankan path `src/`, `scripts/`, dan `docs/`; jangan menimpa seluruh repository.
- [ ] Di GitHub Desktop → Changes, pastikan perubahan aplikasi **hanya** `src/features/auth/LoginPage.tsx` dan `src/components/common/MobileChoiceSelect.tsx` (ditambah test dan dokumen).

## B. Login — toggle di kanan

- [ ] Periksa `src/features/auth/LoginPage.tsx`, bagian `login-method-panel`.
- [ ] Label **Metode masuk** berada di kiri, toggle kecil **Nama | ID/NIP** di **kanan**, dengan `flex-wrap` ketika ruang sempit.
- [ ] Input pencarian/ID berada **di baris berikutnya** dan memakai lebar penuh, tidak lagi berbagi satu kotak dengan toggle.
- [ ] Ikon outline ~14px, border halus, pilihan aktif jelas. Tombol minimal **44px mobile**, **40px desktop**.
- [ ] Saat mode Nama aktif, input menampilkan **Cari nama atau ID...** dan hasil pencarian.
- [ ] Saat mode ID/NIP aktif, hanya input ID/NIP yang tampil.
- [ ] Saat keluar dari input ID yang belum diverifikasi, ID tersembunyi dan PIN terkait dibersihkan (pengaman salah akun R84).
- [ ] `aria-label`, `aria-pressed`, fokus keyboard, tombol hapus pencarian, foto akun, dan status Coba Lagi masih berfungsi.

## C. Izin Siswa — label ramah tanpa underscore

- [ ] Periksa `src/components/common/MobileChoiceSelect.tsx`. Komponen harus membaca teks dari **children JSX berbentuk array**, bukan jatuh kembali ke enum value.
- [ ] Buka menu **Izin Siswa → Terbitkan Surat Izin** dan pilih **Jenis Izin Siswa** di HP.
- [ ] Pastikan opsi tertulis dengan format ramah, misalnya **Sakit (Pulang / Rujukan UKS)**, **Urusan Keluarga Mendesak**, **Dispensasi Lomba / Tugas Sekolah**, **Izin Keluar Sebentar (Kembali Lagi)**, dan **Lain-lain** — **tanpa underscore**.
- [ ] Jika admin/sekolah memakai label lain dari konfigurasi, hormati label asli yang sudah dipasok option, jangan ganti dengan kode internal.
- [ ] Pada field pilihan yang sudah terpilih, nama jenis izin juga ramah pengguna.
- [ ] **Nilai tersimpan tetap** `SAKIT_PULANG`, `URUSAN_KELUARGA`, `DISPENSASI_LOMBA`, `KELUAR_SEBENTAR`, `LAINNYA`. Jangan edit nilai enum, service Firebase, atau Firestore Rules.
- [ ] Tinggi item daftar minimal 48 px; label bebas wrap, tidak overflow, dan dapat dipilih/tutup lewat keyboard/layar sentuh.
- [ ] Periksa satu dropdown lain yang memakai `MobileChoiceSelect` untuk memastikan pilihan masih bisa dibuka dan nilai tetap disimpan benar.

## D. Pemeriksaan otomatis wajib di Terminal repository

```bash
npm ci
node scripts/verify_r85_login_permit.cjs
node scripts/verify_login_toggle_r84.cjs
npm run lint
npm run build
```

- [ ] **Semua proses exit code 0** sebelum meneruskan deployment. Jangan menyembunyikan error dengan `any`, `@ts-ignore`, atau mengabaikan kegagalan build.
- [ ] Periksa branch tetap mengandung hotfix R77/R80: jangan mengembalikan `dashboardInfo.types.ts` ke impor Node ESM tanpa ekstensi.

## E. Pemeriksaan visual dan regresi (staging)

- [ ] Cek viewport **320, 360, 390, 430, 768, 1280 px**, light dan dark mode; tidak ada horizontal overflow.
- [ ] Cek nama panjang, list pengguna kosong, tombol **Coba Lagi**, serta mode ID manual saat jaringan gagal.
- [ ] Masuk menggunakan akun Guru dan Admin di lingkungan uji. Verifikasi PIN, foto profil, dan perangkat tepercaya.
- [ ] Buat izin siswa dalam data **staging/uji**; periksa jenis izin ditampilkan ramah namun database menyimpan enum asli.
- [ ] Pastikan dashboard dan menu lainnya tetap dapat dibuka, termasuk setelah update PWA biasa.

## F. GitHub dan rollback

- [ ] GitHub Desktop → Changes: review diff **2 file aplikasi**, 2 script, 1 dokumen. Jangan commit file rahasia atau `node_modules`.
- [ ] Commit contoh: `R85 UI - compact right toggle and friendly student permit labels`.
- [ ] Push origin secara manual, tunggu Vercel berstatus **Ready**, lalu uji deployment baru.
- [ ] Bila login atau form izin bermasalah, rollback commit R85 saja. **Jangan menghapus IndexedDB, draf lokal, atau antrean offline.**

## Catatan hasil validasi pembuat ZIP

- Pemeriksaan statis/perilaku R85: **26/26 PASS**, termasuk penanganan children array JSX dan pemilihan nilai enum asli.
- Tes handler login R84 yang disesuaikan layout: **30/30 PASS**.
- Simulasi statis Chromium: **12/12 PASS** (6 lebar × light/dark), bukan tes browser produksi.
- `npm ci --offline` terhambat `ENOTCACHED yargs-parser@21.1.1`; **lint/build penuh tidak dapat dinyatakan lulus** dari lingkungan pembuatan ZIP.
- Belum menguji sistem dengan akun sekolah nyata atau Firebase produksi.
