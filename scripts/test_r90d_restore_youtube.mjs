import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');
const file = source('src/features/kiosk/youtubeProfile.ts');
const transpiled = ts.transpileModule(file, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', transpiled)(module, module.exports);
const { parseYouTubeVideoId, makeYouTubeEmbedUrl } = module.exports;

const id = 'dQw4w9WgXcQ';
const valid = [
  `https://www.youtube.com/watch?v=${id}`,
  `https://youtu.be/${id}`,
  `https://youtube.com/embed/${id}`,
  `https://youtube.com/shorts/${id}`,
  `https://m.youtube.com/watch?v=${id}`,
  `https://youtube.com/live/${id}`,
];
for (const url of valid) assert.equal(parseYouTubeVideoId(url), id, `valid ${url}`);
for (const url of ['', 'https://youtube.com.evil.example/watch?v=' + id, 'javascript:alert(1)', 'http://youtu.be/' + id, 'https://www.youtube.com/watch?v=bad', 'https://www.youtube.com/playlist?list=PL123456789']) {
  assert.equal(parseYouTubeVideoId(url), null, `invalid ${url}`);
}
assert.equal(makeYouTubeEmbedUrl('not an id'), '');
assert.match(makeYouTubeEmbedUrl(id, true), /youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?/);
assert.match(makeYouTubeEmbedUrl(id, true), /autoplay=1/);
assert.match(makeYouTubeEmbedUrl(id), /autoplay=0/);

const kiosk = source('src/features/kiosk/PublicKioskDisplay.tsx');
const settings = source('src/features/settings/LobbyTvSettingsCard.tsx');
const types = source('src/types/lobbyTv.types.ts');
assert.match(kiosk, /SLIDE 0: GURU PIKET BERTUGAS/);
assert.match(kiosk, /activePanel === 'video_profile'/);
assert.match(kiosk, /videoPanelEnabled/);
assert.match(kiosk, /<ProfileVideoSlide/);
assert.match(kiosk, /getKioskFrames\(/);
assert.match(kiosk, /<Megaphone className="w-3\.5 h-3\.5"/);
assert.match(settings, /URL video YouTube/);
assert.match(settings, /parseYouTubeVideoId/);
assert.match(types, /profileVideoEnabled/);
assert.match(types, /profileVideoDurationSec/);
assert.match(types, /profileVideoAutoplay/);
for (const path of ['src/features/kiosk/PublicKioskDisplay.tsx', 'src/features/settings/LobbyTvSettingsCard.tsx', 'src/types/lobbyTv.types.ts', 'src/features/kiosk/youtubeProfile.ts']) {
  const code = source(path);
  const result = ts.transpileModule(code, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  });
  assert.equal(result.diagnostics?.length || 0, 0, `TS syntax ${path}`);
}
console.log('PASS: 6 URL valid, 6 URL ditolak, embed aman, sumber layout R90-B, video dan pengaturan, sintaks TS/TSX.');
