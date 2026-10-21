# R20 — Ikon Bantuan Jadwal Piket

## Perubahan
- Mengganti teks panjang **Apa fungsi tombol?** dengan ikon `HelpCircle` yang kecil dan ergonomis.
- Ikon ditampilkan di sebelah kanan baris **Status otomatis**, sehingga tidak menambah baris terpisah.
- Saat ikon diketuk, panel penjelasan Berhalangan, Batalkan, Pesan, Edit, dan Hapus tetap tersedia.
- Tetap dapat digunakan dengan keyboard dan pembaca layar; ukuran area sentuh 40 × 40 px.
- Memakai elemen `details` bawaan browser tanpa state tambahan, sehingga tidak memicu render ulang daftar jadwal.
- Perubahan hanya pada UI menu Jadwal Piket. Tidak ada perubahan Firebase, hak akses, atau fungsi jadwal.

## Verifikasi
Setelah mengekstrak patch di root repository:

```bash
npm ci
node scripts/verify_schedule_help_icon_r20.cjs
npm run lint
npm run build
```
