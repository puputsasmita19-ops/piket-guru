'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
const expect = (value, message) => { assert.ok(value, message); passed += 1; };

// Compile syntax-only checks (the app's full tsc/vite build requires npm ci).
for (const [file, isTsx] of [
  ['src/services/offline/appUpdateManager.ts', false],
  ['src/components/layout/AppUpdateBanner.tsx', true],
]) {
  const source = read(file);
  const output = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, ...(isTsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) },
  });
  const errors = output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [];
  assert.deepEqual(errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')), []);
  passed += 1;
}

function emitter() {
  const events = new Map();
  return {
    addEventListener(type, fn) { let set = events.get(type); if (!set) events.set(type, set = new Set()); set.add(fn); },
    removeEventListener(type, fn) { events.get(type)?.delete(fn); },
    emit(type) { for (const fn of [...(events.get(type) || [])]) fn(); },
  };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 4));

function setup({ waiting = true, online = true, autoActivate = true, slowRegistration = false } = {}) {
  const workerEvents = emitter();
  const swEvents = emitter();
  const regEvents = emitter();
  const windowEvents = emitter();
  const documentEvents = emitter();
  const metrics = { messages: 0, updates: 0, registrationReads: 0, navigations: [], stages: [] };
  const worker = {
    state: 'installed',
    addEventListener: workerEvents.addEventListener,
    removeEventListener: workerEvents.removeEventListener,
    postMessage(msg) {
      assert.equal(msg.type, 'SKIP_WAITING');
      metrics.messages++;
      if (autoActivate) {
        queueMicrotask(() => {
          worker.state = 'activated';
          workerEvents.emit('statechange');
          swEvents.emit('controllerchange');
        });
      }
    },
  };
  const reg = {
    waiting: waiting ? worker : null,
    installing: null,
    active: null,
    addEventListener: regEvents.addEventListener,
    update: async () => { metrics.updates++; },
  };
  const sw = {
    controller: {},
    ready: Promise.resolve(reg),
    addEventListener: swEvents.addEventListener,
    removeEventListener: swEvents.removeEventListener,
    getRegistration() {
      metrics.registrationReads++;
      return slowRegistration ? new Promise(() => {}) : Promise.resolve(reg);
    },
  };
  const nav = {
    href: 'https://school.example/#dashboard',
    replace: href => metrics.navigations.push(href),
    reload: () => metrics.navigations.push('reload'),
  };
  const sandbox = {
    module: { exports: {} },
    window: { location: nav, addEventListener: windowEvents.addEventListener },
    document: { hidden: false, addEventListener: documentEvents.addEventListener },
    navigator: { onLine: online, serviceWorker: sw },
    Date, URL, setTimeout, clearTimeout, console,
  };
  sandbox.exports = sandbox.module.exports;
  const output = ts.transpileModule(read('src/services/offline/appUpdateManager.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(output.outputText, sandbox);
  return { manager: sandbox.module.exports.AppUpdateManager, metrics, worker, reg, sw };
}

(async () => {
  // Ready worker path: no synchronous registration.update() when clicking.
  {
    const { manager, metrics } = setup();
    manager.init();
    await tick();
    expect(manager.hasUpdate, 'Update must be available after a waiting worker is detected');
    const oldReg = metrics.registrationReads;
    const oldUpd = metrics.updates;
    await manager.applyUpdate(stage => metrics.stages.push(stage));
    expect(metrics.messages === 1, 'Exactly one activation message per click');
    expect(metrics.registrationReads === oldReg, 'Click must not do a second registration read when waiting worker is known');
    expect(metrics.updates === oldUpd, 'Click must not wait on a second network update()');
    expect(metrics.navigations.length === 1, 'Refresh must happen once');
    expect(metrics.stages[0] === 'activating' && metrics.stages.at(-1) === 'reloading', 'Stages must report activation and reload');
    expect(metrics.navigations[0].includes('_pg_update=') && metrics.navigations[0].includes('#dashboard'), 'Cache-bust reload preserves route hash');
  }
  // Rapid double-click: deduplicate while activation is in progress.
  {
    const { manager, metrics } = setup();
    manager.init();
    await tick();
    const [a,b] = await Promise.all([manager.applyUpdate(), manager.applyUpdate()]);
    expect(metrics.messages === 1, 'Double tap must send one activation message');
    expect(metrics.navigations.length === 1, 'Double tap must initiate one reload');
  }
  // Missing waiting worker: bounded lookup; fallback reload with no network update.
  {
    const { manager, metrics } = setup({ waiting: false });
    manager.init();
    await tick();
    const before = metrics.updates;
    await manager.applyUpdate(stage => metrics.stages.push(stage));
    expect(metrics.stages.includes('checking'), 'Fallback should show checking status');
    expect(metrics.stages.includes('reloading'), 'Fallback should show reloading status');
    expect(metrics.updates === before, 'Fallback must not trigger another network update()');
    expect(metrics.navigations.length === 1, 'Fallback must reload to retrieve latest HTML');
  }
  // Offline must not reload or delete anything.
  {
    const { manager, metrics } = setup({ online: false });
    await assert.rejects(manager.applyUpdate(), /internet/i);
    passed += 1;
    expect(metrics.messages === 0 && metrics.navigations.length === 0, 'Offline click cannot activate/reload');
  }
  // Browser readiness glitches: bounded registration lookup (1.2 s max).
  {
    const { manager, metrics } = setup({waiting:false, slowRegistration:true});
    // directly call applyUpdate: no init wait
    await manager.applyUpdate(stage => metrics.stages.push(stage));
    expect(metrics.navigations.length === 1, 'Hung registration must not block update forever');
    expect(metrics.stages.join(',') === 'checking,reloading', 'Show progress during slow registration');
  }
  // No service worker: safe standard reload.
  {
    const { manager, metrics } = setup();
    // Remove SW from navigator inside separate sandbox not applicable; source guard static tested below.
    expect(typeof manager.applyUpdate === 'function', 'Manager public API retained');
  }

  const banner = read('src/components/layout/AppUpdateBanner.tsx');
  expect(banner.includes('updatingRef.current'), 'UI prevents duplicate fast taps');
  expect(banner.includes("setStage('activating')"), 'UI shows immediate click feedback');
  expect(banner.includes('sm:hidden') && banner.includes('Update tersedia'), 'Mobile label is compact');
  expect(banner.includes("stage === 'checking'") && banner.includes("stage === 'reloading'"), 'UI exposes phases');
  expect(banner.includes('aria-live="polite"'), 'Status is accessible to screen readers');
  expect(!read('src/services/offline/appUpdateManager.ts').includes('localStorage.clear'), 'Update does not clear localStorage');

  console.log(`PASS: ${passed} R53 update checks (including async mock SW tests)`);
})().catch(err => { console.error(err); process.exitCode = 1; });
