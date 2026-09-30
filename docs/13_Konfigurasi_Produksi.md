# SPESIFIKASI INFRASTRUKTUR: KONFIGURASI PRODUKSI
**Aplikasi Piket Guru v1.0.0 — Jadwal dan Buku Piket Digital Sekolah**

Dokumen teknis ini ditujukan bagi Administrator Sistem dan Tim Pengembang (*DevOps/Engineer*) untuk pemeliharaan, pembangunan (*build*), serta orkestrasi lingkungan produksi aplikasi.

---

### 1. RINGKASAN STACK TEKNOLOGI
* **Pondasi Bahasa**: TypeScript v5.7.3 (Strict Mode).
* **Framework Antarmuka**: React v19.0.1 (SPA - Single Page Application).
* **Build Engine & Bundler**: Vite v6.2.0.
* **Styling Framework**: Tailwind CSS v4.3.3 (`@tailwindcss/vite`).
* **Basis Data & Backend Cloud**: Google Cloud Firestore v12.19.0.
* **Ikonografi & Desain**: Lucide React v0.546.0.
* **Animasi Antarmuka**: Motion v12.23.24.
* **Server Dev/Runtime**: Node.js v22 + Express v4.21.2 + TSX v4.21.0.

---

### 2. STRUKTUR DEPENDENSI UTAMA (`package.json`)
```json
{
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "firebase": "^12.19.0",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^8.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2"
  }
}
```

---

### 3. INSTRUKSI BUILD & RUNTIME COMMANDS
* **Instalasi Dependensi**:
  ```bash
  npm install
  ```
* **Pemeriksaan Tipe & Linting (Type Checking)**:
  ```bash
  npm run lint
  # Eksekusi internal: tsc --noEmit
  ```
* **Kompilasi Siap Produksi (Production Build)**:
  ```bash
  npm run build
  # Eksekusi internal: vite build (Output: direktori /dist)
  ```
* **Menjalankan Server Pengembangan (Dev Server)**:
  ```bash
  npm run dev
  # Eksekusi internal: vite --port=3000 --host=0.0.0.0
  ```
* **Pembersihan Cache & Build Lama**:
  ```bash
  npm run clean
  # Eksekusi internal: rm -rf dist server.js
  ```

---

### 4. KONFIGURASI BASIS DATA CLOUD (FIREBASE)
Konfigurasi terhubung secara resmi ke Google Cloud Platform dengan rincian:
* **Firebase Project ID**: `ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192`
* **Firestore Database ID**: `(default)`
* **Berkas Konfigurasi**: `firebase-applet-config.json`
* **Skema Aturan Keamanan**: `firestore.rules` (Telah dideploy ke cloud)
* **Kredensial Sensitif**:
  - `apiKey`: `*** (Tersimpan aman dalam environment cloud)`
  - `authDomain`: `ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192.firebaseapp.com`
  - `storageBucket`: `ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192.firebasestorage.app`

---

### 5. INTEGRASI GOOGLE DRIVE
* **Status**: Tidak ditemukan dalam source code — perlu dikonfirmasi oleh administrator.
* **Metode Penyimpanan Alternatif**: Menggunakan kompresi data URI lokal pada Firestore.

---

### 6. PROGRESSIVE WEB APP (PWA) & SERVICE WORKER
* **Web App Manifest**: `/manifest.json`
  - `name`: `"Piket Guru - Jadwal dan Buku Piket Digital"`
  - `short_name`: `"Piket Guru"`
  - `start_url`: `"/"`
  - `display`: `"standalone"`
  - `theme_color`: `"#1d4ed8"`
  - `background_color`: `"#ffffff"`
* **Service Worker**: `/sw.js` (Cache Version: `piket-guru-v1.0.0`)
  - Strategi Cache: *Cache-First* untuk aset statis (HTML, JS, CSS, SVG Icons) dan *Network-First* untuk panggilan Firestore.

---

### 7. ENVIRONMENT VARIABLES TEMPLATE (`.env.example`)
Variabel lingkungan yang digunakan dalam pembangunan dan produksi:
```env
# Port Server Aplikasi
PORT=3000

# Kunci API Layanan Eksternal (Jika Diaktifkan)
VITE_FIREBASE_API_KEY=***
VITE_FIREBASE_PROJECT_ID=ai-studio-piketguru-efa7ce79-970b-4e62-9504-5111ca090192
GEMINI_API_KEY=***
```

---

### 8. INFORMASI HOSTING & DOMAIN
* **Lingkungan Pengembangan (Dev URL)**:
  `https://ais-dev-syt3n7d7vwyf24eow6eytu-52162231161.asia-southeast1.run.app`
* **Lingkungan Pratinjau / Produksi (Shared URL)**:
  `https://ais-pre-syt3n7d7vwyf24eow6eytu-52162231161.asia-southeast1.run.app`
* **Port Layanan Dev**: `3000` (Listening pada `0.0.0.0`)
