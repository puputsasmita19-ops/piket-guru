# ARSITEKTUR KEAMANAN: STRUKTUR RBAC (ROLE-BASED ACCESS CONTROL)
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Aplikasi menerapkan sistem kontrol akses berbasis peran (*Role-Based Access Control / RBAC*) yang berlapis, memisahkan hak otentikasi, otorisasi antarmuka, hingga pembatasan izin baca-tulis basis data.

---

### 1. MEKANISME OTENTIKASI (AUTHENTICATION)
* **Kredensial Utama**: NIP (Nomor Induk Pegawai) sebagai pengenal unik dan 6-digit PIN keamanan.
* **Enkripsi Kriptografis**: PIN tidak disimpan dalam bentuk teks polos. Sistem memanfaatkan *Web Crypto API* dengan algoritma **Salted SHA-256**:
  $$\text{Hash} = \text{SHA-256}(\text{PIN} + \text{Salt})$$
  Setiap pengguna memiliki nilai salt acak 16 karakter unik yang di-generate saat pembuatan akun atau reset PIN.
* **Brute-Force Lockout Defense**: Sistem mencatat kegagalan verifikasi PIN. Jika pengguna salah memasukkan PIN sebanyak 5 kali berturut-turut, akun akan otomatis terkunci selama 15 menit (`lockedUntil = now + 900000ms`).
* **Session Lifecycle**: Sesi login disimpan pada `localStorage` dengan waktu kedaluwarsa maksimal 24 jam. Jika melewati 24 jam, sesi secara otomatis dibersihkan dan dialihkan ke gerbang login.

---

### 2. MATRIKS PERMISSION AKTUAL (BERDASARKAN SOURCE CODE)

Berikut adalah matriks otorisasi resmi yang diekstrak langsung dari berkas konfigurasi `src/config/permissions.ts`:

| Kode Izin (*Permission Key*) | ADMIN | KEPALA_SEKOLAH | GURU | TENAGA_KEPENDIDIKAN | SATPAM |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `command_center.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `kiosk.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Manajemen Pengguna** | | | | | |
| `users.view` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `users.create` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `users.update` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `users.delete` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Jadwal Piket** | | | | | |
| `schedule.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `schedule.create` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `schedule.update` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `schedule.delete` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Presensi Piket** | | | | | |
| `attendance.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `attendance.view_all` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `attendance.create` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `attendance.update` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Buku Piket (Jurnal)** | | | | | |
| `dutybook.view` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `dutybook.view_all` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `dutybook.create` | ✓ | ✗ | ✓ | ✓ | ✗ |
| `dutybook.update` | ✓ | ✗ | ✓ | ✓ | ✗ |
| `dutybook.verify` (Pengesahan) | ✓ | ✓ | ✗ | ✗ | ✗ |
| `dutybook.unlock` (Buka Gembok) | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Kejadian & Insiden** | | | | | |
| `incident.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `incident.create` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `incident.update` | ✓ | ✗ | ✓ | ✗ | ✗ |
| `incident.delete` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Siswa Terlambat** | | | | | |
| `student_tardy.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `student_tardy.create` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `student_tardy.admit` | ✓ | ✗ | ✓ | ✓ | ✓ |
| **Buku Tamu Digital** | | | | | |
| `visitors.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `visitors.create` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `visitors.checkout` | ✓ | ✗ | ✓ | ✓ | ✓ |
| **Izin Siswa Keluar** | | | | | |
| `student_permits.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `student_permits.create` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `student_permits.return` | ✓ | ✗ | ✓ | ✓ | ✓ |
| **Guru Pengganti (Inval)** | | | | | |
| `substitutions.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `substitutions.create` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `substitutions.update` | ✓ | ✗ | ✓ | ✗ | ✗ |
| **Dokumentasi Media** | | | | | |
| `documentation.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `documentation.upload` | ✓ | ✗ | ✓ | ✓ | ✓ |
| `documentation.delete` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Laporan & Ekspor** | | | | | |
| `reports.view` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `reports.export` | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Pengaturan & Backup** | | | | | |
| `settings.view` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `settings.update` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `backup.view` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `backup.create` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `backup.restore` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `audit.view` (Audit Forensik) | ✓ | ✓ | ✗ | ✗ | ✗ |

*Keterangan: Administrator (`ADMIN`) memiliki wildcard permission `['*']` yang mencakup seluruh izin di atas.*

---

### 3. PROTEKSI RUTE & NAVIGASI (ROUTE PROTECTION)
* Komponen navigasi (`Sidebar.tsx`, `Header.tsx`, dan `App.tsx`) memanfaatkan hook `useAuth()` dan fungsi pembantu `checkUserPermission(currentUser.permissions, requiredPermission)`:
  - Tautan menu yang tidak diizinkan disembunyikan sepenuhnya dari tampilan bilah sisi.
  - Jika pengguna mencoba memanipulasi rute URL hash secara langsung (misal: mengakses `/#settings` menggunakan akun Guru), sistem secara otomatis mengintersepsi akses dan mengarahkan tampilan kembali ke halaman `Dashboard`.

---

### 4. PENEGAKAN INTEGRITAS TINGKAT DOKUMEN (DOCUMENT OWNERSHIP GUARD)
Selain pembatasan berbasis peran global, aplikasi menerapkan *Fine-Grained Ownership Guard* pada modul sensitif:
* **Buku Piket**:
  - Guru Piket hanya dapat mengedit dan menekan tombol *Ajukan Jurnal* pada dokumen yang mana `petugasId === currentUser.id`.
  - Guru dilarang menyunting draft milik rekan kerja lainnya untuk mencegah pertukaran tanggung jawab tanpa otorisasi.
* **Jurnal Terkunci (Locked Archive)**:
  - Setelah jurnal disetujui Kepala Sekolah, dokumen berstatus `DIKUNCI`. Seluruh komponen antarmuka otomatis beralih menjadi mode hanya-baca (*read-only*), di mana tombol hapus dan edit dinonaktifkan.
