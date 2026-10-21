# Patch Jadwal Piket UI R17

Tanggal: 2026-10-21

## Ringkasan
Patch ini memperjelas arti tombol **Batalkan**, merapikan tata letak aksi jadwal agar tidak saling menabrak di mobile, dan mengganti tampilan inisial huruf menjadi **foto profil guru/staff** bila tersedia.

## Penjelasan fungsi Batalkan
Tombol **Batalkan** berarti:
- menonaktifkan jadwal piket pada **tanggal yang sedang dipantau**, atau
- melalui dialog, admin dapat memilih membatalkan **seluruh jadwal berulang**.

Jadwal yang dibatalkan tidak langsung dihapus dari sistem, dan masih dapat dipulihkan melalui tombol **Aktifkan Kembali**.

## Perubahan utama
1. **Makna Batalkan diperjelas**
   - Teks bantuan di panel jadwal diperjelas.
   - Tombol Batalkan diberi penjelasan lewat `title` dan helper text di kartu.

2. **Tata letak tombol lebih ergonomis**
   - Bagian aksi pada kartu jadwal dipecah menjadi dua area:
     - aksi utama (Berhalangan / Batalkan / Aktifkan Kembali)
     - aksi utilitas (WhatsApp / Edit / Hapus)
   - Layout dibuat membungkus (`wrap`) dan bertingkat di mobile agar tidak menabrak.

3. **Foto guru lebih informatif & efisien**
   - Lingkaran/box inisial pada kartu jadwal diganti menjadi komponen `UserAvatar`.
   - Jika foto profil tersedia, foto akan tampil.
   - Jika tidak ada foto, sistem tetap memakai fallback inisial.
   - Implementasi memanfaatkan cache foto profil yang sudah ada sehingga tetap hemat data.

4. **Tabel jadwal juga ikut dirapikan**
   - Kolom nama petugas pada tampilan tabel kini menampilkan avatar/foto.

## File yang berubah
- `src/features/schedules/SchedulePreview.tsx`
- `scripts/verify_schedule_ui_r17.cjs`
- `docs/CHANGELOG_JADWAL_UI_R17.md`

## Verifikasi lokal
Jalankan:

```bash
node scripts/verify_schedule_ui_r17.cjs
```

## Catatan
- Patch ini tidak mengubah struktur database dan tidak mengubah mekanisme pembatalan/berhalangan yang sudah ada.
- Foto yang dipakai adalah foto profil user yang sudah tersedia di sistem; bila tidak tersedia, fallback inisial tetap digunakan.
