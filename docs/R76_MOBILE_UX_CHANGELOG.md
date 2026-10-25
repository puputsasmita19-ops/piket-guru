# Piket Guru R76 — Mobile UX: watermark, nama panjang, dan pemilih opsi

Basis sumber: `piket-guru-main.zip` dengan patch R68–R75 yang sudah diunggah di percakapan. Paket ini hanya berisi berkas baru/diubah, **bukan seluruh repository**. Tanggal: 25 Oktober 2026.

## Perubahan

1. **Foto dokumentasi:** `CameraCaptureModal` tidak lagi menampilkan keterangan watermark generik apabila formulir sudah memberikan subtitle. Kalimat di Siswa Terlambat dan Laporan Kejadian diringkas menjadi *Foto dilengkapi watermark otomatis.* Stempel foto sebenarnya **tidak diubah**.
2. **Dashboard:** sapaan kini memiliki dua kolom tetap (teks dan avatar/kontrol). Pause berada di kolom kanan **di bawah avatar** dan tidak mendesak kalimat. Nama panjang yang tidak muat di samping `Halo,` otomatis turun ke baris berikutnya. Teks nama yang meluap dapat berjalan horizontal pada satu baris.
3. **Login:** kartu akun terpilih dan ringkasan akun menggunakan `OverflowName`. Animasi berjalan **hanya ketika teks benar-benar melewati ruang**, berhenti saat hover, tidak berjalan dalam mode `prefers-reduced-motion`, dan nama penuh tersedia bagi pembaca layar.
4. **Pengaturan Admin:** Pengaturan Sekolah → Sapaan & Flash Info Dashboard → `Tampilan nama pengguna`. Admin bisa mengaktifkan/mematikan animasi serta memilih durasi 8/12/16/20/28 detik. Pengaturan tersimpan melalui `SchoolSettingsService.saveDashboardInfoSettings`; pada login, endpoint publik hanya mengembalikan pasangan boolean/durasi `publicNameMarquee`, bukan konfigurasi internal sekolah lainnya.
5. **Pilihan opsi mobile:** Komponen baru `MobileChoiceSelect` memakai select HTML asli pada desktop dan opsi ringkas, terurut, dengan pilihan aktif bertanda centang, pada mobile. Integrasi 21 dropdown di 10 formulir utama: laporan kejadian (3), siswa terlambat (4), buku tamu (2), guru pengganti (2), izin siswa (2), pengguna (2), jadwal (2), pengumuman (2), check-in tamu publik (1), form siswa (1). Penyimpanan dan nilai enum tidak diubah. Native select yang belum diintegrasikan tetap mendapat tinggi minimum 44px di dalam dialog pada mobile.

## Pengujian

- `NODE_PATH=$(npm root -g) node scripts/verify_mobile_ux_r76.cjs` — **34/34 PASS** pada lingkungan pembuat.
- Regresi R75 PWA **18/18**, struktur R75 **26/26**, kontrol R73 **22/22**, hak akses R74 **20/20**, pencatatan lintas perangkat R68 **13/13** — semua PASS.
- Sintaks TypeScript/TSX: file perubahan valid.
- `npm ci --offline`: gagal `ENOTCACHED` pada `yargs-parser@21.1.1`; `npm run lint` gagal karena dependensi/tipe belum terpasang; `npm run build` tidak dapat dijalankan karena `vite` tidak tersedia. **Tidak boleh diklaim build lulus**.
- Belum diuji pada browser Android nyata, Firebase produksi, ataupun Vercel. Jangan uji pengeditan data sekolah tanpa backup/staging.

## Pemasangan

1. Mulai dari repository **R75** yang sudah Anda terapkan.
2. Ekstrak ZIP incremental ke root `piket-guru`, timpa berkas dengan jalur yang sama.
3. Pastikan GitHub Desktop menampilkan komponen `DashboardWelcome.tsx`, `LoginPage.tsx`, `CameraCaptureModal.tsx`, `DashboardInfoSettingsCard.tsx`, `IncidentFormModal.tsx`, dan berkas baru `OverflowName.tsx`/`MobileChoiceSelect.tsx`.
4. Jalankan `npm ci`, `node scripts/verify_mobile_ux_r76.cjs`, `npm run lint`, `npm run build`. Jangan push ke produksi jika lint/build gagal.
5. Commit → Push origin, tunggu Vercel Ready.
6. Uji Admin → Pengaturan Sekolah → Sapaan & Flash Info Dashboard → Tampilan nama pengguna; simpan/matikan/ubah kecepatan. Uji akun guru dengan nama panjang pada dashboard dan login. Uji Laporan Kejadian, Izin Siswa, Siswa Terlambat di layar 320/360/390 px: pilihan terpilih benar, form dapat dibatalkan, tidak scroll horizontal, watermark muncul satu kali.

## Batasan & tindak lanjut

Tidak semua filter/selector administratif dalam 39 berkas fitur diubah pada R76. Penggunaan kontrol baru difokuskan ke **formulir input operasional** terlebih dahulu agar tidak merusak filter/query/validasi yang sudah berjalan. Pemilih yang tidak dikonversi masih memakai kontrol native OS. Audit serta migrasi fitur administratif lain sebaiknya dijadwalkan terpisah setelah pengujian perangkat nyata.

Tidak ada perubahan Firebase Rules, struktur koleksi Firestore, aturan hak akses, proses upload, atau sistem presensi.
