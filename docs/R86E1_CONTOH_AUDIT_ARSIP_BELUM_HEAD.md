> **CONTOH PROVISIONAL — BUKAN GITHUB HEAD**. Snapshot gabungan lokal melalui R85 dan R86-A/B/C/D. Jalankan scanner pada checkout terbaru untuk baseline resmi.

# R86-E1 — Baseline Statis Listener Firestore

**Sumber:** Snapshot tanpa metadata Git — belum membuktikan source produksi terbaru (branch belum diketahui).

**Waktu scan:** 2026-10-25T15:26:10.869Z. **Mode:** typescript. **Source:** 426 berkas. **Perubahan pada source:** nihil.

## Ringkasan

- Lokasi panggilan SDK `onSnapshot`: **5** (statis; loop/dinamika tidak dieksekusi).
- Lokasi pemanggil wrapper collection/document: **93**.
- Lokasi pemanggil feed notifikasi: **1**.
- Lokasi pemanggil feed audit: **2**.
- Pemanggil Auth observer (bukan Firestore listener): **2**.
- Lokasi baca satu-kali: **22**, **bukan realtime listener**.

## Daftar lokasi kode

| Lokasi | Jenis | Target indikatif | Tingkat review | Sinyal cleanup (bukan bukti) |
|---|---|---|---|---|
| `src/components/common/StudentMultiSelect.tsx:8` | COLLECTION_SUBSCRIBER | students | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/components/layout/Header.tsx:156` | DOCUMENT_SUBSCRIBER | settings | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/components/layout/NotificationBell.tsx:37` | NOTIFICATION_SUBSCRIBER | REVIEW_FUNCTION | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/contexts/AuthContext.tsx:247` | AUTH_OBSERVER | FIREBASE_AUTH_NOT_FIRESTORE | KRITIS — JANGAN PAUSE OTOMATIS | REACT_REVIEW |
| `src/contexts/AuthContext.tsx:325` | DOCUMENT_SUBSCRIBER | DYNAMIC_COLLECTION | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/contexts/AuthContext.tsx:340` | DOCUMENT_SUBSCRIBER | users | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AdminAttendanceDashboard.tsx:51` | DOCUMENT_SUBSCRIBER | settings | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AdminAttendanceDashboard.tsx:52` | COLLECTION_SUBSCRIBER | schedules | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AdminAttendanceDashboard.tsx:59` | COLLECTION_SUBSCRIBER | dutyBooks | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AdminAttendanceDashboard.tsx:62` | COLLECTION_SUBSCRIBER | attendance | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AdminAttendanceDashboard.tsx:72` | COLLECTION_SUBSCRIBER | attendance | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AttendancePreview.tsx:139` | DOCUMENT_SUBSCRIBER | settings | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AttendancePreview.tsx:150` | COLLECTION_SUBSCRIBER | schedules | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AttendancePreview.tsx:154` | COLLECTION_SUBSCRIBER | teachers | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AttendancePreview.tsx:155` | COLLECTION_SUBSCRIBER | staff | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/attendance/AttendancePreview.tsx:174` | COLLECTION_SUBSCRIBER | attendance | KRITIS — JANGAN PAUSE OTOMATIS | REACT_REVIEW |
| `src/features/command-center/CommandCenterPreview.tsx:62` | COLLECTION_SUBSCRIBER | schedules | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/command-center/CommandCenterPreview.tsx:63` | COLLECTION_SUBSCRIBER | attendance | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/command-center/CommandCenterPreview.tsx:64` | COLLECTION_SUBSCRIBER | visitors | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/command-center/CommandCenterPreview.tsx:65` | COLLECTION_SUBSCRIBER | studentPermits | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/command-center/CommandCenterPreview.tsx:66` | COLLECTION_SUBSCRIBER | studentTardiness | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/command-center/CommandCenterPreview.tsx:67` | COLLECTION_SUBSCRIBER | incidents | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:157` | COLLECTION_SUBSCRIBER | substitutions | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:169` | DOCUMENT_SUBSCRIBER | settings | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:173` | COLLECTION_SUBSCRIBER | schedules | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:177` | COLLECTION_SUBSCRIBER | teachers | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:178` | COLLECTION_SUBSCRIBER | staff | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:179` | COLLECTION_SUBSCRIBER | attendance | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:185` | COLLECTION_SUBSCRIBER | dutyBooks | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:191` | COLLECTION_SUBSCRIBER | incidents | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:197` | COLLECTION_SUBSCRIBER | announcements | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:207` | COLLECTION_SUBSCRIBER | studentTardiness | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:213` | COLLECTION_SUBSCRIBER | studentPermits | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/dashboard/DashboardView.tsx:219` | COLLECTION_SUBSCRIBER | visitors | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/duty-book/DutyBookPreview.tsx:61` | COLLECTION_SUBSCRIBER | schedules | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, REACT_REVIEW |
| `src/features/duty-book/DutyBookPreview.tsx:75` | COLLECTION_SUBSCRIBER | dutyBooks | KRITIS — JANGAN PAUSE OTOMATIS | REACT_REVIEW |
| `src/features/incidents/IncidentPreview.tsx:72` | COLLECTION_SUBSCRIBER | incidentCategories | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/incidents/IncidentPreview.tsx:83` | COLLECTION_SUBSCRIBER | incidents | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:52` | DOCUMENT_SUBSCRIBER | settings | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:60` | COLLECTION_SUBSCRIBER | schedules | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:61` | COLLECTION_SUBSCRIBER | substitutions | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:67` | COLLECTION_SUBSCRIBER | studentTardiness | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:73` | COLLECTION_SUBSCRIBER | studentPermits | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:79` | COLLECTION_SUBSCRIBER | visitors | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/kiosk/KioskPreview.tsx:85` | COLLECTION_SUBSCRIBER | announcements | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/master/LessonSchedulesPanel.tsx:45` | DOCUMENT_SUBSCRIBER | lessonSchedules | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/master/MasterDataTabs.tsx:112` | COLLECTION_SUBSCRIBER | teachers | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/master/MasterDataTabs.tsx:115` | COLLECTION_SUBSCRIBER | staff | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/master/MasterDataTabs.tsx:118` | COLLECTION_SUBSCRIBER | students | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/master/MasterDataTabs.tsx:121` | COLLECTION_SUBSCRIBER | rooms | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/master/MasterDataTabs.tsx:124` | COLLECTION_SUBSCRIBER | incidentCategories | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:427` | COLLECTION_SUBSCRIBER | schedules | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:431` | COLLECTION_SUBSCRIBER | teachers | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:435` | COLLECTION_SUBSCRIBER | incidentCategories | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:472` | COLLECTION_SUBSCRIBER | attendance | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:483` | COLLECTION_SUBSCRIBER | dutyBooks | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:489` | COLLECTION_SUBSCRIBER | incidents | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:495` | COLLECTION_SUBSCRIBER | studentTardiness | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:501` | COLLECTION_SUBSCRIBER | studentPermits | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:507` | COLLECTION_SUBSCRIBER | substitutions | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/reports/ReportsPreview.tsx:513` | COLLECTION_SUBSCRIBER | visitors | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:163` | DOCUMENT_SUBSCRIBER | settings | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:165` | COLLECTION_SUBSCRIBER | schedules | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:170` | COLLECTION_SUBSCRIBER | users | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:174` | COLLECTION_SUBSCRIBER | teachers | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:178` | COLLECTION_SUBSCRIBER | staff | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:182` | COLLECTION_SUBSCRIBER | rooms | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/schedules/SchedulePreview.tsx:202` | COLLECTION_SUBSCRIBER | attendance | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/AnnouncementSettingsCard.tsx:20` | DOCUMENT_SUBSCRIBER | settings | TERLINDUNGI — REVIEW MANUAL | REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:363` | COLLECTION_SUBSCRIBER | users | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:369` | COLLECTION_SUBSCRIBER | schedules | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:370` | COLLECTION_SUBSCRIBER | substitutions | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:376` | COLLECTION_SUBSCRIBER | studentTardiness | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:382` | COLLECTION_SUBSCRIBER | studentPermits | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:388` | COLLECTION_SUBSCRIBER | visitors | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/settings/SettingsView.tsx:394` | COLLECTION_SUBSCRIBER | announcements | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/student-permits/StudentPermitFormModal.tsx:346` | DOCUMENT_SUBSCRIBER | studentPermits | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/student-permits/StudentPermitsPreview.tsx:115` | COLLECTION_SUBSCRIBER | teachers | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/student-permits/StudentPermitsPreview.tsx:127` | COLLECTION_SUBSCRIBER | studentPermits | TERLINDUNGI — REVIEW MANUAL | REACT_REVIEW |
| `src/features/student-tardiness/StudentTardyPreview.tsx:100` | COLLECTION_SUBSCRIBER | studentTardiness | TERLINDUNGI — REVIEW MANUAL | REACT_REVIEW |
| `src/features/substitutions/SubstitutionFormModal.tsx:129` | COLLECTION_SUBSCRIBER | students | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/substitutions/SubstitutionFormModal.tsx:196` | COLLECTION_SUBSCRIBER | substitutions | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/substitutions/SubstitutionFormModal.tsx:224` | DOCUMENT_SUBSCRIBER | lessonSchedules | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/substitutions/SubstitutionPreview.tsx:93` | COLLECTION_SUBSCRIBER | teachers | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/substitutions/SubstitutionPreview.tsx:117` | COLLECTION_SUBSCRIBER | substitutions | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/features/users/UserManagementView.tsx:110` | COLLECTION_SUBSCRIBER | users | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/users/UserManagementView.tsx:114` | COLLECTION_SUBSCRIBER | students | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/features/visitors/VisitorFormModal.tsx:598` | DOCUMENT_SUBSCRIBER | visitors | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/visitors/VisitorPreview.tsx:106` | COLLECTION_SUBSCRIBER | teachers | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/visitors/VisitorPreview.tsx:107` | COLLECTION_SUBSCRIBER | staff | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/visitors/VisitorPreview.tsx:108` | COLLECTION_SUBSCRIBER | users | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/features/visitors/VisitorPreview.tsx:122` | COLLECTION_SUBSCRIBER | visitors | TERLINDUNGI — REVIEW MANUAL | REACT_REVIEW |
| `src/hooks/useAuditLogFeed.ts:32` | AUDIT_FEED_SUBSCRIBER | REVIEW_FUNCTION | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, REACT_REVIEW |
| `src/hooks/useAuditLogHistory.ts:88` | AUDIT_HISTORY_SUBSCRIBER | REVIEW_FUNCTION | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT |
| `src/hooks/useOperationalSchoolSettings.ts:9` | DOCUMENT_SUBSCRIBER | settings | PERLU KLASIFIKASI | REACT_REVIEW |
| `src/hooks/useSubjectCatalog.ts:16` | DOCUMENT_SUBSCRIBER | subjects | PERLU KLASIFIKASI | CLEANUP_HINT, REACT_REVIEW |
| `src/services/audit/auditHistoryService.ts:76` | SDK_LISTENER | auditLogs | TERLINDUNGI — REVIEW MANUAL | METADATA_CALLBACKS |
| `src/services/audit/auditLogFeedService.ts:34` | SDK_LISTENER | auditLogs | TERLINDUNGI — REVIEW MANUAL | CLEANUP_HINT, METADATA_CALLBACKS |
| `src/services/auth/authService.ts:53` | AUTH_OBSERVER | FIREBASE_AUTH_NOT_FIRESTORE | PERLU KLASIFIKASI | MANUAL |
| `src/services/firebase/firestoreService.ts:352` | IN_TAB_SHARING | REVIEW_FUNCTION | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT |
| `src/services/firebase/firestoreService.ts:359` | SDK_LISTENER | QUERY_EXPRESSION_REVIEW | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT |
| `src/services/firebase/firestoreService.ts:535` | IN_TAB_SHARING | REVIEW_FUNCTION | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT |
| `src/services/firebase/firestoreService.ts:537` | SDK_LISTENER | DYNAMIC_DOCUMENT | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT |
| `src/services/notifications/emergencyService.ts:144` | DOCUMENT_SUBSCRIBER | emergencies | KRITIS — JANGAN PAUSE OTOMATIS | MANUAL |
| `src/services/notifications/notificationFeedService.ts:48` | SDK_LISTENER | DYNAMIC_NOTIFICATION_SOURCES | KRITIS — JANGAN PAUSE OTOMATIS | CLEANUP_HINT, METADATA_CALLBACKS |

## Batas dan risiko

- Jumlah call site statis BUKAN jumlah listener yang aktif, wire/network stream, callback, dokumen yang dibaca, atau read Firestore berbayar.
- sharedLiveSource berbagi listener identik hanya di dalam satu tab dan memiliki scope akun; tidak otomatis berbagi antartab.
- Jalur onSnapshot dinamis dalam loop notificationFeedService dapat membuat 0–4 subscription sesuai konfigurasi per mount, bukan selalu satu.
- Kehadiran petunjuk cleanup tidak membuktikan cleanup selalu dijalankan pada semua cabang; perlu uji komponen dan session teardown.
- Listener presensi, auth, emergency, sesi dan offline tidak boleh dipause untuk E1.
- Runtime R86-C hanya menginstrumentasi subset tertentu; angka emisi callback tidak setara dengan billed reads.
- Tidak ada request ke Firebase atau penghapusan cache/IndexedDB; ini inventaris kode statis.
- AST memindai panggilan bernama yang dikenal di berkas ts/tsx, bukan alias, registerListener buatan sendiri atau seluruh jalur JavaScript; perlu review manual.

## Next steps validasi di staging

1. Catat HEAD GitHub lokal yang telah Fetch/Pull. Jalankan script ini di repository tersebut dengan opsi `--out artifacts/r86e1`.
2. Dev/Preview dengan R86-A/B/C/D opt-in, rekam snapshot tiap tab untuk skenario 1, 2, 3, 5 tab. Lakukan pengujian tab foreground/background, logout, offline, update PWA.
3. Bandingkan `opened`, `active`, `closed`, `emissions` R86-C per kategori; jangan disamakan dengan read Firebase berbayar.
4. Catat Firestore billed document reads dari Firebase Console pada skenario setara secara terpisah dari callback SDK (jangan jalankan pengujian dengan akun/data sekolah sungguhan).
5. Audit cleanup, keberadaan fallback data, pemulihan listener saat tab kembali, dan risiko izin sebelum menyetujui R86-E2.

**Gate E2:** tidak ada listener presensi, autentikasi, notifikasi urgent, session recovery, antrean/offline yang dinonaktifkan hanya demi penghematan.
