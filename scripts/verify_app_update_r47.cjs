/** Isolated tests for app updates: no production Firebase or live networking. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
let ts;
try { ts = require('typescript'); }
catch {
  // Fallback for a machine with global tsc but no local node_modules.
  const { execFileSync } = require('node:child_process');
  const npmGlobal = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  ts = require(path.join(npmGlobal, 'typescript'));
}
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const tsFiles = ['src/services/offline/appUpdateManager.ts', 'src/components/layout/AppUpdateBanner.tsx', 'vite.config.ts'];
for (const name of tsFiles) {
  const result = ts.transpileModule(read(name), { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }});
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `TypeScript syntax ${name}: ${errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' '))}`);
  console.log('PASS TypeScript syntax:', name);
}
const sw = read('public/sw.js');
assert.match(sw, /__PIKET_BUILD_REV__/);
assert.match(read('vite.config.ts'), /piket-guru-sw-build-revision/);
assert.match(read('vite.config.ts'), /closeBundle/);
assert.match(read('index.html'), /updateViaCache: 'none'/);
assert.match(read('src/components/layout/AppUpdateBanner.tsx'), /Update tersedia/);
assert.match(read('src/components/layout/AppUpdateBanner.tsx'), /Perbarui/);
assert.match(read('src/components/layout/AppUpdateBanner.tsx'), /sm:hidden/);
new vm.Script(sw.replaceAll('__PIKET_BUILD_REV__', 'build-test'));
console.log('PASS generated service worker syntax');
console.log('PASS SW build revision, no-cache registration, compact UI');

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(event, fn) { const a = listeners.get(event) || []; a.push(fn); listeners.set(event, a); },
    removeEventListener(event, fn) { listeners.set(event, (listeners.get(event) || []).filter(x => x !== fn)); },
    dispatch(event) { for (const fn of listeners.get(event) || []) fn(); },
  };
}

function createManager({ waiting = true, online = true, failPost = false } = {}) {
  const controller = {};
  const swEvents = createEventTarget();
  const workerEvents = createEventTarget();
  let replacements = [];
  let postCount = 0;
  let updates = 0;
  const worker = Object.assign(workerEvents, {
    state: 'installed',
    postMessage(msg) {
      postCount++;
      assert.equal(msg.type, 'SKIP_WAITING');
      if (failPost) throw new Error('post failed');
      this.state = 'activated';
      swEvents.dispatch('controllerchange');
    },
  });
  const reg = Object.assign(createEventTarget(), {
    waiting: waiting ? worker : null,
    installing: null,
    active: controller,
    async update() { updates++; },
  });
  const sw = Object.assign(swEvents, {
    controller,
    ready: Promise.resolve(reg),
    async getRegistration() { return reg; },
  });
  const href = 'https://school.example/#dashboard';
  const sandbox = {
    exports: {}, navigator: { serviceWorker: sw, onLine: online },
    window: Object.assign(createEventTarget(), {
      location: { href, replace(url) { replacements.push(url); }, reload() { replacements.push('reload'); } },
    }),
    document: Object.assign(createEventTarget(), { hidden: false }),
    URL, Promise, Error, Date, console,
    setTimeout, clearTimeout,
  };
  const transpiled = ts.transpileModule(read('src/services/offline/appUpdateManager.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  vm.runInNewContext(transpiled, sandbox, {filename:'appUpdateManager.js'});
  return {Manager: sandbox.exports.AppUpdateManager, worker, reg, replacements, get postCount() {return postCount}, get updates() {return updates}, sw};
}


async function verifyStampPlugin() {
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'piket-r47-sw-'));
  fs.mkdirSync(path.join(tmp, 'public'));
  fs.mkdirSync(path.join(tmp, 'dist'));
  fs.writeFileSync(path.join(tmp, 'public/sw.js'), read('public/sw.js'));
  try {
    const emitted = ts.transpileModule(read('vite.config.ts'), {
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true}
    }).outputText;
    const fake = { exports: {} };
    const fakeRequire = (name) => {
      if (name === '@tailwindcss/vite' || name === '@vitejs/plugin-react') return () => ({});
      if (name === 'vite') return {defineConfig: fn => fn};
      return require(name);
    };
    vm.runInNewContext(emitted, {
      exports: fake.exports, module: fake, require: fakeRequire, __dirname:tmp, process, Date, console,
    }, {filename: 'vite.config.test.js'});
    const config = fake.exports.default();
    const plugin = config.plugins.find(p => p.name === 'piket-guru-sw-build-revision');
    assert.ok(plugin);
    await plugin.closeBundle();
    const output = fs.readFileSync(path.join(tmp, 'dist/sw.js'), 'utf8');
    assert.doesNotMatch(output, /__PIKET_BUILD_REV__/);
    assert.match(output, /piketguru-shell-/);
    new vm.Script(output);
    console.log('PASS build plugin writes a valid, stamped SW to dist');
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

async function run() {
  await verifyStampPlugin();
  {
    const x = createManager();
    x.Manager.init();
    await new Promise(r => setImmediate(r));
    let notified = false;
    x.Manager.subscribe((available) => { notified = available; });
    assert.equal(notified, true);
    await x.Manager.applyUpdate();
    assert.equal(x.postCount, 1);
    assert.equal(x.replacements.length, 1);
    assert.match(x.replacements[0], /_pg_update=/);
    assert.match(x.replacements[0], /#dashboard$/);
    console.log('PASS waiting worker -> SKIP_WAITING -> single navigational reload');
  }
  {
    const x = createManager({waiting:false});
    await x.Manager.applyUpdate();
    assert.equal(x.postCount, 0);
    assert.equal(x.replacements.length, 1);
    assert.equal(x.updates, 1);
    console.log('PASS no waiting worker -> manual reload still responds');
  }
  {
    const x = createManager({online:false});
    await assert.rejects(() => x.Manager.applyUpdate(), /Tidak ada koneksi/);
    assert.equal(x.replacements.length, 0);
    console.log('PASS offline -> actionable error without unsafe reload');
  }
  {
    const x = createManager({failPost:true});
    await assert.rejects(() => x.Manager.applyUpdate(), /post failed/);
    assert.equal(x.replacements.length, 0);
    console.log('PASS activation error -> report failure, no silent hang');
  }
  console.log('R47 checks passed');
}
run().catch(e => {console.error(e); process.exitCode = 1;});
