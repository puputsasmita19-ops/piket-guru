# Piket Guru — Penanganan Guru Berhalangan Mendadak (R14)

Tanggal: 21 Oktober 2026

## Proses operasional

1. Guru yang mendadak tidak dapat melaksanakan piket memberi informasi kepada administrator sekolah.
2. ADMIN masuk ke **Monitoring Piket Realtime → Aktivitas Piket Hari Ini → Berhalangan**, atau dari **Jadwal Piket → Berhalangan** pada petugas terkait (hari ini).
3. Isi **Keterangan Berhalangan Hadir** (minimal 10 karakter).
4. Pilih **Guru Pengganti** aktif atau pilih **Menunggu Pengganti** bila belum ditentukan.
5. Simpan. Perubahan terlihat secara realtime dalam **Guru Berhalangan & Pengganti Hari Ini**, daftar petugas yang bertugas, presensi, Dashboard, TV Lobi, dan Pusat Komando.
6. Pengganti menggunakan akun miliknya sendiri untuk presensi GPS + selfie seperti biasa. Tidak ada presensi atas nama orang lain.
7. Jika belum ada presensi dan admin ingin mengembalikan penugasan, buka **Kelola Pengganti → Pulihkan Jadwal**.

Contoh: Guru A tugas rutin tiap Rabu, tetapi pada Rabu 21 Oktober 2026 izin keluarga. Admin menunjuk Guru B sebagai pengganti pada tanggal tersebut. Penugasan rutin Guru A tetap berlaku pada Rabu 28 Oktober 2026.

## Prinsip implementasi

- **Tidak mengubah atau menimpa master jadwal mingguan.** Informasi absensi/pengganti dibuat dalam dokumen `schedules` terpisah yang bertipe `ONCE`, untuk tanggal itu saja.
- Override mempunyai ID deterministik `duty-cover~YYYY-MM-DD~{encoded sourceScheduleId}` untuk mencegah duplikasi oleh percobaan ulang.
- Status `DIBATALKAN` pada dokumen override berarti **menunggu pengganti**, bukan membatalkan jadwal rutin sumber.
- Guru asli disembunyikan dari daftar penugasan efektif pada tanggal override; pengganti (jika dipilih) menggantikan slotnya.
- Presensi dalam mode TERJADWAL melakukan verifikasi dokumen penugasan dan override **di dalam transaksi Firestore**. Guru asli tidak dapat presensi memakai slot yang sudah dialihkan, dan pengganti tetap wajib GPS + swafoto.
- Pemilihan calon pengganti menolak akun nonaktif, diri sendiri, dan jadwal yang bentrok menurut snapshot realtime.
- Penyimpanan dan log audit admin dilakukan dalam **satu transaksi**. Perubahan yang telah diperbarui oleh admin lain ditolak. Penggantian tidak dapat dibatalkan atau dipindah ke guru lain setelah pengganti presensi.
- Penggantian dapat ditandai sementara tanpa pengganti; tidak dihitung sebagai petugas aktif.
- Guru yang sudah melakukan presensi masuk tidak bisa dilaporkan sebagai berhalangan melalui alur ini. Admin perlu menangani kasus pulang/serah tugas lebih awal dengan prosedur terpisah.
- Jika satu guru mempunyai beberapa slot piket terpisah dalam satu hari, admin perlu memproses tiap slot yang ditinggalkan.

## Keamanan dan Firestore

- Hak tulis `schedules` tetap hanya `ADMIN` berdasarkan aturan Firestore proyek terakhir. Tidak membuat collection baru atau memerlukan rule Firebase baru.
- Log audit ditulis ke `auditLogs` dan hanya dapat dilihat sesuai hak akses yang telah berlaku.
- Tidak mengubah aturan umum, identitas pengguna, data kehadiran yang sudah tercatat, atau tanggal lain.
- Jangan menekan opsi **Edit Jadwal** biasa pada jadwal rutin untuk menandai izin hari ini; gunakan menu **Berhalangan** agar minggu berikutnya tidak terdampak.
- Untuk konsistensi saat banyak admin, penggantian pada slot yang sama memakai dokumen deterministik dan pemeriksaan versi dalam transaksi. Benturan silang antar slot yang diubah *secara simultan* oleh dua admin masih sebaiknya divalidasi melalui review dashboard setelah penyimpanan.
- Fitur ini belum mengirim notifikasi otomatis ke guru pengganti. Admin perlu menginformasikan penugasan kepada guru terkait.

## File incremental

- `src/types/index.ts`
- `src/utils/scheduleUtils.ts`
- `src/utils/dutyRoster.ts`
- `src/services/firebase/dutyCoverageService.ts` (baru)
- `src/services/firebase/attendanceService.ts`
- `src/features/attendance/DutyCoverageDialog.tsx` (baru)
- `src/features/attendance/AdminAttendanceDashboard.tsx`
- `src/features/attendance/AttendancePreview.tsx`
- `src/features/schedules/SchedulePreview.tsx`
- `src/features/dashboard/DashboardView.tsx`
- `src/features/kiosk/PublicKioskDisplay.tsx`
- `src/features/kiosk/KioskPreview.tsx`
- `src/features/command-center/CommandCenterPreview.tsx`
- `src/features/command-center/CampusMapViewer.tsx`
- `scripts/verify_duty_coverage_round14.cjs` (baru)
- `docs/CHANGELOG_GURU_PIKET_BERHALANGAN_R14.md` (baru)

## Pengujian

```bash
node scripts/verify_duty_coverage_round14.cjs
npm ci
npm run lint
npm run build
```

### Status

- Simulasi logika override, admin authorization, transaksi, konflik, presensi, pembatalan, dan parsing file source: **20 pemeriksaan lulus**.
- Pengujian regresi R8, R9, R10, R11, R13 lulus. Skrip verifikasi R12 yang khusus mengharuskan ikon PNG tidak lagi relevan karena digantikan SVG oleh patch R13.
- `npm ci --offline` tidak dapat berjalan karena `yargs-parser` tidak tersedia dalam cache; karena itu lint/build penuh **belum terverifikasi**, dan uji Firebase/Vercel secara live perlu dilakukan sebelum dipakai resmi.

### Skenario uji di Vercel (gunakan akun uji)

1. Jadwalkan Guru A untuk hari ini. Sebelum presensi, tandai berhalangan dan simpan tanpa pengganti; pastikan admin melihat **Menunggu Pengganti**, dan Guru A tidak melihat penugasan aktif.
2. Ubah menjadi Guru B (aktif dan tidak bentrok); pastikan Guru B melihat jadwal piket dan bisa presensi dengan GPS + swafoto sesuai kebijakan.
3. Cek Dashboard, TV Lobi dan Pusat Komando: nama petugas hari ini adalah Guru B.
4. Cek hari yang sama minggu berikutnya: jadwal rutin tetap Guru A.
5. Uji tombol **Pulihkan Jadwal** sebelum Guru B presensi dan pastikan setelah Guru B presensi tombol tersebut ditolak.
6. Coba dari akun nonadmin: tidak ada tombol dan Firestore harus menolak percobaan tulis ke `schedules`.
