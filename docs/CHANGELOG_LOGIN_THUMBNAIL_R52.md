# Piket Guru R52 — Optimasi Thumbnail Foto Login

Tanggal: 24 Oktober 2026.

## Apa yang berubah
- Saat Admin mengunggah foto profil pengguna melalui modal yang sudah tersedia, aplikasi membuat **dua varian** dengan bingkai identik: foto utama maksimal 512 × 512 px (maks. 150 KB) dan thumbnail login **128 × 128 px** (target 18 KB, batas keras 30 KB).
- Kedua varian diunggah ke subfolder privat `Foto_Profil` di Google Drive. File utama tetap diakses hanya melalui endpoint foto privat. File thumbnail dikenali server melalui field metadata internal `loginAvatarThumbFileId` di dokumen `users`.
- Jika Admin sudah memberikan izin tampil publik, `/api/drive/login-avatar/:userId/:fileId` mengirim thumbnail kecil sebagai pengganti foto utama, **tanpa** mengungkapkan file ID thumbnail di daftar pengguna publik.
- Endpoint publik tetap memverifikasi user aktif, izin `loginAvatarVisible`, serta file utama yang tepat **di setiap permintaan**; `Cache-Control: no-store` dipertahankan agar pencabutan izin berlaku pada permintaan berikutnya.
- Penggantian / penghapusan foto mencabut izin tampil publik dan menghapus pointer thumbnail aktif. Foto lama di Drive tetap merupakan arsip privat; tidak dihapus otomatis.
- Akun dengan foto lama masih bisa login dan melihat foto yang diizinkan: endpoint lama tetap fallback menggunakan ukuran sebelumnya. Untuk mengaktifkan thumbnail baru, Admin perlu mengunggah ulang foto profil satu kali dan memberi persetujuan publik lagi.

## Kompatibilitas dan keamanan
- Tidak menambah pustaka/dependensi NPM dan tidak mengubah Firestore Rules, PIN, autentikasi, atau data pengguna lain.
- `loginAvatarThumbFileId` adalah field opsional dan tidak memerlukan migrasi. Saat belum ada, perilaku foto login lama tetap berjalan.
- Tidak men-cache berkas publik di browser/CDN lintas sesi karena izin publik dapat berubah.
- Fitur hanya mengunduh foto pengguna yang sedang dipilih, dengan ikon netral sebagai fallback.

## Cara memasang
1. Pastikan repository sudah menggunakan R51.
2. Ekstrak ZIP incremental R52 ke root repository dan timpa file sesuai strukturnya.
3. Jalankan `npm ci`, `node scripts/verify_login_thumbnail_r52.cjs`, `npm run lint`, dan `npm run build` di komputer yang tersedia dependensinya.
4. GitHub Desktop → Commit → Push origin; tunggu Vercel `Ready`.
5. Admin: pilih akun uji, upload ulang foto profil, aktifkan `Tampilkan foto akun ini di halaman login`, logout, lalu pilih akun itu. Periksa Network tab: respons endpoint login-avatar seharusnya berisi header `X-Avatar-Variant: thumbnail` dan Content-Length <= 30720 bytes.
6. Cabut persetujuan publik, reload login dan pastikan avatar tidak dapat diunduh dan UI kembali ke ikon netral.

## Batas pengujian
- Pemeriksaan lokal R52: 24/24 termasuk decode/validator JPG sungguhan dan transpile TSX.
- `npm ci --offline`: **gagal ENOTCACHED** (`yargs-parser@21.1.1`).
- `npm run lint`: **tidak lulus** karena dependency TypeScript/Vite/Firebase belum lengkap.
- `npm run build`: **tidak lulus** (`vite: not found`).
- Belum teruji langsung terhadap Vercel/Firebase/Google Drive milik sekolah.
