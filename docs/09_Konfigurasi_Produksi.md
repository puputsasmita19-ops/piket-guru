```
================================================================================
                                 PIKET GURU
                        JADWAL DAN BUKU PIKET DIGITAL
                           [SEKOLAH INDONESIA MAJU]
                                 Versi 1.0.0
                  Dokumen: 09 — KONFIGURASI PRODUKSI
                   Tahun Pelajaran: 2026/2027
================================================================================
```

# IDENTITAS DOKUMEN
* **Nama Aplikasi**: PIKET GURU
* **Versi**: v1.0.0
* **Status**: PRODUCTION
* **Tanggal**: 30 September 2026
* **Dokumen**: 09_Konfigurasi_Produksi
* **Klasifikasi**: CONFIDENTIAL / ADMIN / DEVELOPER
* **Penanggung Jawab**: Tim DevOps & Administrator IT

---

## 1. TECHNOLOGY STACK
* **Bahasa**: TypeScript v5.7.3 (Strict Type Checking)
* **Frontend SPA**: React v19.0.1
* **Bundler & Tooling**: Vite v6.2.0
* **Styling**: Tailwind CSS v4.3.3 (`@tailwindcss/vite`)
* **Basis Data Cloud**: Google Cloud Firestore SDK v12.19.0
* **Ikonografi & Animasi**: Lucide React v0.546.0, Motion v12.23.24
* **Audio Engine**: Web Audio API (Native Browser Oscillator Synthesis)
* **Server Runtime**: Node.js v22.x, Express v4.21.2, TSX Engine

---

## 2. PROJECT DIRECTORY STRUCTURE
```
/
├── public/                 # Aset statis publik (Manifest, Service Worker, Ikon)
│   ├── docs/               # Portal Dokumen Cetak PDF Resmi
│   ├── icon.svg
│   ├── manifest.json
│   └── sw.js
├── docs/                   # Arsip Dokumentasi Resmi Markdown
├── src/
│   ├── components/         # Komponen UI umum, layout, dan kamera
│   ├── config/             # Konfigurasi konstanta dan RBAC permissions
│   ├── contexts/           # State global AuthContext
│   ├── features/           # Modul fitur fungsional (attendance, duty-book, users, dll.)
│   ├── services/           # Logika backend Firestore, audio, backup, location
│   ├── types/              # Deklarasi tipe TypeScript antarmuka data
│   ├── App.tsx             # Root aplikasi dan rute routing
│   └── main.tsx            # Entry point SPA dan registrasi Service Worker
├── index.html              # HTML entry point, SEO meta, dan script tema FOUC
├── firestore.rules         # Aturan keamanan Cloud Firestore aktif
├── metadata.json           # Metadata izin AI Studio
├── package.json            # Daftar dependensi dan scripts
└── tsconfig.json           # Konfigurasi kompilasi TypeScript
```

---

## 3. BUILD PIPELINE
* **Pembersihan Berkas Build**: `npm run clean`
* **Validasi Tipe (Type Check)**: `npm run lint` (eksekusi: `tsc --noEmit`)
* **Kompilasi Produksi**: `npm run build` (eksekusi: `vite build` ➔ output: `/dist`)
* **Mode Pratinjau**: `npm run preview`

---

## 4. ENVIRONMENT VARIABLES (`.env`)
```env
# Port Layanan Server
PORT=3000

# Konfigurasi Google Cloud & Firebase [REDACTED]
VITE_FIREBASE_API_KEY=[REDACTED]
VITE_FIREBASE_AUTH_DOMAIN=ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192
VITE_FIREBASE_STORAGE_BUCKET=ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192.firebasestorage.app
GEMINI_API_KEY=[REDACTED]
```

---

## 5. FIREBASE CLOUD CONFIGURATION
* **Cloud Platform**: Google Cloud Platform (GCP)
* **Project ID**: `ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192`
* **Firestore Database ID**: `(default)`
* **Firestore Region**: `asia-southeast1`

---

## 6. SECURITY RULES CONFIGURATION
Aturan `firestore.rules` aktif:
* Mengizinkan pembacaan publik untuk profil instansi dan papan display Kiosk TV.
* Menegakkan audit trail kebal hapus:
  ```javascript
  match /auditLogs/{logId} {
    allow read: if true;
    allow create: if true;
    allow update, delete: if false; // IMMUTABLE
  }
  ```

---

## 7. INDEKS BASIS DATA (INDEXES)
* Indeks tunggal otomatis (*Single-Field Index*) aktif pada field: `nip`, `tanggal`, `hari`, `status`, `userId`, `scheduleId`.
* Kueri audit log terurut menurun pada field `timestamp desc`.

---

## 8. STATUS GOOGLE DRIVE API
* **Status**: *PERLU KONFIRMASI ADMINISTRATOR* untuk aktivasi direct OAuth scope.
* **Metode Saat Ini**: Media disimpan langsung dalam dokumen Firestore melalui kompresi kanvas.

---

## 9. PROGRESSIVE WEB APP (PWA) & CACHING
* **Web App Manifest**: `/manifest.json` (Standalone display, theme `#1d4ed8`).
* **Service Worker**: `/sw.js` (Cache identifier: `piket-guru-v1.0.0`).
* **Strategi Cache**: Cache-First untuk aset JavaScript/CSS dan Network-First untuk permintaan Firestore.

---

## 10. DEPLOYMENT RUNTIME
* **Hosting Container**: Google Cloud Run (Containerized Environment).
* **Port Layanan**: 3000 (Binding: `0.0.0.0`).
* **Protokol**: Wajib HTTPS/SSL untuk mengaktifkan Web Geolocation API dan Camera API pada peramban gawai seluler.

---

## 11. PENCADANGAN SISTEM (BACKUP)
* Ekspor 16 koleksi data via modul `BackupService.createFullBackup()`.
* Format luaran berupa berkas JSON tunggal terenkripsi schema v1.0.0.

---

## 12. PEMULIHAN SISTEM (RESTORE)
* Validasi berkas pra-eksekusi via `BackupService.validateBackupSchema()`.
* Batch write ke koleksi Firestore dengan pencatatan otomatis ke log audit forensik.

---

## 13. MONITORING & PEMELIHARAAN
* Audit forensik dipantau melalui tab *Audit Forensik* pada menu Pengaturan Sistem.
* Periksa status koneksi listener Firestore secara berkala untuk memastikan tidak ada pemutusan jaringan.
