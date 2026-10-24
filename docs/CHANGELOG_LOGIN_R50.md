# Piket Guru R50 — Login ringkas, foto akun, tanggal mobile

Tanggal: 24 Oktober 2026

## Perubahan antarmuka
- Judul visual **Cari pengguna** dihilangkan; label tersembunyi tetap tersedia bagi pembaca layar.
- Teks **Masukkan ID manual / Cari nama** menjadi tombol ikon berukuran sentuh dengan `title`, `aria-label`, dan status aktif; pilihan login manual tetap bekerja.
- Avatar huruf inisial pada pilihan nama diganti ikon pengguna netral. Kartu akun terpilih bisa menampilkan foto yang **diizinkan secara khusus**.
- Header mobile menggunakan tanggal yang juga menampilkan tahun: contoh `Sab, 24 Okt 2026` (timezone Asia/Jakarta).

## Keamanan foto profil pada halaman login
Foto saat ini adalah arsip Drive privat, dan tidak boleh dibuka begitu saja tanpa sesi login. Untuk kebutuhan foto pada halaman login:

1. Login sebagai **Administrator**.
2. Masuk ke **Master Pengguna**; buka foto profil akun yang dimaksud.
3. Pastikan foto sudah tersimpan.
4. Aktifkan **Tampilkan foto akun ini di halaman login** setelah mendapat persetujuan pihak terkait.
5. Foto hanya dimuat untuk akun yang dipilih dan hanya setelah Admin mengaktifkan pilihan ini.
6. Saat Admin menghapus atau mengganti foto, akses login publik **otomatis dinonaktifkan** dan perlu persetujuan ulang.
7. Tanpa izin, foto tetap privat dan ikon pengguna netral tetap ditampilkan.

Sebuah endpoint foto baca-saja dibuat dengan pemeriksaan `isActive`, izin eksplisit, dan foto Google Drive terkini. Endpoint privat yang ada tidak diubah. Akses mengubah izin foto hanya Admin dan dicatat dalam audit.

## Pemasangan
Patch incremental ini melanjutkan kode R49. Timpa file sesuai jalur, lalu Commit & Push lewat GitHub Desktop. Tidak perlu migrasi database atau perubahan Firestore Rules, karena field `loginAvatarVisible` opsional dan default-nya **false**. Aplikasi lama yang belum diubah tetap aman.

## Verifikasi
Jalankan `node scripts/verify_login_avatar_r50.cjs` setelah dependensi proyek tersedia, lalu `npm run lint` dan `npm run build`. Uji tombol pencarian nama/ID, login PIN, foto pengguna yang disetujui, foto yang belum disetujui, tanggal mobile, dan login Google setelah deploy.
