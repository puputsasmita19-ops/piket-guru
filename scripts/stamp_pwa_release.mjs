/**
 * Stamp a distinct PWA cache version into the build output after `vite build`.
 * The source public/sw.js stays unchanged; commits remain clean in GitHub Desktop.
 * On Vercel, every deployment has its own URL/ID. Offline/local builds use time.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(process.env.PIKET_GURU_DIST_DIR || join(projectDir, 'dist'));
const swFile = join(distDir, 'sw.js');
const stampSource = process.env.VERCEL_DEPLOYMENT_ID
  || process.env.VERCEL_URL
  || process.env.VERCEL_GIT_COMMIT_SHA
  || `local-build-${Date.now()}`;
const releaseId = `build-${createHash('sha256').update(stampSource).digest('hex').slice(0, 16)}`;

const sw = await readFile(swFile, 'utf8');
const versionMarker = /const CACHE_VERSION = '[^']+';/;
if (!versionMarker.test(sw)) {
  throw new Error('Service Worker CACHE_VERSION marker not found; refusing an unstamped deploy.');
}
await writeFile(swFile, sw.replace(versionMarker, `const CACHE_VERSION = '${releaseId}';`));
await writeFile(join(distDir, 'app-version.json'), JSON.stringify({ version: releaseId }, null, 2) + '\n');
console.log(`[PWA] Deployment Service Worker stamp: ${releaseId}`);
