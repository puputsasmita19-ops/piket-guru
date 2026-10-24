'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const welcome = read('src/features/dashboard/WelcomeSentence.tsx');
const flash = read('src/features/dashboard/DashboardFlashInfo.tsx');
const icon = read('src/features/dashboard/DashboardOutlineControlIcon.tsx');
const css = read('src/index.css');
let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('PASS', name); }
  catch (err) { console.error('FAIL', name, err.message); process.exitCode = 1; }
};
for (const file of ['src/features/dashboard/WelcomeSentence.tsx', 'src/features/dashboard/DashboardFlashInfo.tsx', 'src/features/dashboard/DashboardOutlineControlIcon.tsx']) {
  test(`TSX parses: ${path.basename(file)}`, () => {
    const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(tree.parseDiagnostics.length, 0, tree.parseDiagnostics.map(d => d.messageText).join('; '));
  });
}
test('Outline icon uses no filled glyph', () => assert.match(icon, /fill="none" stroke="currentColor" strokeWidth="1\.65"/));
test('All four icon symbols exist', () => ['previous','next','pause','play'].forEach(x => assert.match(icon,new RegExp(`symbol === '${x}'`))));
test('Icons are aria-hidden, labels belong to buttons', () => assert.match(icon, /aria-hidden="true" focusable="false"/));
test('Flash controls grouped', () => assert.match(flash, /className="flash-control-group" role="group"/));
test('Flash previous remains wired', () => assert.match(flash, /aria-label="Info sebelumnya"[\s\S]*?onClick=\{\(\) => change\(-1\)\}/));
test('Flash next remains wired', () => assert.match(flash, /aria-label="Info berikutnya"[\s\S]*?onClick=\{\(\) => change\(1\)\}/));
test('Flash pause remains toggleable', () => assert.match(flash, /onClick=\{togglePlayback\}/));
test('Flash respects reduced motion/autoplay flags', () => assert.match(flash, /config\.autoPlay && !reducedMotion && slides\.length > 1/));
test('Flash detail link remains accessible', () => assert.match(flash, /className="flash-open" onClick=\{slide\.onAction\}/));
test('Flash swipe interaction retained', () => assert.match(flash, /onPointerUp=\{e => \{/));
test('Welcome pause outside message in hero', () => assert.match(welcome, /heroLayout && control/));
test('Welcome pause keeps original callback', () => assert.match(welcome, /setPausedAt\(previous => previous === null \? now : null\)/));
test('Welcome sentence rotation preserved', () => assert.match(welcome, /useWelcomeClock\(config\.mode, config\.intervalSeconds, config\.enabled && pausedAt === null\)/));
test('Legacy observer positioning removed', () => assert.doesNotMatch(welcome, /ResizeObserver|--welcome-control-top|useLayoutEffect/));
test('Pill controls are styled', () => assert.match(css, /\.flash-control-group\s*\{[^}]*border-radius:\s*999px/));
test('Mobile Flash controls center aligned', () => assert.match(css, /\.flash-control-group \{ align-self: center; \}/));
test('Mobile targets are at least 40px', () => assert.match(css, /\.flash-control \{ flex-basis: 40px; width: 40px; height: 40px; min-height: 40px; \}/));
test('Focus ring retained', () => assert.match(css, /:is\(\.flash-control, \.flash-open, \.flash-announcements\):focus-visible/));
test('Welcome mobile button accessible', () => assert.match(css, /\.welcome-message-pause \{ flex-basis: 44px; width: 44px; height: 44px;/));
console.log(`R73: ${passed} checks passed`);
