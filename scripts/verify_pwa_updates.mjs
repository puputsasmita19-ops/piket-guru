/** Run with: node --experimental-strip-types scripts/verify_pwa_updates.mjs */
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passes = 0;
const check = (label, fn) => { fn(); passes += 1; console.log(`PASS ${label}`); };

// Verify two Vercel deployments stamp different script bodies without editing source.
const temp = await mkdtemp(join(tmpdir(), 'piket-pwa-test-'));
try {
  const input = await readFile(join(root, 'public/sw.js'), 'utf8');
  const script = join(root, 'scripts/stamp_pwa_release.mjs');
  const run = async (id) => {
    await copyFile(join(root, 'public/sw.js'), join(temp, 'sw.js'));
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, PIKET_GURU_DIST_DIR: temp, VERCEL_DEPLOYMENT_ID: id },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return {
      sw: await readFile(join(temp, 'sw.js'), 'utf8'),
      meta: JSON.parse(await readFile(join(temp, 'app-version.json'), 'utf8')),
    };
  };
  const versionA = await run('vercel-build-a');
  const versionB = await run('vercel-build-b');
  check('SW source uses a placeholder (not a manually incremented release)', () => assert.ok(input.includes("const CACHE_VERSION = 'dev-source'")));
  // Above comparison uses snapshot (tests should not need the original repo).
  check('A and B deployments get different cache names', () => assert.notEqual(versionA.meta.version, versionB.meta.version));
  check('release metadata matches emitted SW script', () => assert.ok(versionB.sw.includes(`const CACHE_VERSION = '${versionB.meta.version}'`)));
  check('SW keeps user-approved activation only', () => {
    assert.ok(versionB.sw.includes("event.data.type === 'SKIP_WAITING'"));
    assert.match(versionB.sw, /if \(event\.data && event\.data\.type === 'SKIP_WAITING'\)/);
  });
} finally {
  await rm(temp, { recursive: true, force: true });
}

// Simulate browser service worker lifecycle without a real Firebase/backend.
function emitter(extra = {}) {
  const handlers = new Map();
  return {
    ...extra,
    addEventListener(type, cb) {
      handlers.set(type, [...(handlers.get(type) || []), cb]);
    },
    dispatch(type) {
      (handlers.get(type) || []).forEach((listener) => listener());
    },
  };
}

const windowEvents = emitter();
let periodicCheck;
let reloadCount = 0;
const win = {
  ...windowEvents,
  setInterval: (callback) => { periodicCheck = callback; return 1; },
  location: { reload: () => { reloadCount += 1; } },
};
const doc = emitter({ visibilityState: 'visible' });
let updateChecks = 0;
const reg = emitter({
  waiting: null,
  installing: null,
  async update() { updateChecks += 1; },
});
const serviceWorker = emitter({
  controller: null,
  ready: Promise.resolve(reg),
  async getRegistration() { return reg; },
});
globalThis.window = win;
globalThis.document = doc;
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker, onLine: true }, configurable: true });
const { AppUpdateManager } = await import('../src/services/offline/appUpdateManager.ts');
let notifications = [];
AppUpdateManager.subscribe((available, apply) => notifications.push({ available, apply }));
AppUpdateManager.init();
await new Promise((resolve) => setImmediate(resolve));

check('initialises SW watcher and checks registered worker', () => assert.ok(updateChecks >= 1));
const firstInstall = emitter({ state: 'installing', postMessage() {} });
reg.installing = firstInstall;
reg.dispatch('updatefound');
firstInstall.state = 'installed';
firstInstall.dispatch('statechange');
check('first-ever PWA install does not trigger an update alert', () => assert.equal(notifications.length, 0));
serviceWorker.controller = { state: 'activated' };
const newRelease = emitter({ state: 'installing', messages: [], postMessage(msg) { this.messages.push(msg); } });
reg.installing = newRelease;
reg.dispatch('updatefound');
newRelease.state = 'installed';
newRelease.dispatch('statechange');
check('new installed deployment triggers banner notification', () => {
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].available, true);
  assert.equal(AppUpdateManager.hasUpdate, true);
});
const beforeFocus = updateChecks;
win.dispatch('focus');
await new Promise((resolve) => setImmediate(resolve));
check('returning to app checks for updates', () => assert.equal(updateChecks, beforeFocus + 1));
const beforeHidden = updateChecks;
doc.visibilityState = 'hidden';
doc.dispatch('visibilitychange');
await new Promise((resolve) => setImmediate(resolve));
check('hidden tab does not poll', () => assert.equal(updateChecks, beforeHidden));
doc.visibilityState = 'visible';
doc.dispatch('visibilitychange');
await new Promise((resolve) => setImmediate(resolve));
check('visible tab checks for updates', () => assert.equal(updateChecks, beforeHidden + 1));
const beforeOffline = updateChecks;
navigator.onLine = false;
periodicCheck();
await new Promise((resolve) => setImmediate(resolve));
check('offline mode does not poll', () => assert.equal(updateChecks, beforeOffline));
navigator.onLine = true;
win.dispatch('online');
await new Promise((resolve) => setImmediate(resolve));
check('connection restoration checks for new version', () => assert.equal(updateChecks, beforeOffline + 1));
check('the app does not auto-reload without confirmation', () => assert.equal(reloadCount, 0));
notifications[0].apply();
check('approval sends SKIP_WAITING to the pending worker', () => assert.deepEqual(newRelease.messages, [{ type: 'SKIP_WAITING' }]));
serviceWorker.dispatch('controllerchange');
serviceWorker.dispatch('controllerchange');
check('controller change refreshes exactly once after approval', () => assert.equal(reloadCount, 1));
console.log(`\n${passes} PWA regression checks passed`);
