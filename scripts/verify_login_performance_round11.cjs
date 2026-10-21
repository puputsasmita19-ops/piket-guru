/** Source-level regression checks for the login performance patch (R11).
 *  Run from repository root: node scripts/verify_login_performance_round11.cjs
 *  Does not replace npm run lint or production browser tests.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const read = f => fs.readFileSync(f, 'utf8');
const authContext = read('src/contexts/AuthContext.tsx');
const login = read('src/features/auth/LoginPage.tsx');
const backdrop = read('src/features/auth/LoginBackdrop.tsx');
const service = read('src/services/auth/authService.ts');
let checks = 0;
function check(description, fn) { fn(); checks++; console.log('PASS', description); }
for (const file of ['src/contexts/AuthContext.tsx', 'src/features/auth/LoginPage.tsx', 'src/features/auth/LoginBackdrop.tsx', 'src/services/auth/authService.ts']) {
  check(`Sintaks ${file}`, () => {
    const source = read(file);
    const transpiled = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }});
    const errors = (transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
  });
}
check('Tidak ada pemuatan modul dashboard saat fokus form login', () => assert(!login.includes('onFocusCapture={() => preloadAuthenticatedShell()}')));
check('Tidak ada pemuatan modul dashboard sebelum permintaan PIN', () => {
  const body = authContext.slice(authContext.indexOf('const loginWithPin ='), authContext.indexOf('const loginWithGoogle ='));
  assert(body.indexOf('await authService.authenticateWithPin(') < body.indexOf('preloadAuthenticatedShell();'));
});
check('Pemuatan modul dashboard setelah hasil PIN berhasil', () => {
  const body = authContext.slice(authContext.indexOf('const loginWithPin ='), authContext.indexOf('const loginWithGoogle ='));
  assert(body.indexOf('if (res.success && res.user)') < body.indexOf('preloadAuthenticatedShell();'));
});
check('Pemuatan modul dashboard setelah verifikasi Google', () => {
  const body = authContext.slice(authContext.indexOf('const loginWithGoogle ='), authContext.indexOf('const refreshProfile ='));
  assert(body.indexOf('await validateFirebaseUserProfile(') < body.indexOf('preloadAuthenticatedShell();'));
});
check('Pemulihan sesi masih memverifikasi Firebase profile sebelum modul dashboard', () => {
  const body = authContext.slice(authContext.indexOf('const unsubscribe = onAuthStateChanged('), authContext.indexOf('return () => {\n      isMounted = false;'));
  assert(body.indexOf('await validateFirebaseUserProfile(') < body.indexOf('preloadAuthenticatedShell();'));
});
check('Login tetap memverifikasi PIN di backend', () => assert(service.includes("fetch('/api/auth/login'")));
check('Login masih memverifikasi custom token Firebase', () => assert(service.includes('await signInWithCustomToken(auth, data.customToken)')));
check('Daftar pengguna tidak diambil setiap fokus selama TTL', () => assert(service.includes('age >= 45000') && login.includes('void refreshLoginUsers();')));
check('Daftar pengguna tetap meminta data server untuk menyegarkan', () => assert(service.includes("fetch('/api/auth/users-summary'")));
check('Animasi dihentikan saat login diproses', () => assert(login.includes('<LoginBackdrop paused={isSubmitting || isGoogleSubmitting}') && backdrop.includes('&& !paused && value.motionEnabled')));
check('Popup Google tetap menggunakan Firebase Auth', () => assert(authContext.includes('await signInWithPopup(auth, provider)')));
console.log(`\n${checks} pemeriksaan terarah R11 berhasil.`);
