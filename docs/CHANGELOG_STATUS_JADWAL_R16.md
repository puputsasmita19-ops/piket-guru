# R16 — Penguatan status otomatis jadwal piket

Dasar R15 sudah mendukung status operasional yang dihitung secara realtime dari presensi (TERJADWAL → BERJALAN setelah masuk → SELESAI setelah pulang) dan pengecualian satu hari untuk guru berhalangan/pembatalan. R16 **tidak** menambahkan koleksi atau mengganti aturan Firestore.

## Perubahan
- Form Edit Jadwal selalu menghasilkan status dasar TERJADWAL, bukan mengubah status presensi operasional.
- Jalur penyimpanan Jadwal Piket menolak perubahan status secara tidak sah dan menolak edit langsung pada jadwal yang dibatalkan. Pemulihan harus memakai tombol **Aktifkan Kembali**.
- Penjelasan pada tanggal pemantauan mempertegas otomatisasi masuk/pulang serta tindakan **Berhalangan** dan **Batalkan**.
- Status penggantian tetap berasal dari penugasan khusus satu hari; status pembatalan satu hari tidak mengubah jadwal rutin.

## Berkas
- `src/features/schedules/SchedulePreview.tsx`
- `src/features/schedules/ScheduleFormModal.tsx`
- `scripts/verify_schedule_status_r16.cjs`
- `docs/CHANGELOG_STATUS_JADWAL_R16.md`

## Uji
```
node scripts/verify_schedule_status_r16.cjs
node scripts/verify_duty_coverage_round14.cjs
node scripts/verify_duty_replacement_search_r15.cjs
npm run lint
npm run build
```

Pengujian terarah berbasis source berhasil, tetapi lint/build penuh membutuhkan dependensi NPM yang lengkap. Setelah deploy, uji presensi masuk/pulang dan penggantian/batal satu tanggal memakai akun percobaan.
