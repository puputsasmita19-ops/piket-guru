# CHANGELOG — PIKET GURU

## [1.1.1] - 2026-10-03

### CHANGE REQUEST: CR-AUTH-REMEDIATION-R21 (R21-01 s.d. R21-06) — Implementasi Koreksi Keamanan Login & Eliminasi Bypass

- **Tanggal:** 3 Oktober 2026
- **Tujuan:** Menuntaskan enam koreksi keamanan login R21-01 s.d. R21-06 pada source aktual, mengeliminasi bypass PIN literal dan fallback users, menegakkan validitas sesi Firebase murni, menghapus exception email permanen di Rules & klien, serta memperluas suite pengujian dengan uji regresi nyata.
- **Rincian Implementasi Koreksi (R21-01 s.d. R21-06):**
  1. **R21-01 (Eliminasi Bypass PIN & Identitas Fallback):**
     - Menghapus pengecekan bypass PIN literal (`pin.trim() === '123456'`) pada catch verifikasi kredensial di `src/server/routes/authRoutes.ts`.
     - Menghapus pemilihan dan dependensi terhadap `FALLBACK_USERS_LIST` pada login ketika query pengguna kosong atau mengalami error database.
     - Kegagalan pencarian (lookup) maupun verifikasi kredensial menghasilkan penolakan terkontrol (`DB_ERROR`, `CREDENTIAL_VERIFY_ERROR`, atau HTTP 401) tanpa token dan tanpa profil login sukses.
     - Akun wajib terdaftar di Firestore, aktif (`isActive: true`), melewati gerbang aktivasi (`requiresActivation != true`), dan memiliki hash scrypt yang valid.
  2. **R21-02 (Penegakan Sesi Firebase Valid):**
     - Kegagalan signer Firebase Admin SDK (`adminAuth.createCustomToken`) menghasilkan kegagalan terkontrol (HTTP 503 `SIGNER_UNAVAILABLE`), tidak ditutupi dengan `success: true` atau `customToken: null`.
     - Di `src/services/auth/authService.ts`, ketiadaan customToken atau kegagalan `signInWithCustomToken` langsung ditolak sebelum sesi/profil dicache.
     - Di `src/contexts/AuthContext.tsx`, state `currentUser` dimulai dari `null`. Ketika `fbUser` null, status autentikasi dibersihkan dan tidak memulihkan role atau autentikasi dari `localStorage`. Cache lokal hanya diperbolehkan sebagai layer tampilan setelah sesi Firebase dan profil tepercaya tervalidasi.
  3. **R21-03 (Penghapusan Exception Email Permanen):**
     - Menghapus fungsi `isSuperAdmin()` berbasis email di `firestore.rules` yang sebelumnya meloloskan akses `isValidActiveUser()` atau `isAdmin()`.
     - Di `AuthContext.tsx`, menghapus logika email yang memaksakan role `ADMIN` sebelum verifikasi lifecycle akun.
     - Seluruh akun tanpa pengecualian wajib melewati pemeriksaan: dokumen exists, `isActive == true`, bukan pending activation, role sah, dan `auth_time > sessionRevokedAtSeconds`.
  4. **R21-04 (Google Sign-In Tanpa Pemberian Role di Klien):**
     - Mempertahankan integrasi Google Sign-In, namun menghapus pemeriksaan `email.includes('admin')` dan pemberian role/izin di sisi klien.
     - Klien tidak membuat, mengaktifkan, atau menimpa profil pengguna ke Firestore saat proses login.
     - Setelah UID Google diperoleh, sistem memvalidasi dokumen profil sekolah yang telah diprovisioning secara tepercaya di Firestore. Akun tidak terdaftar, nonaktif, pending aktivasi, atau sesi dicabut ditolak dengan pemutusan sesi Firebase (`signOut`).
  5. **R21-05 (Status Direktori Pengguna yang Jujur):**
     - Endpoint `/api/auth/users-summary` membedakan status `OPERATIONAL`, `EMPTY` (koleksi kosong atau tidak ada pengguna aktif), dan `DEGRADED`/`PERMISSION_DENIED`.
     - Tidak menginjeksi akun fallback aktif saat database tidak tersedia, error, atau kosong.
  6. **R21-06 (Uji Regresi Nyata & Kontrol Positif):**
     - Memperluas `scripts/isolated_acceptance_test.ts` dengan 7 kasus uji nyata untuk memverifikasi penolakan bypass verifier error 7 + PIN 123456 (mintSpy=0), penolakan fallback identity pada lookup gagal, controlled failure pada signer error, penolakan token kosong pada AuthService, penolakan pemulihan role offline pada AuthContext, penolakan elevasi role pada Google Sign-In, dan status jujur `/users-summary`. Total 36 uji PASS (29 uji legacy + 7 uji baru R21).
     - Memperluas `scripts/test_rules_emulator.ts` dengan 6 kasus uji nyata pada emulator Firestore demo-piket-guru: penolakan token email untuk profil ghost/hilang, profil nonaktif, profil pending aktivasi, akun terdemosi, dan token dengan `auth_time <= sessionRevokedAtSeconds`, serta kontrol positif untuk admin terprovisioning aktif. Total 22 uji Rules PASS (16 uji legacy + 6 uji baru R21).

## [1.1.0] - 2026-10-02

### CHANGE REQUEST: CR-AUTH-BACKUP-001 — Koreksi Keamanan Kredensial, Kontrak Snapshot, Sanitasi Restore, Lifecycle Sesi & Rate Limiting Terdistribusi

- **Tanggal:** 2 Oktober 2026
- **Tujuan:** Menuntaskan seluruh temuan audit keamanan independen V3-01 s.d. V3-11 tanpa bypass, mengamankan private credential store murni melalui Firebase Admin SDK dengan OWASP adaptive scrypt, standarisasi kontrak snapshot UTF-8 byte chunking dan canonical SHA-256, sanitasi menyeluruh allowlist/denylist restore, atomic distributed rate limiting, penyelarasan lifecycle sesi/aktivasi/revokasi, dan perbaikan suite acceptance terisolasi.
- **Perbaikan Utama (V3-01 s.d. V3-11):**
  1. **V3-01 & V3-07 (Kontrak Snapshot Kecil & Besar):**
     - Path penyimpanan chunk dan security rules diselaraskan (`database_snapshots_chunks` & subkoleksi `database_snapshots/{id}/chunks`).
     - Metadata `totalChunks` dihitung secara eksak dan disimpan saat status `BUILDING`.
     - Payload dipecah berdasarkan batas byte UTF-8 nyata (`splitUtf8StringByByteLimit`), bukan berbasis panjang karakter.
     - Status snapshot ditulis `BUILDING`, diverifikasi baca ulang digest SHA-256, lalu difinalisasi `READY`. Penanganan `FAILED` membersihkan orphan chunks secara deterministik.
     - Validasi batas ketat (non-integer, out-of-range, orphan chunks) tanpa rekursi tak terbatas.
     - Serialisasi deterministik `canonicalJsonStringify` menjamin stabilitas digest SHA-256 lintas map key order.
  2. **V3-02 & V3-03 (Sanitasi dan Security State Restore):**
     - Semua field kredensial (`scryptHash`, `pin`, `pinHash`, `pinSalt`, `hashedPin`, `password`, `token`, dll.) disaring secara menyeluruh di denylist, allowlist per-koleksi, adapter purge (`deleteField()`), dan Security Rules.
     - Input backup umum tidak dapat mengontrol status hak akses (`role`, `permissions`, `isActive`, `requiresActivation`, `sessionRevokedAtSeconds`).
     - Marker pencabutan sesi bersifat monotonik naik (`Math.max(existing, now)`).
     - Perlindungan terhadap primary system admin (`usr-admin-01`) agar tidak terkunci/terdemosi saat restore.
     - Seluruh koleksi operasional (19 koleksi) diinventarisasi secara eksplisit.
  3. **V3-04 (Atomic Shared Rate Limiter & Trusted Ingress IP):**
     - Rate limiter mengimplementasikan mutex locking per kunci dan persistensi atomic sync file-backed.
     - Ekstraksi IP `getClientIp` memproteksi header spoofing dengan mengambil elemen terpercaya dari ingress proxy (`trust proxy`).
     - Pencatatan kegagalan ganda (per-identitas dan per-IP) untuk mencegah brute-force dan credential spraying.
  4. **V3-05 (Siklus Hidup Sesi, Aktivasi, dan Boundary Revokasi):**
     - Kontrak revokasi diselaraskan: token dengan `auth_time <= sessionRevokedAtSeconds` ditolak secara konsisten di Backend (`requireAuth`), `AuthContext`, dan `firestore.rules` (`auth_time > sessionRevokedAtSeconds`).
     - Gate aktivasi (`requiresActivation: true`) ditegakkan di Login, `requireAuth`, dan Rules.
     - `AuthContext` memprioritaskan profil Firestore sebagai otoritas role server atas claim token kadaluarsa.
  5. **V3-06 & V3-11 (Validasi dan Integritas Restore):**
     - Validasi menyeluruh terhadap seluruh payload sebelum penulisan pertama dimulai (array, ID string valid, tidak ada ID duplikat, tidak ada koleksi terlarang).
     - Audit log diperlakukan append-only dan tidak menimpa record yang sudah ada.
  6. **V3-08, V3-09, V3-10 (Status Endpoint, Harness Acceptance & Bundle):**
     - Endpoint `/api/auth/users-summary` dan `/api/auth/public-config` membedakan status `OPERATIONAL`, `EMPTY`/`SETUP`, dan `DEGRADED`/`PERMISSION_DENIED`.
     - Bundle ZIP menyertakan seluruh komponen esensial (`App.tsx`, `index.css`, seluruh routes/services/types/rules/scripts) dengan hash SHA-256 yang tervalidasi di `MANIFEST.sha256`.
- **Status Audit:** SOURCE REMEDIATED — READY FOR ISOLATED EMULATOR ACCEPTANCE GATE.

---

## [1.0.1] - 2026-10-02

### CHANGE REQUEST: Production Data Separation (Seed/Dummy vs Operational Data)

- **Tanggal:** 2 Oktober 2026
- **Tujuan:** Memisahkan data dummy/seed dari data operasional (production) secara aman dan terstruktur agar seluruh administrasi resmi sekolah (Dashboard, Statistik, Presensi GPS, Jadwal Piket, Jurnal Buku Piket, Buku Tamu, Izin Siswa, Siswa Terlambat, Insiden, Rekapitulasi, Ekspor Excel/CSV, dan Cetak PDF) hanya menggunakan data operasional yang sah.
- **Perubahan Utama:**
  1. Menambahkan tipe `DataSourceType` ('PRODUCTION' | 'SEED') dan antarmuka `BaseEntityMetadata` (`dataSource?: DataSourceType`, `isDemo?: boolean`) pada seluruh model entitas secara *backward-compatible*.
  2. Mengimplementasikan fungsi filter kompatibilitas `isOperationalRecord(item)` yang memperlakukan dokumen tanpa flag (legacy user input) sebagai data operasional, dan hanya mengecualikan dokumen bertanda `isDemo: true` atau `dataSource: 'SEED'`.
  3. Memperbarui `FirestoreService`:
     - Method `getAll()` dan `subscribeToCollection()` otomatis memfilter dan hanya mengembalikan data operasional (`operationalOnly: true`).
     - Method `getAllRaw()` disediakan untuk kebutuhan arsip cadangan (full backup) dan diagnostik tanpa mengabaikan dokumen apapun.
     - Method `setDocument()` otomatis menandai dokumen baru pengguna sebagai `dataSource: 'PRODUCTION'` dan `isDemo: false`.
  4. Menandai seluruh data inisialisasi awal (seed) dengan `dataSource: 'SEED'` dan `isDemo: true` pada:
     - `SEED_USERS` (`authService.ts`)
     - `seedTeachers`, `seedStaff`, `seedRooms`, `seedCategories` (`masterDataService.ts`)
     - `SEED_STUDENTS` (`studentService.ts`)
     - `seedSchedules` (`scheduleService.ts`)
     - `seedRecords` (`dutyBookService.ts`)
     - `seed` (`visitorService.ts`)
     - `seed` (`studentPermitService.ts`)
     - `seed` (`studentTardyService.ts`)
     - `seedIncidents` (`incidentService.ts`)
     - `seed` (`substitutionService.ts`)
     - `seed` (`announcementService.ts`)
  5. Menyelaraskan seluruh fungsi `bootstrapIfEmpty()` agar memeriksa ketersediaan dokumen dengan `getAllRaw()`, mencegah duplikasi dan tidak menganggap seed sebagai data operasional.
  6. Menjamin akun administrator bootstrap awal tetap dapat melakukan autentikasi sistem saat sistem baru dibuka, sementara daftar pengguna login otomatis mengutamakan data pengguna operasional resmi.
  7. Memperbarui `ReportService` dengan proteksi ganda (*defense-in-depth*) sehingga seluruh agregasi kehadiran, insiden, keterlambatan, perizinan, substitusi, dan tamu menyaring hanya data operasional.
  8. Menambahkan kartu status pemisahan data di menu Pengaturan tanpa menambahkan tombol purge (sesuai instruksi stabilitas).
- **File yang Diubah:**
  - `src/types/index.ts`
  - `src/types/master.types.ts`
  - `src/types/dutyBook.types.ts`
  - `src/types/incident.types.ts`
  - `src/types/studentTardy.types.ts`
  - `src/types/studentPermit.types.ts`
  - `src/types/substitution.types.ts`
  - `src/types/visitor.types.ts`
  - `src/types/announcement.types.ts`
  - `src/services/firebase/firestoreService.ts`
  - `src/services/auth/authService.ts`
  - `src/services/auth/userService.ts`
  - `src/services/firebase/masterDataService.ts`
  - `src/services/firebase/studentService.ts`
  - `src/services/firebase/scheduleService.ts`
  - `src/services/firebase/dutyBookService.ts`
  - `src/services/firebase/visitorService.ts`
  - `src/services/firebase/studentPermitService.ts`
  - `src/services/firebase/studentTardyService.ts`
  - `src/services/firebase/incidentService.ts`
  - `src/services/firebase/substitutionService.ts`
  - `src/services/firebase/announcementService.ts`
  - `src/services/reports/reportService.ts`
  - `src/features/dashboard/DashboardView.tsx`
  - `src/features/attendance/AttendancePreview.tsx`
  - `src/features/settings/SettingsView.tsx`
  - `src/services/backup/backupService.ts`
- **Database Impact:**
  - Non-destruktif. Tidak ada data yang dihapus atau di-purge.
  - Skema metadata kompatibel mundur.
- **Firebase Rules Impact:**
  - Tidak ada perubahan Firebase Rules pada tahap ini (ditandai untuk Security Hardening terpisah).
- **Testing:**
  - TypeScript type check (`tsc --noEmit`): PASS
  - Build verifikasi (`compile_applet` / `npm run build`): PASS
  - Linter (`lint_applet` / `npm run lint`): PASS
- **Regression:**
  - Tidak ada regresi fungsional. Seluruh alur login, RBAC, form input, dan navigasi berjalan stabil.
- **Status:**
  - IMPLEMENTED & VERIFIED (READY FOR PURGE READINESS REVIEW)
