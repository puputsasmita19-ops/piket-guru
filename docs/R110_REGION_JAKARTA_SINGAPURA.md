# R110 Region Alignment — Jakarta Firestore → Vercel Singapore

## Confirmed from screenshots (31 October 2026)
- Firebase Firestore `(default)`: `asia-southeast2` (Jakarta).
- Vercel login API currently runs `iad1` (Washington, D.C., USA).
- This file only sets top-level `"regions": ["sin1"]` in `vercel.json`.
- It does not change Firestore location, API endpoints, JWT validation, password hashing, PIN, rate limiting, or Firestore rules.

## Deploy
1. Use this ONLY after R110 authentication patch has been applied. Back up the existing root `vercel.json` if you have further customization.
2. Copy the enclosed `vercel.json` into the root repository, preserving other site configuration. If your own `vercel.json` differs, instead add `"regions": ["sin1"]` manually to your current config.
3. Deploy by committing/pushing with GitHub Desktop, then confirm the Vercel build and backend deployment succeed.
4. Open `https://piket-guru-ashen.vercel.app/?login_diag=1` on the same phone; verify `Vercel Function region: sin1`. Do not compare latency until this value is confirmed.
5. Repeat 3–5 login tests on comparable mobile network conditions; compare medians for backend, gate, reset, Firebase and session/dashboard total.
6. Test correct PIN, wrong PIN, lockout and recovery; verify admin and teacher sessions as usual.

## Rollback
Restore the previous `vercel.json` from GitHub Desktop (or remove the new root `regions` key) and redeploy.

## Notes
The result depends on network and backend conditions. `sin1` is closer to Jakarta but does not guarantee a sub-3-second login. Existing deployed functions may not move until Vercel finishes a new deployment. Project-level settings or function-level overrides should be checked if diagnostic still reports `iad1`.

Official docs:
- https://vercel.com/docs/functions/configuring-functions/region
- https://firebase.google.com/docs/firestore/locations
