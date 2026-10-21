# Piket Guru — Patch Incremental R8: Monitoring Piket + Edit/Hapus Presensi

Tanggal: 21 Oktober 2026

## Fitur

- Menu sidebar khusus **ADMIN**: **Monitoring Piket Realtime** (tersedia di menu lainnya pada mobile). Kartu statistik guru dijadwalkan, hadir, belum hadir, belum pulang, selesai piket, dan jurnal buku piket yang sudah dikirim.
- Status petugas hari ini mengikuti snapshot Firestore untuk tanggal WIB berjalan, menampilkan jam masuk/pulang, jarak dan status GPS, serta data guru berjadwal yang belum presensi.
- Aktivitas jurnal piket hari ini: ringkasan catatan, tindak lanjut, status, waktu perubahan; bersumber dari `dutyBooks` realtime.
- Panel rekap sejarah monitoring: rentang waktu, pemilihan guru, pencarian dan paginasi; memakai query Firestore berdasarkan periode.
- Tambahan tombol **Edit** dan **Hapus** di rekap **Presensi GPS → Rekap Kehadiran** untuk ADMIN saja.
- Dialog koreksi waktu WIB, status administrasi dan keterangan. Identitas, tanggal, foto, koordinat serta bukti GPS asli tidak dapat dimodifikasi melalui dialog.
- Untuk edit/hapus wajib alasan minimal 10 karakter. Hapus permanen disertai konfirmasi; peristiwa dan snapshot ringkas dicatat pada `auditLogs` atomik dengan update/delete `attendance`.
- Perlindungan terhadap perubahan simultan: penolakan jika snapshot rekaman yang dibuka sudah berubah, serta pengecekan profil admin aktif di transaksi. Hanya online.

## Keamanan dan kompatibilitas

- Firestore rules yang sudah ada pada source R7 **sudah** mengatur `attendance.update` dan `attendance.delete` untuk `isAdmin()` dan `auditLogs.create` untuk pengguna aktif. Tidak perlu menerapkan perubahan aturan keamanan khusus patch ini.
- Tetap menggunakan `AttendanceRecord` dari Firestore, `useAuth`, dan `FirestoreService.subscribeToCollection` dari proyek. Tidak menambah database baru atau dependency baru.
- Penghapusan memutus tampilan histori/statistik; catatan audit **tidak** menyimpan raw foto berukuran besar. File foto eksternal yang mungkin telah disimpan di Google Drive tidak ikut dihapus otomatis.
- Rekap dashboard berbasis periode pilihan untuk menghindari listener historis seluruh database. Listener realtime untuk hari ini, jurnal hari ini, dan master jadwal (seperti halaman dashboard saat ini).
- Pada mode presensi BEBAS, presensi tanpa jadwal muncul sebagai `Presensi tambahan / tanpa jadwal` dan tidak dihitung sebagai personel **dijadwalkan**.
- Perubahan waktu dibatasi pada tanggal presensi yang sama, tidak mendukung shift melewati tengah malam. Jika organisasi memakai shift lintas hari, perlu perubahan kebijakan sebelum memakai koreksi waktu tersebut.

## Isi patch / penempatan

Ekstrak ke direktori root repositori lokal (folder yang berisi `src`): struktur asli `src/`, `scripts/`, `docs/` dipertahankan. Hanya file yang berubah/baru ada di ZIP; jangan hapus file lain.

## QA yang dijalankan

- `NODE_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules node scripts/verify_admin_attendance_round8.mjs`: 25/25 pemeriksaan lulus (sintaks 9 file, validasi waktu WIB, pengujian transaksi simulasi, audit, konflik, otorisasi, navigasi).
- `npm ci`: gagal di lingkungan ini (`Exit handler never called!`, dependensi unduhan tidak lengkap).
- `npm run lint`: belum lulus karena sejumlah paket `@types/*` tidak tersedia.
- `npm run build`: belum dapat dijalankan karena `vite` tidak terpasang.
- Pengujian login Firebase produksi, rules emulator, pengeditan/hapus riil dan beban simultan di Vercel belum dilakukan.

## Sebelum push GitHub Desktop

Di komputer dengan akses registry NPM, setelah memasukkan file patch ke repository yang sebelumnya sudah Anda update ke R7:

```sh
npm ci
npm run lint
npm run build
node scripts/verify_admin_attendance_round8.mjs
```

Jalankan manual di akun admin untuk memverifikasi data presensi pengujian (bukan presensi produksi): login sebagai ADMIN, buka menu baru, uji perubahan waktu dan alasan, lihat audit dan realtime, kemudian uji hapus dengan data **uji** dan cek beberapa perangkat. Uji juga akun GURU/KEPALA_SEKOLAH untuk memastikan tidak dapat edit/hapus dan menu admin tersembunyi.

Pastikan Vercel Deployment berstatus Ready. **Jangan anggap audit ini sebagai sertifikasi stabilitas banyak pengguna** tanpa uji beban, jaringan, dan Firebase Rules nyata.
