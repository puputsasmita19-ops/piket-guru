import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();
const source = (path) => readFileSync(join(root, path), 'utf8');
const login = source('src/features/auth/LoginPage.tsx');
const style = source('src/index.css');
const auth = source('src/services/auth/authService.ts');
const routes = source('src/server/routes/authRoutes.ts');
const gps = source('src/features/attendance/AttendancePreview.tsx');
const location = source('src/services/location/locationService.ts');
let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${passed}: ${name}`); }
  catch (err) { console.error(`FAIL ${name}: ${err.message}`); process.exitCode = 1; }
}
for (const file of ['src/features/auth/LoginPage.tsx','src/features/attendance/AttendancePreview.tsx','src/services/auth/authService.ts','src/server/routes/authRoutes.ts']) {
  check(`TS/TSX syntax: ${file}`, () => {
    const result = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(result.parseDiagnostics.length, 0);
  });
}
check('haptic removed from login and CSS', () => {
  assert.doesNotMatch(login, /pinHaptics|haptic|vibrat|onPinPointerDown|onPinClickFeedback|Settings2/gi);
  assert.doesNotMatch(style, /login-pin-haptic/gi);
});
check('keypad retains all PIN actions', () => {
  assert.match(login, /onClick=\{\(\) => handlePinInput\(num\)\}/);
  assert.match(login, /onClick=\{\(\) => handlePinInput\('0'\)\}/);
  assert.match(login, /onClick=\{handleClear\}/);
  assert.match(login, /onClick=\{handleBackspace\}/);
  assert.match(login, /handleSubmit/);
});
check('account list prioritized over optional school branding', () => {
  assert.match(auth, /users-summary'.*priority: 'high'/);
  assert.match(login, /public-config'.*priority: 'low'/);
  assert.match(login, /setTimeout\(\(\) => \{/);
});
check('public directory coalesces parallel backend reads', () => {
  assert.match(routes, /publicUsersSnapshotRequest/);
  assert.match(routes, /readPublicUsersSummary\(\)/);
  assert.match(routes, /expiresAt: Date\.now\(\) \+ 5000/);
  assert.match(routes, /Cache-Control', 'no-store, private'/);
});
check('server PIN authentication still does live user lookups', () => {
  assert.match(routes, /authRouter.post\('\/login', AuthRateLimiter.loginMiddleware/);
  assert.match(routes, /adminDb\.collection\('users'\)\.where\('loginId'/);
  assert.match(routes, /AuthRateLimiter\.isLocked\(userId\)/);
});
check('login uses backend verification and Firebase token', () => {
  assert.match(auth, /await fetch\('\/api\/auth\/login'/);
  assert.match(auth, /signInWithCustomToken\(auth, data.customToken\)/);
  assert.match(auth, /userCredential\.user\.uid !== data.user.id/);
});
check('GPS prewarm requires already-granted permission', () => {
  assert.match(gps, /perms\.query\(\{ name: 'geolocation' \}\)/);
  assert.match(gps, /permission\.state !== 'granted'/);
  assert.match(gps, /document\.hidden/);
});
check('GPS attaches to shared prewarmed search without waiting for warmup', () => {
  assert.match(gps, /const request = LocationService\.getCurrentPosition\(\{/);
  assert.match(gps, /void request\.catch\(\(\) => \{\}\)/);
  assert.match(gps, /const position = await acquirePosition\(\)/);
  assert.doesNotMatch(gps, /await earlyFix/);
});
check('GPS status uses fresh reading and official school geofence', () => {
  assert.match(gps, /LocationService\.isFreshPosition\(pos, 15000\)/);
  assert.match(gps, /settings\.schoolLat, settings\.schoolLng, settings\.allowedRadiusMeters/);
  assert.match(gps, /MAX_ATTENDANCE_ACCURACY_METERS/);
  assert.match(gps, /setGeofence\(geo\)/);
  assert.match(location, /MAX_ATTENDANCE_ACCURACY_METERS = 50/);
});
check('R95 selfie guidance and R96 action highlighting are preserved', () => {
  assert.match(gps, /shouldGuideToSelfie/);
  assert.match(gps, /shouldHighlightCheckIn/);
  assert.match(gps, /shouldHighlightCheckOut/);
  assert.match(gps, /isCameraModalOpen/);
});
check('GPS does not auto-submit/check-in on location detection', () => {
  const block = gps.split('const refreshGpsLocation = async')[1].split('// Today\'s schedule')[0];
  assert.doesNotMatch(block, /handleCheckIn\(|handleCheckOut\(|handleSubmit\(/);
});
console.log(`${passed}/15 R102 checks passed`);
if (passed !== 15) process.exitCode = 1;
