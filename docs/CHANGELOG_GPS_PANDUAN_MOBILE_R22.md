# Piket Guru R22 — GPS dan Panduan Mobile

Tanggal: 22 Oktober 2026
Jenis: patch incremental, hanya file berubah

## Perubahan

### 1. Status lokasi GPS otomatis dan responsif
- Pembacaan yang masih segar dengan akurasi **maksimal 50 m** segera diproses. Tidak ada lagi penantian tambahan satu detik hanya untuk mengejar akurasi 20 m.
- Bila koordinat berada di radius sekolah dan akurasinya memenuhi kebijakan, indikator **Dalam Radius Sekolah** langsung tampil meskipun proses lokasi baru berlangsung.
- Bila pembacaan tidak akurat (>50 m), sistem tetap menunggu koordinat yang layak dan tidak menganggapnya lolos.
- Proses GPS memperoleh waktu pencarian yang lebih realistis pada perangkat lambat (tanpa memperlihatkan hitung mundur teknis di UI). Kesalahan ditampilkan dengan kalimat singkat tanpa teks '2,5 detik'.
- Tombol **Perbarui GPS** meminta pembacaan baru, bukan sekadar mengulang hasil cache lama. Hasil lama tidak dinyatakan valid apabila pembaruan gagal.
- Logika GPS/geofence, presensi swafoto, dan izin akun tetap menjadi syarat penyimpanan. *Indikator Dalam Radius bukan presensi otomatis.*

### 2. Panduan penggunaan mobile lebih ringan
- Daftar langkah dibuat stabil saat render berulang: efek pengukuran tidak dipicu terus-menerus oleh referensi fungsi navigasi atau izin yang berubah.
- Pengamatan perubahan seluruh DOM (`MutationObserver` di root) dihapus. Pencarian elemen langkah sekarang dibatasi maksimal sekitar enam detik ketika halaman baru dimuat.
- Pada HP, kartu panduan tetap berada di posisi bawah dan tidak digeser oleh auto-scroll halus setiap langkah.
- Tombol di bagian bawah panduan tetap mudah dijangkau saat isi penjelasan panjang, termasuk di layar kecil.
- Pengukuran posisi tetap dilakukan bila layar digulir/diubah ukuran, dengan requestAnimationFrame sebagai pembatas frekuensi.

## File yang perlu ditimpa
- `src/services/location/locationService.ts`
- `src/features/attendance/AttendancePreview.tsx`
- `src/components/guide/InteractiveGuideTour.tsx`
- `src/index.css`

## Berkas verifikasi
- `scripts/verify_gps_guide_r22.cjs`

Jalankan dari root repository setelah dependensi tersedia:

```bash
node scripts/verify_gps_guide_r22.cjs
npm run lint
npm run build
```

## Verifikasi yang telah dijalankan pada source kerja
- 23 pemeriksaan khusus R22 lulus (termasuk mock geolocation: hasil akurat, tidak akurat, di luar radius, cache, refresh paksa, batal dan error).
- Skrip regresi R9, R10, R19, dan pemeriksaan nama impor/ekspor lokal R16.2 lulus.
- `npm run lint` dicoba tetapi gagal karena paket TypeScript eksternal seperti Firebase dan `@types/node` tidak terinstal lengkap pada lingkungan ini.
- `npm run build` dicoba tetapi gagal karena `vite` tidak tersedia. **Build produksi belum diverifikasi.**

## Uji manual setelah Vercel Ready
1. HP di lingkungan sekolah: tunggu hasil GPS hingga akurasi ≤50 m. Pastikan label Dalam Radius muncul jika jarak memenuhi kebijakan.
2. HP di luar radius: harus tampil Di Luar Radius; akurasi >50 m harus tetap Akurasi GPS Rendah.
3. Tekan Perbarui GPS setelah pindah lokasi: pastikan pembacaan baru, bukan cache lama.
4. Matikan izin GPS dan ulangi: periksa pesan error dan pastikan presensi tetap dibatasi.
5. Masuk Panduan Penggunaan dan tekan Lanjut/Kembali/Tutup satu kali pada mobile; ulangi saat berpindah langkah yang menavigasi menu berbeda.
