# Pemasangan kit verifikasi R60 SETELAH R61

**Urutan yang benar: R59 → R60 fitur monitoring/diagnostik → R61 perbaikan Buku Siswa Terlambat → KIT VERIFIKASI INI.**

Ini **bukan** rollback ke R60. Kit tidak memiliki file `src/` dan tidak mengubah data aplikasi. File hanya berada di `scripts/`, `docs/`, serta `.github/workflows/`.

1. Dari GitHub Desktop, buat commit/checkpoint source R61 yang sekarang berjalan.
2. Ekstrak ZIP ini ke ROOT repository dan pertahankan jalur foldernya.
3. Buka **Repository → Open in Terminal**, lalu jalankan:

   ```powershell
   node scripts/r60_release_gate.cjs --preflight
   node scripts/test_r60_release_gate.cjs
   node scripts/r60_release_gate.cjs --run --install
   ```

4. Periksa hasil. Jika tes gagal, hentikan proses; jangan menghapus atau menurunkan versi source.
5. Setelah tes lokal lulus, lakukan tes Firebase Emulator dan Preview Vercel menurut `docs/R60_STAGING_CHECKLIST.md` sebelum menyatakan GO.
6. Jika kit terpasang sukses dan tidak merusak UI R61, lakukan commit `Add R60 verification kit after R61`, push ke GitHub, lalu pantau workflow Actions. Workflow tidak melakukan deploy.

### Catatan khusus

- Jangan jalankan kembali `scripts/apply_r60_diagnostics.cjs` jika R60 sudah diterapkan sebelumnya.
- Jangan jalankan kembali patcher `apply_r61_mobile_tardy.cjs` jika R61 sudah terpasang.
- Semua tes beban dalam kit menggunakan mock server loopback, bukan Firebase/Vercel.
- Jika `npm ci` gagal karena koneksi internet/dependensi, laporkan hasilnya sebagai **BELUM TERUJI**, bukan build PASS/FAIL aplikasi.
- Jika script R61 tidak ditemukan, ekstrak kembali **hanya berkas skrip uji R61** dari patch R61 yang sebelumnya dipakai; jangan memasang ulang transformasi tampilan R61.
