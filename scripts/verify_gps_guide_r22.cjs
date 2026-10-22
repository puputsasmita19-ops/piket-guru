const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const read = f => fs.readFileSync(f, 'utf8');
const gpsFile = 'src/services/location/locationService.ts';
const attendanceFile = 'src/features/attendance/AttendancePreview.tsx';
const guideFile = 'src/components/guide/InteractiveGuideTour.tsx';
const styleFile = 'src/index.css';
const sources = [gpsFile, attendanceFile, guideFile].map(read);
let count = 0;
function check(message, test) { assert.ok(test, message); count++; }
for (let i = 0; i < sources.length; i++) {
  const diagnostics = ts.transpileModule(sources[i], {
    fileName: [gpsFile, attendanceFile, guideFile][i],
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  }).diagnostics || [];
  check('TS syntax valid', diagnostics.length === 0);
}
check('No GPS 2.5s technical copy', !/2,5 detik/i.test(sources[0] + sources[1]));
check('GPS UI does not hide badge during locating', sources[1].includes('action={settingsReady && validSchoolLocation ? ('));
check('Inside radius needs valid accuracy', sources[1].includes("geofence?.status === 'DALAM_LOKASI' ? 'Dalam radius'"));
check('Manual refresh requests live reading', sources[1].includes('forceFresh: isManual'));
check('Guide does not observe whole React DOM', !sources[2].includes('MutationObserver'));
check('Guide has stable steps', sources[2].includes('[adminTour, permissionSignature]'));
check('Guide does not depend on unstable navigation setter', !sources[2].includes('activeTab, setActiveTab]'));
check('Guide avoids smooth mobile auto-scroll', sources[2].includes('width >= 768') && !sources[2].includes("behavior: 'smooth'"));
check('Guide limits element-mount polling', sources[2].includes('attempts >= 25'));
check('Guide has touch-friendly sticky footer', read(styleFile).includes('guide-card footer { position: sticky'));

function makeEnv({ readings = [], initialCache = null, makePositionError = false } = {}) {
  const store = new Map();
  if (initialCache) store.set('piket-guru:last-valid-position', JSON.stringify(initialCache));
  let watcherCount = 0;
  let quickCount = 0;
  let watchId = 0;
  const timers = new Map();
  const context = {
    exports: {}, module: { exports: {} }, Date, JSON, Error, console, setTimeout, clearTimeout,
    window: { isSecureContext: true, sessionStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    } },
    navigator: { geolocation: {
      getCurrentPosition: (success, error) => { quickCount++; if (makePositionError) setTimeout(() => error({ code: 2, POSITION_UNAVAILABLE: 2 }), 2); },
      watchPosition: (success, error) => {
        watcherCount++; const id = ++watchId;
        timers.set(id, readings.map(r => setTimeout(() => success({ timestamp: Date.now(), coords: {
          latitude: r.lat, longitude: r.lng, accuracy: r.accuracy, altitude: null, speed: null,
        } }), r.at)));
        return id;
      },
      clearWatch: (id) => { (timers.get(id) || []).forEach(clearTimeout); },
    } },
  };
  const js = ts.transpileModule(sources[0], {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, context, { filename: 'locationService.js' });
  return { LocationService: context.exports.LocationService, counters: () => ({ watcherCount, quickCount }), store };
}

async function main() {
  const initial = Date.now();
  const env = makeEnv({ readings: [{ at: 15, lat: -8.151243, lng: 113.712439, accuracy: 38 }] });
  const starts = Date.now();
  const updates = [];
  const pos = await env.LocationService.getCurrentPosition({ timeoutMs: 1500, onProgress: (p, temp) => updates.push([p, temp]) });
  check('Accepts 38m reading immediately (no 1s refine)', Date.now() - starts < 400 && pos.accuracy === 38);
  check('Returns initial progress', updates.length > 0);
  const inside = env.LocationService.evaluateGeofence(pos.latitude, pos.longitude, pos.accuracy, -8.151243, 113.712439, 120);
  check('Accurate close reading is inside school radius', inside.status === 'DALAM_LOKASI');
  const tooFar = env.LocationService.evaluateGeofence(-8.153, 113.712439, 15, -8.151243, 113.712439, 35);
  check('Outside school radius stays rejected', tooFar.status === 'DI_LUAR_LOKASI');
  const imprecise = env.LocationService.evaluateGeofence(-8.151243, 113.712439, 70, -8.151243, 113.712439, 35);
  check('Imprecise position remains unapproved', imprecise.status === 'AKURASI_RENDAH');
  const beforeCached = env.counters().watcherCount;
  const cached = await env.LocationService.getCurrentPosition({ timeoutMs: 600 });
  check('Uses valid fresh cache for initial display', cached.accuracy === 38 && env.counters().watcherCount === beforeCached);

  const freshEnv = makeEnv({ initialCache: { ...pos, timestamp: Date.now() }, readings: [{ at: 20, lat: -8.1512, lng: 113.7124, accuracy: 22 }] });
  const live = await freshEnv.LocationService.getCurrentPosition({ forceFresh: true, timeoutMs: 600 });
  check('Force fresh bypasses cached reading', live.accuracy === 22 && freshEnv.counters().watcherCount === 1);
  const refineEnv = makeEnv({ readings: [{ at: 10, lat: -8.151243, lng: 113.712439, accuracy: 90 }, { at: 55, lat: -8.151243, lng: 113.712439, accuracy: 24 }] });
  const refined = await refineEnv.LocationService.getCurrentPosition({ timeoutMs: 800 });
  check('Low accuracy waits for a valid reading', refined.accuracy === 24);
  const failed = makeEnv({ readings: [], makePositionError: true });
  let failureMessage = '';
  try { await failed.LocationService.getCurrentPosition({ timeoutMs: 80 }); } catch (e) { failureMessage = e.message; }
  check('Failure keeps actionable generic guidance', Boolean(failureMessage) && !failureMessage.includes('2,5 detik'));
  const interrupted = makeEnv({ readings: [{ at: 250, lat: -8.151243, lng: 113.712439, accuracy: 15 }] });
  const job = interrupted.LocationService.getCurrentPosition({ timeoutMs: 800 });
  interrupted.LocationService.cancelCurrentSearch();
  let name = '';
  try { await job; } catch (e) { name = e.name; }
  check('Cancelled GPS task settles with AbortError', name === 'AbortError');
  console.log(`OK: ${count} pemeriksaan R22 lulus (termasuk simulasi GPS browser).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
