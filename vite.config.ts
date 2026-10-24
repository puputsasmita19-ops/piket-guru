import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFile, writeFile, rm } from 'node:fs/promises';
import {defineConfig} from 'vite';

/** Each production build stamps a new cache version into the service worker.
 *  The public/sw.js file remains a template for Vite's public-dir copy.
 */
function stampServiceWorker() {
  return {
    name: 'piket-guru-sw-build-revision',
    apply: 'build' as const,
    async closeBundle() {
      const source = await readFile(path.resolve(__dirname, 'public/sw.js'), 'utf8');
      const placeholder = '__PIKET_BUILD_REV__';
      if (!source.includes(placeholder)) throw new Error('SW revision placeholder is missing');
      const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
      const revision = `${commit ? commit.slice(0, 16) : 'local'}-${Date.now().toString(36)}`;
      await writeFile(path.resolve(__dirname, 'dist/sw.js'), source.replaceAll(placeholder, revision), 'utf8');
    },
  };
}

/** R68: prevent files in public/artifacts from being deployed as unauthenticated assets.
 * Private archives belong outside the public folder and Git history.
 */
function excludePrivateArtifacts() {
  return {
    name: 'piket-guru-private-artifacts-guard',
    apply: 'build' as const,
    async closeBundle() {
      await rm(path.resolve(__dirname, 'dist/artifacts'), { recursive: true, force: true });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), stampServiceWorker(), excludePrivateArtifacts()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Keep the small, verified login dependency graph together. Operational
          // pages stay dynamic, while mobile avoids a chain of tiny JS requests.
          codeSplitting: { groups: [{ name: 'login-core', tags: ['$initial' as const] }] },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
