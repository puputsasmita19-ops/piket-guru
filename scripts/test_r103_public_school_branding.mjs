import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = process.cwd();
const get = (path) => readFileSync(resolve(root, path), 'utf8');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const helperSource = get('src/features/auth/publicLoginBrand.ts');
const compiled = stripTypeScriptTypes(helperSource);
const { validSchoolDisplayName, readPublicLoginBrand, storePublicLoginBrand, PUBLIC_LOGIN_BRAND_CACHE_KEY, pickPublicLoginBrand } =
  await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(compiled)}`);
const storage = () => {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};

test('old demo school name is never accepted for display', () => {
  assert.equal(validSchoolDisplayName('SMA Negeri 1 Prestasi Bangsa'), '');
  assert.equal(validSchoolDisplayName(' sma negeri 1 prestasi bangsa '), '');
});
test('real names remain unchanged', () => {
  assert.equal(validSchoolDisplayName('SMK dr. SOEBANDI'), 'SMK dr. SOEBANDI');
});
test('cache stores only a narrow allowlist, not GPS or credentials', () => {
  const s = storage();
  storePublicLoginBrand(s, { schoolName: 'SMK dr. SOEBANDI', appName: 'Piket Guru', schoolLat: -6.2, schoolLng: 106.8, pin: 'SECRET', accessToken: 'SECRET' }, 123_000);
  const raw = s.getItem(PUBLIC_LOGIN_BRAND_CACHE_KEY);
  assert.ok(raw.includes('SMK dr. SOEBANDI'));
  for (const sensitive of ['schoolLat', 'schoolLng', 'pin', 'accessToken']) assert.ok(!raw.includes(sensitive));
});
test('a successful cached identity appears immediately', () => {
  const s = storage();
  storePublicLoginBrand(s, { schoolName: 'Sekolah Resmi' }, 123_000);
  assert.equal(readPublicLoginBrand(s, 123_001).schoolName, 'Sekolah Resmi');
});
test('expired cache is ignored', () => {
  const s = storage();
  storePublicLoginBrand(s, { schoolName: 'Sekolah Resmi' }, 123_000);
  assert.equal(readPublicLoginBrand(s, 123_000 + 16 * 60 * 1000), null);
});
test('future-dated cache is ignored', () => {
  const s = storage();
  storePublicLoginBrand(s, { schoolName: 'Sekolah Resmi' }, 123_000);
  assert.equal(readPublicLoginBrand(s, 122_999), null);
});
test('unverified legacy-style cache is ignored', () => {
  const s = storage();
  s.setItem(PUBLIC_LOGIN_BRAND_CACHE_KEY, JSON.stringify({ version: 1, savedAt: 123_000, source: 'DEFAULT_FALLBACK', brand: { schoolName: 'Test' } }));
  assert.equal(readPublicLoginBrand(s, 123_001), null);
});
test('malformed cached JSON is ignored safely', () => {
  const s = storage();
  s.setItem(PUBLIC_LOGIN_BRAND_CACHE_KEY, 'not json');
  assert.equal(readPublicLoginBrand(s, 123_001), null);
});
test('demonstration identity actively removes previous cache', () => {
  const s = storage();
  storePublicLoginBrand(s, { schoolName: 'Sekolah Resmi' }, 123_000);
  storePublicLoginBrand(s, { schoolName: 'SMA Negeri 1 Prestasi Bangsa' }, 124_000);
  assert.equal(s.getItem(PUBLIC_LOGIN_BRAND_CACHE_KEY), null);
});
test('server response does not reintroduce demo names', () => {
  const s = get('src/server/routes/authRoutes.ts');
  assert.ok(s.includes('validSchoolDisplayName(data.schoolName)'));
  assert.ok(s.includes("res.setHeader('Cache-Control', 'no-store, max-age=0')"));
});
test('login does not read old full school config cache', () => {
  const s = get('src/features/auth/LoginPage.tsx');
  assert.ok(s.includes('readPublicLoginBrand(window.localStorage)'));
  assert.ok(!s.includes("getItem('piket_guru_school_config')"));
});
test('login immediately requests current public identity', () => {
  const s = get('src/features/auth/LoginPage.tsx');
  assert.ok(s.includes("fetch('/api/auth/public-config', { priority: 'low', cache: 'no-store', signal: controller.signal })"));
  assert.ok(!s.includes("userLookupStatus === 'loading' ? 1500 : 0"));
});
test('login only stores authoritative public identity', () => {
  const s = get('src/features/auth/LoginPage.tsx');
  assert.ok(s.includes("data?.source === 'DATABASE'"));
  assert.ok(s.includes('storePublicLoginBrand'));
  assert.ok(!s.includes("localStorage.setItem('piket_guru_school_config'"));
});
test('default settings and watermark do not render old identity', () => {
  for (const f of ['src/config/constants.ts', 'src/services/watermark/watermarkService.ts', 'src/features/settings/SettingsView.tsx']) {
    assert.ok(!get(f).includes('SMA Negeri 1 Prestasi Bangsa'));
  }
});
test('school operational GPS defaults remain untouched', () => {
  const s = get('src/config/constants.ts');
  assert.ok(s.includes('allowedRadiusMeters: 50'));
  assert.ok(s.includes('schoolLocationLocked') || s.includes('schoolLng: 106.816666'));
});
test('cache filtering excludes untrusted values', () => {
  const brand = pickPublicLoginBrand({ schoolName: 5, appName: ['test'], address: { invalid: 1 } });
  assert.equal(brand.schoolName, '');
  assert.equal(brand.appName, '');
  assert.equal(brand.address, '');
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}`, e.message); }
}
console.log(`R103: ${tests.length - failed}/${tests.length} PASS`);
process.exitCode = failed ? 1 : 0;
