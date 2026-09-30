```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                 Dokumen: 06 — DOKUMEN RBAC & SECURITY
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 06_Dokumen_RBAC_Security
* **Klasifikasi**: INTERNAL / ADMIN / TECHNICAL
* **Penanggung Jawab**: Tim Keamanan Sistem & Administrator IT

---

## 1. AUTHENTICATION (OTENTIKASI PENGGUNA)
* **Kredensial Utama**: NIP (Nomor Induk Pegawai) sebagai identifier login tunggal dan 6-digit PIN numerik.
* **Proses Verifikasi**: Verifikasi dilakukan di sisi klien menggunakan enkripsi kriptografis sebelum sesi dinyatakan sah.
* **Brute-Force Lockout Defense**: Sistem membatasi kegagalan input PIN hingga maksimal 5 kali. Jika batas terlampaui, akun otomatis dikunci selama 15 menit (`lockedUntil = now + 900000ms`), mencegah serangan kamus atau penebakan otomatis.

---

## 2. PENGELOLAAN PIN & ENKRIPSI KRIPTOGRAFIS
* **Algoritma**: **Salted SHA-256** melalui *Web Crypto API* bawaan peramban modern (`crypto.subtle.digest`).
* **Nilai Salt**: Setiap pengguna memiliki string salt acak 16-karakter heksadesimal yang dibuat menggunakan `crypto.getRandomValues(new Uint8Array(8))`.
* **Keamanan Kredensial**: PIN tidak pernah disimpan dalam bentuk teks polos (*plaintext*). Basis data Firestore hanya menyimpan atribut `pinHash` dan `pinSalt`.

---

## 3. SESSION LIFECYCLE (MANAJEMEN SESI)
* **Penyimpanan Sesi**: Informasi pengguna aktif disimpan pada `localStorage` terisolasi domain (`piket_guru_active_session`).
* **Masa Berlaku Maksimal**: Sesi berlaku maksimum selama **24 jam** sejak login (`loginAt`).
* **Session Timeout Guard**: Komponen `AuthContext` memvalidasi masa berlaku sesi pada setiap perpindahan halaman. Jika sesi melewati 24 jam, sistem otomatis menghapus token sesi dan mengalihkan peramban ke halaman login.

---

## 4. ROLE PENGGUNA
Sistem membedakan hak tanggung jawab ke dalam 4 peran kedinasan utama:
1. `ADMIN`: Administrator Pengelola Sistem & Infrastruktur.
2. `KEPALA_SEKOLAH`: Pimpinan Pengawas Eksekutif & Pengesah Dokumen.
3. `GURU`: Pendidik Pelaksana Tugas Piket Lapangan.
4. `TENAGA_KEPENDIDIKAN`: Pegawai Administrasi, Gerbang/Satpam, dan Resepsionis.

---

## 5. MATRIKS PERMISSION AKTUAL (BERDASARKAN SOURCE CODE)

Berikut adalah matriks otorisasi resmi yang diekstrak langsung dari `src/config/permissions.ts`:

| Modul / Permission Key | Admin | Kepala Sekolah | Guru | Tendik |
| :--- | :---: | :---: | :---: | :---: |
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ |
| `command_center.view` | ✓ | ✓ | ✓ | ✓ |
| `kiosk.view` | ✓ | ✓ | ✓ | ✓ |
| `users.view` | ✓ | ✓ | - | - |
| `users.create` / `update` / `delete` | ✓ | - | - | - |
| `schedule.view` | ✓ | ✓ | ✓ | ✓ |
| `schedule.create` / `update` / `delete` | ✓ | - | - | - |
| `attendance.view` | ✓ | ✓ | ✓ | ✓ |
| `attendance.view_all` | ✓ | ✓ | - | - |
| `attendance.create` | ✓ | - | ✓ | ✓ |
| `dutybook.view` | ✓ | ✓ | ✓ | ✓ |
| `dutybook.view_all` | ✓ | ✓ | - | - |
| `dutybook.create` / `update` | ✓ | - | ✓ | ✓ |
| `dutybook.verify` (Pengesahan) | ✓ | ✓ | - | - |
| `dutybook.unlock` (Buka Gembok) | ✓ | - | - | - |
| `incident.view` | ✓ | ✓ | ✓ | ✓ |
| `incident.create` | ✓ | - | ✓ | ✓ |
| `incident.update` | ✓ | - | ✓ | - |
| `student_tardy.view` / `create` / `admit` | ✓ | ✓ (View) | ✓ | ✓ |
| `visitors.view` / `create` / `checkout` | ✓ | ✓ (View) | ✓ | ✓ |
| `student_permits.view` / `create` / `return` | ✓ | ✓ (View) | ✓ | ✓ |
| `substitutions.view` / `create` | ✓ | ✓ (View) | ✓ | ✓ |
| `documentation.view` / `upload` | ✓ | ✓ (View) | ✓ | ✓ |
| `reports.view` / `reports.export` | ✓ | ✓ | - | - |
| `settings.view` | ✓ | ✓ | - | - |
| `settings.update` | ✓ | - | - | - |
| `backup.view` / `create` / `restore` | ✓ | - | - | - |
| `audit.view` (Audit Forensik) | ✓ | ✓ | - | - |

*(Catatan: Administrator memiliki izin global wildcard `['*']`)*

---

## 6. ROUTE PROTECTION (PROTEKSI RUTE)
* Penegakan otorisasi diimplementasikan pada tingkat komponen React:
  - Menu samping (*Sidebar*) memfilter opsi berdasarkan fungsi `checkUserPermission()`.
  - Upaya mengakses rute ilegal secara langsung melalui penulisan hash URL (contoh: `/#settings` oleh akun Guru) diintersepsi oleh rute guard dan otomatis diarahkan kembali ke `Dashboard`.

---

## 7. FIREBASE SECURITY RULES
Aturan `firestore.rules` dideploy aktif pada Google Cloud Firestore:
* **Prinsip Read/Write**: Seluruh entitas operasional harian dilindungi validasi sanitasi dokumen di sisi aplikasi.
* **Audit Log Immutability**: Koleksi `auditLogs` dikunci secara absolut di kernel Firestore:
  ```javascript
  match /auditLogs/{logId} {
    allow read: if true;
    allow create: if true;
    allow update, delete: if false; // KEBAL EDIT & KEBAL HAPUS
  }
  ```

---

## 8. DATA OWNERSHIP GUARD (KEPEMILIKAN DOKUMEN)
* Pada modul Buku Piket, guru hanya diizinkan mengedit draft jurnal yang ditugaskan kepada dirinya (`petugasId === currentUser.id`).
* Guru tidak diizinkan menyunting draft milik rekan kerja lainnya untuk menjaga akuntabilitas tugas individu.

---

## 9. FILE ACCESS & STORAGE GUARD
* Pengambilan swafoto dan bukti insiden diproses melalui kanvas off-screen dengan batas resolusi 800px dan ukuran < 100KB.
* Media disimpan dalam bentuk Base64 Data URI di Firestore, menghilangkan kebutuhan bucket penyimpanan publik yang rentan terekspos.

---

## 10. AUDIT LOG FORENSIK
* Setiap transaksi sistem (`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`, `BACKUP`, `RESTORE`, `STATUS_CHANGE`, `SECURITY`) secara otomatis menginjeksi dokumen audit yang mencakup: ID pengguna, Nama, Peran, Modul, Deskripsi Aksi, dan Stempel Waktu ISO 8601.

---

## 11. SECURITY BEST PRACTICES UNTUK SEKOLAH
1. Administrator wajib mengubah PIN standar awal segera setelah serah terima sistem.
2. Hindari membagikan PIN kepada rekan kerja atau siswa.
3. Selalu lakukan logout saat meninggalkan perangkat di ruang guru atau pos piket.
4. Lakukan pencadangan database rutin setiap minggu dan simpan di Google Drive resmi sekolah.
