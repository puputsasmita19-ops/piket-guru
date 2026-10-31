# R110 — Firestore Latency & Auth Region Optimization

## Baseline (actual Chrome Android, R109, 3 consecutive logins)

- PIN -> sesi: **4.21 / 3.98 / 3.88 detik**, rata-rata 4.02 detik.
- Backend: sekitar **2.15 dtk**; rate-limit gate **0.72 dtk**; reset rate-limit **0.70 dtk**.
- Firebase Sign-In sekitar **1.49 dtk**. Durasi login server tidak termasuk pertukaran token Firebase.

## Perbaikan source

1. **Batch Firestore reads in one transaction** — `src/server/middleware/rateLimiter.ts` now supports optional `getMany(keys)` in the transaction adapter. Production Firestore uses `Transaction.getAll(...refs)` to read multiple lock records plus lease registry in one batch read. The same applies to outstanding lease docs, login-success reset, and failed-attempt records. No cached lock decisions, no removal of IP/account rate limit or lease safety; errors remain fail-closed.
2. **Backwards-compatible test transport** — drivers without `getMany` continue to use existing `tx.get` calls. The adapter can fall back if an older Firestore SDK lacks `getAll`. The batch result size is validated and incomplete read rejects the transaction.
3. **Expose only the Vercel Function region in opt-in login diagnostics** — on successful login, an `X-PG-Function-Region` header with the trusted `VERCEL_REGION` region code (e.g., `sin1`), if provided by the runtime, is displayed in the `?login_diag=1` panel. No device location, PIN, token, user ID, or database credentials are included.
4. **Explicit, opt-in deployment region tool** — `scripts/r110_set_vercel_region.mjs` makes no changes by default. Only after the operator verifies the existing Firestore database location in the Firebase Console can it update `vercel.json` with `--apply`. Does not overwrite a pre-existing different region or function-level override.

## Why no region was automatically selected

Current `vercel.json` has no `regions` property. The Firebase config names the database as `(default)`, **not** its geographic location. Configuring `sin1` without verifying whether Firestore is in Jakarta/Singapore, the US, or elsewhere could worsen latency. Vercel's project dashboard may also specify a region independently of the repository.

Firestore database location cannot be changed in place. Moving compute close to the database is safer than migrating the database. The source patch does **not** change the Firestore location, credentials, data, or security rules.

## Deployment (two isolated comparisons recommended)

### A. Apply code batching first

1. Extract R110 ZIP over repository **after R109**; overwrite matching paths.
2. Run `node scripts/test_r110_firestore_region_optimization.mjs`, `node scripts/test_r109_fast_authentication_pipeline.mjs`, and `node scripts/test_r108_atomic_rate_limiter_login.mjs`.
3. Run `npm run lint` and `npm run build` in the fully installed project.
4. Commit/push to Vercel. Confirm API Functions deploy (not just web/PWA).
5. On the same Chrome Android 4G device open `https://piket-guru-ashen.vercel.app/?login_diag=1` and record 3–5 successful logins (median). Compare API/backend, gate, reset, Firebase, total PIN->session, and dashboard shell time with R109.

### B. Check and optionally adjust Vercel region

1. In Firebase Console -> Firestore Database, select the correct database `(default)` and view its **Location**. If not visible, find database location in Google Cloud Console -> Firestore -> Databases. Record exact location (e.g. `asia-southeast2`). Do not assume location from project ID, school address, or users.
2. Open Vercel project -> Settings -> Functions -> **Function Regions** and check actual active region, or read the `Vercel Function region` line in `?login_diag=1` (shown only if runtime reports it).
3. Preview mapping without writing:
   `node scripts/r110_set_vercel_region.mjs --firestore-location asia-southeast2`
4. **Only if Firestore location is confirmed** and mapping is suitable, apply:
   `node scripts/r110_set_vercel_region.mjs --firestore-location asia-southeast2 --apply`
5. Review diff `vercel.json`, commit/push, confirm Vercel API's region, then repeat the same 3–5 measurements.

Supported mapping in the script: `asia-southeast2 -> sin1` (Jakarta to Singapore), `asia-southeast1 -> sin1` (Singapore), `asia-east1 -> hkg1` (Taiwan), `asia-northeast1 -> hnd1` (Tokyo). If your database has another location, do **not** use an unsupported mapping; choose a supported nearby Vercel region based on official docs and review it manually. Vercel plan limits and project-specific overrides still apply.

## Security, correctness, and limitations

- Keeps UID/IP/account lock check, failure counters, lease contention limits, transaction isolation, scrypt, Firebase custom token, and Firebase Sign-In.
- Reset does not remove an active IP block. No new Firestore Rules are necessary.
- Firestore `getAll` reduces read calls within transactions; **it cannot remove the transaction's commit latency or round-trip to a remote region**. Do not assume sub-3-second login without production measurements.
- No automated emulator or live Vercel/Firestore measurement was performed in this offline environment. Test PIN wrong/locked and parallel login under staging before whole-school rollout.

## Official references

- Vercel Functions regions: https://vercel.com/docs/functions/configuring-functions/region
- Vercel project configuration: https://vercel.com/docs/project-configuration/vercel-json
- Google Firestore database locations: https://firebase.google.com/docs/firestore/locations
- Firestore transaction getAll API: https://googleapis.dev/nodejs/firestore/latest/Transaction.html
