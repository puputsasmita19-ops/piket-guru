# Piket Guru R39 — Jenis Bencana Tambahan dan Lokasi Pusat Komando

Tanggal: 23 Oktober 2026

## Ringkasan
1. Admin dapat menambah hingga 12 jenis bencana/siaga sesuai kondisi sekolah. Setiap jenis memiliki nama, ringkasan, judul peringatan, pesan, checklist operator, kontak rujukan dan status aktif/nonaktif.
2. Admin dapat mengatur lokasi Pusat Komando: nama/ruangan utama, petunjuk lokasi, posko alternatif, titik kumpul, dan arahan menuju posko.
3. Konfigurasi tersimpan dalam `settings/school_config.commandCenterConfig` yang sudah ada; dapat dilihat melalui langganan Firestore realtime pada Pusat Komando.
4. Kategori tambahan yang **aktif** juga ditampilkan di kartu Bel & Darurat beserta tombol **Tinjau Siaga**. Pengaturan tidak mengaktifkan alarm otomatis.

## Cara menggunakan
- Masuk sebagai **Admin**.
- Buka **Pengaturan Sekolah → Bel & Darurat → Edit Bel Darurat & Pusat Komando → Edit Pengaturan**.
- Pilih tab **Jenis Bencana +** lalu **Tambah Jenis Bencana**; isi detail sampai lengkap, aktifkan lalu **Simpan Semua Pengaturan**.
- Pilih tab **Pusat Komando** untuk mengatur lokasi, posko alternatif, dan titik kumpul.
- Cek hasil pada **Pusat Komando**; informasi berubah setelah pembaruan Firestore diterima.

## Keselamatan & kompatibilitas
- Tidak ada jenis bencana bawaan yang dihapus/diubah. Sekolah yang belum memiliki field R39 tetap melihat pengaturan lama.
- Kategori tambahan yang dikirim sebagai siaran sengaja memakai kode backend **GENERAL** dan judul/pesan sesuai jenis tambahan. Ini mempertahankan kompatibilitas `EmergencyType` dan rules lama. Identitas skenario pada riwayat darurat dapat dikenali dari judul/pesannya; bukan kode tipe backend terpisah.
- Menambah/mengedit/mengaktifkan jenis atau lokasi tidak mengirim peringatan, memutar sirene, ataupun mengubah koordinat GPS presensi.
- Penyiaran nyata tetap harus melalui **Tinjau Siaga → Konfirmasi Penyiaran**, dan dapat mengirim peringatan ke pengguna aktif. Jangan gunakan untuk uji coba tanpa pengaturan lingkungan aman.
- Hanya Admin aktif yang boleh menyimpan; transaksi Firestore menolak konfigurasi stale dari admin lain dan mencatat audit.
- Tidak ada migrasi database atau Firestore Rules baru yang diperlukan dengan konfigurasi aturan saat ini.

## File aplikasi yang berubah
- `src/types/commandCenterConfig.types.ts`
- `src/features/settings/CommandCenterSettingsCard.tsx`
- `src/features/settings/SettingsView.tsx`
- `src/features/settings/BellEmergencyAutomationCard.tsx`
- `src/features/command-center/CommandCenterPreview.tsx`
- `src/features/command-center/EmergencyBroadcastModal.tsx`
- `src/services/firebase/schoolSettingsService.ts`

## Verifikasi
- `node scripts/verify_command_center_custom_r39.cjs`: **33/33 lulus**.
- Verifikasi R21 dan R27: **26/26** masing-masing.
- Verifikasi impor lokal: **421 file tanpa impor relatif yang hilang**.
- Transpile seluruh file berubah: lolos.
- **Lint/build penuh belum berhasil** pada lingkungan kerja ini: `npm ci --offline` kekurangan paket `yargs-parser`, `npm run lint` gagal karena `firebase`/`@types/node` tidak tersedia, dan `npm run build` gagal karena `vite` tidak terpasang. Harus diuji pada repository dengan dependensi lengkap sebelum deployment final.

## Tes operasional setelah pemasangan
1. Tambahkan jenis **Banjir** (nonaktif dahulu), pastikan tidak tampil di Pusat Komando; aktifkan dan simpan, pastikan muncul di halaman Pusat Komando dan Bel & Darurat.
2. Edit lokasi posko, lalu cek di akun/perangkat lain dengan akses Pusat Komando.
3. Uji dua admin menyunting pengaturan berbeda dari state lama: perubahan yang kalah harus ditolak, bukan diam-diam menimpa.
4. Uji akun non-Admin tidak dapat membuka/menyimpan editor konfigurasi.
5. Pastikan fungsi bel manual dan lima kategori siaga standar masih ada.
