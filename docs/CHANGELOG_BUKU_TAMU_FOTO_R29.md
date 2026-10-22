# Piket Guru R29 — Tampilan Buku Tamu & Foto Registrasi

Tanggal: 22 Oktober 2026

## Perubahan

### Buku Tamu (input petugas)
- Komponen foto wajah tamu **sudah tersedia** sebelumnya; pada R29 dipindah dekat identitas, tidak lagi tersembunyi di paling bawah formulir.
- Tampilan lebih ringkas dengan kartu dokumentasi, pratinjau foto, tombol Ambil / Ambil Ulang / Hapus.
- Kamera mulai dari lensa depan bila didukung perangkat; tetap tersedia penggantian kamera atau pilihan file pada komponen kamera lama.
- Watermark resmi dan penyimpanan foto terautentikasi yang sudah dipakai aplikasi tetap digunakan.
- Jika rombongan, satu foto dalam formulir ini untuk **tamu utama saja**, bukan foto identitas semua anggota.
- Daftar tamu mobile menampilkan foto kecil (lazy loading) atau inisial, dengan tata letak informasi yang lebih fleksibel.

### Registrasi QR mandiri
- Tamu dapat memilih Ambil Foto Tamu dari HP/desktop sebelum mengirim registrasi.
- Foto opsional; memerlukan persetujuan dokumentasi jika dipilih.
- Kompresi dilakukan di browser, maksimal 440 piksel pada sisi terpanjang dan sekitar 85 KB JPEG; pratinjau muncul sebelum pengiriman.
- Server memvalidasi MIME, struktur JPEG, ukuran dan persetujuan; tidak menerima tautan foto publik arbitrer.
- Foto menunggu pemeriksaan dan terlihat di antrean verifikasi petugas; foto tidak otomatis memberi izin masuk.
- Setelah diverifikasi, foto disimpan pada catatan tamu utama. Salinan dari antrean QR dihapus setelah keputusan diterima/ditolak.
- Kuota QR, hak akses verifikasi, penomoran badge atomik dan penanganan rombongan dari R28 tidak diubah.

## File pada ZIP incremental
- `src/components/camera/CameraCaptureModal.tsx`
- `src/features/visitors/VisitorFormModal.tsx`
- `src/features/visitors/VisitorPreview.tsx`
- `src/features/visitors/PublicVisitorCheckin.tsx`
- `src/features/visitors/VisitorSelfCheckinPanel.tsx`
- `src/server/routes/visitorRegistrationRoutes.ts`
- `src/server/routes/visitorPhotoValidation.ts`
- `src/utils/visitorPhoto.ts`
- `scripts/verify_visitor_photo_r29.cjs`
- `docs/CHANGELOG_BUKU_TAMU_FOTO_R29.md`

## Pemeriksaan
- Verifikasi R29: `node scripts/verify_visitor_photo_r29.cjs`
- Verifikasi R28: `node scripts/verify_visitor_registration_r28.cjs`
- Build / lint: `npm ci && npm run lint && npm run build`

## Batas pengujian
Pemeriksaan R29 mencakup sintaks dan fungsi validasi server dengan data foto simulasi; **bukan** pengujian integrasi kamera/browser, unggah ke Firebase, atau verifikasi ke Vercel produksi. Full build tidak dapat diselesaikan dalam lingkungan ini karena Vite tidak tersedia dan TypeScript check penuh tidak selesai.

## Saran uji setelah deployment
1. Petugas registrasi satu tamu + foto; pastikan badge dan foto tersimpan.
2. Rombongan tiga orang; pastikan badge tetap urut dan foto hanya tercatat pada tamu utama.
3. QR mandiri: ambil foto, cek pratinjau, tandai izin, kirim, cocokkan foto di antrean petugas, lalu setujui.
4. Uji tanpa foto dan pilihan tolak; pastikan fitur tetap berfungsi.
5. Uji kamera ditolak izinnya; gunakan pilihan unggah berkas.

Foto adalah data pribadi. Pastikan sekolah mempunyai pemberitahuan privasi, masa retensi dan prosedur penghapusan yang sesuai sebelum digunakan pada kunjungan sebenarnya.
