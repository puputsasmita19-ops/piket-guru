# Piket Guru R70 — Border Tab Aktif & Nonaktif

Basis: source R69 yang tersedia setelah audit R68. Hanya dua komponen tab di menu Manajemen Pengguna yang diubah.

## Perubahan

1. **Akun & Pengguna / Master Data & Audit** — masing-masing tombol kini mempunyai border 1px baik saat aktif maupun nonaktif. Tab aktif diberi border dengan warna tema; tab nonaktif memakai border abu-abu yang tetap terlihat dalam mode terang/gelap.
2. **Golongan Guru & Tenaga Pendidik / Golongan Siswa** — pola border aktif/nonaktif yang sama, dengan aksen hijau untuk tab Siswa.
3. Menambahkan `aria-pressed`, `type="button"`, dan focus ring untuk aksesibilitas.
4. Menggunakan lebar border yang sama pada kedua status untuk mencegah tombol bergeser ketika dipilih.

## Yang tidak diubah

Handler pergantian tab, jumlah Guru/Siswa, fungsi Master Data, Firestore, role/hak akses, pencarian, dan paginasi.

## Instalasi

- Salin isi ZIP incremental ke folder root repository yang telah memakai R69; hanya file pada `src/features/users` yang ditimpa.
- Jalankan `node scripts/verify_tab_borders_r70.cjs` lalu `npm ci`, `npm run lint`, dan `npm run build` pada komputer yang dependensinya lengkap.
- Di GitHub Desktop pastikan `UsersPreview.tsx` dan `UserManagementView.tsx` berubah, kemudian Commit dan Push ke GitHub setelah lint/build lulus. Tunggu Vercel Ready.
- Uji empat tab di desktop serta HP dalam mode terang/gelap. Periksa border tab nonaktif tetap tampak, dan tab aktif tidak bergeser saat ditekan.

Pemeriksaan statis tidak setara dengan build/QA perangkat nyata. Tidak ada migrasi atau perubahan Firebase.
