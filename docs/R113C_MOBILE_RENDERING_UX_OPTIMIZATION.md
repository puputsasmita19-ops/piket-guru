# R113-C — Mobile Rendering & UX Optimization

Baseline source: R113-B2, with protected Login/GPS R112 checksum intact, Vercel Functions `sin1`.

## Scope (no database, auth, GPS, or rules changes)

1. **Memoized dashboard selectors:** day-filtered records and `dashboardInfoConfig` use stable references; the statistic-card series is regenerated only when relevant records/status change, instead of on every independent realtime update.
2. **Lightweight statistic cards:** `DashboardStatistics`, `MiniTrend`, and `QuickActions` are memoized; numeric-formatting objects are reused without altering the Indonesian display style or accessible labels.
3. **Modal-only work:** announcement, teacher roster and incident modal contents are built only when the corresponding modal is open. Photo lookup still starts only on opening roster, per R113-B.
4. **Vertical scrolling safety:** Flash Info no longer captures touch pointers on every pointer down. Only a gesture classified as horizontal claims the pointer; vertical movement uses native scrolling. Left/right swipe thresholds and click navigation remain intact.
5. **Mobile compositor hygiene:** `will-change: transform` applies to the Flash Info track only during transitions, not when idle. Reduced-motion CSS is preserved.

## Safety contract

- No change to `firestore.rules`, collections, listener filters, listener count, role permissions, GPS, Check-In, Check-Out, PIN or Firebase auth.
- All 42 schedule records remain available to recurring and future-duty calculations. Linked master and lazy roster behavior R113-B remain intact.
- No new timers, watchers, Firestore reads or persistent cache.
- Mobile dashboard first-frame and snapshot timings may fluctuate with network/cache; do not claim improvements without field measurements.

## Local tests

```bash
node scripts/test_r113c_mobile_rendering_ux.mjs
node scripts/test_r113b2_dashboard_loading_stabilization.mjs
node scripts/test_r113b_smart_dashboard_loading.mjs
node scripts/test_r113a_dashboard_performance_audit.mjs
node scripts/test_r92_roster_lazy_avatar.mjs
node scripts/verify_baseline_login_gps_r112.mjs --full
npm ci
npm run lint
npm run build
```

## Mobile Preview acceptance checks

1. Log in on Android; open `/?dashboard_diag=1` and note first-frame, core-ready, all-source-ready, and 44 expected snapshot documents **before opening the roster modal**. Number of documents may change with actual data.
2. Scroll vertically over the Flash Info card 10 times: page must move smoothly, slides should not swipe during vertical scroll.
3. Swipe Flash Info left/right; buttons, pause, autoplay and keyboard controls must still work. Check reduced-motion accessibility setting.
4. Switch between Beranda, Jadwal, Presensi and back multiple times; controls must respond and no duplicate subscriptions should remain.
5. Open Guru Bertugas Hari Ini/Besok, verify name/avatar and closure; opening is the only time full teacher/staff master listeners should appear.
6. Update an announcement and attendance record; realtime cards/statistics still update. Verify secondary statistics show skeleton until loaded and error state when unavailable.
7. Check Check-In/Check-Out, GPS and login against R112 baseline; unchanged behavior is a release criterion.

## Test limitations

Local targeted tests and baseline script are source/unit checks, not proof of actual phone frame rate or production network performance. Full lint and build require installing project dependencies; the provided execution environment has no `node_modules`.
