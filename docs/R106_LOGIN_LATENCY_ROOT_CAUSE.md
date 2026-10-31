# R106 — Fast PIN Login, UX Cleanup & Instrumentation

## Issue
On mobile, selecting an account and entering a correct PIN may still take 5–7 seconds even after earlier UI optimizations. Those earlier changes did not eliminate repeated server database lookups, signing delays, or Firebase sign-in network time.

## Changes
1. **UI:** Text-only `Hapus` on the clear-all PIN button; the one-digit backspace retains its familiar icon and its action.
2. **Selected account direct lookup:** The login page explicitly passes `accountUid` only when an account is chosen from a **server-provided** public user list. The backend validates `accountUid === identifier` and reads that UID's user document directly. The selected UID is never a credential; PIN verification, account activation status, rate limiting, Firebase signing and UID checks remain mandatory.
3. **Manual login:** When the user types an ID or NIP without selecting an account, the server still performs all identity/alias lookups and refuses ambiguous results.
4. **Gate:** IP lock and account lock are checked concurrently (both remain mandatory), reducing sequential store reads.
5. **After successful PIN:** Security rate-limit reset and Firebase custom-token signing happen in parallel. Both must succeed before the server responds; no fail-open behavior.
6. **Diagnostics:** Successful server responses include numeric-only `Server-Timing` header (`gate`, `lookup`, `lock`, `pin`, `rateReset`, `signer`, `total`). Browser Performance entries track `pin-api`, `firebase-signin`, and `pin-end-to-end`; browser console prints only timings, not UID/PIN/token.

## Why 3 seconds cannot be guaranteed
Total observed time includes browser ↔ Vercel transport and cold starts, rate limiter store, Firestore, adaptive scrypt computation, Firebase custom-token signing (which may involve IAM), Firebase Identity Toolkit exchange, and initial dashboard download. This patch removes redundant lookups and overlaps independent work; it does not change password hashing or eliminate security checks.

## Mobile measurement (after deployment)
- **Chrome remote DevTools > Console:** filter `PIKET LOGIN PERFORMANCE`. Compare `Backend: gate, lookup, pin, rateReset, signer, total` vs `Mobile: pinApi, firebaseSignIn, total`.
- The `pinApi` browser duration includes server + network; `firebaseSignIn` is a separate external request. If `gate` is large, inspect rate limiter storage; if `pin` large, inspect CPU/cold start of Node scrypt; if `signer` large, inspect Admin SDK signer/Cloud IAM latency and service-account initialization. If browser `firebaseSignIn` is large, investigate mobile network/Firebase region; if initial dashboard seems slow after login, profile the JS chunks and authenticated-shell load.
- Test 5 logins, measure median and p95 for Wi‑Fi and mobile 4G. Redact account IDs, tokens and PIN in reports.

## Apply
Overwrite changed source paths into repository after R105. No Firestore schema or rules changes required.

```sh
node scripts/test_r106_login_latency.mjs
npm run lint
npm run build
```

Tests here are static/runtime unit checks; they are **not** proof of sub-3-second real mobile login. Vercel Preview and an actual mobile connection must be tested; ensure Firebase login and account lockout still work, including incorrect PIN, disabled account and manual ID/NIP login.
