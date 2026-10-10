/**
 * Piket Guru Service Worker v1.3.0 - Offline Resilience, Asset Cache & Controlled Updates
 *
 * Key guarantees:
 * 1. Cache assets only from same-origin GET requests; never HTML fallback for scripts, CSS, or APIs.
 * 2. Strictly bypass Firebase Auth, Firestore, Google APIs, and backend /api/* routes.
 * 3. Controlled updates: waits for user confirmation before activating new versions (no auto-reload mid-task).
 * 4. Automatic cleanup of previous build asset caches on activate without touching user drafts or sync queue.
 */

const CACHE_VERSION = 'v1.3.0';
const STATIC_CACHE_NAME = `piketguru-shell-${CACHE_VERSION}`;
const ASSET_CACHE_NAME = `piketguru-assets-${CACHE_VERSION}`;

const PRECACHE_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  // Pre-cache vital shell assets
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_SHELL);
    }).then(() => {
      // Do NOT self.skipWaiting() automatically to avoid interrupting active user inputs!
      // Wait for SKIP_WAITING message dispatched when user explicitly confirms update.
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Only purge piketguru caches that do not match current version
          if (
            (key.startsWith('piketguru-') || key.startsWith('piket-guru-')) &&
            key !== STATIC_CACHE_NAME &&
            key !== ASSET_CACHE_NAME
          ) {
            console.log('[SW] Purging outdated cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Controlled Skip Waiting on explicit message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] User approved update: activating new service worker...');
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. STRICT NETWORK-ONLY: Never cache or serve HTML fallbacks for API, Firebase, Auth, Tokens
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    (url.hostname.includes('googleapis.com') && !url.hostname.includes('fonts.googleapis.com')) ||
    url.hostname.includes('chrome-extension')
  ) {
    return;
  }

  // 2. Google Fonts (Stale-While-Revalidate)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
      })
    );
    return;
  }

  // 3. Navigation requests: Network-First with Cache Fallback to index.html (SPA routing support)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedShell = await caches.match('/index.html');
          if (cachedShell) return cachedShell;
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;

          // If no cached shell at all, return informative offline message (never empty white screen)
          return new Response(
            `<!DOCTYPE html>
            <html lang="id">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Piket Guru - Mode Luring</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; padding: 24px; text-align: center; }
                .box { max-width: 420px; background: #1e293b; padding: 32px; border-radius: 24px; border: 1px solid #334155; }
                h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: #f1f5f9; }
                p { font-size: 0.875rem; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
                button { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; }
              </style>
            </head>
            <body>
              <div class="box">
                <h1>Aplikasi Perlu Dibuka Online Pertama Kali</h1>
                <p>Browser Anda belum menyimpan salinan berkas Piket Guru di perangkat ini. Harap sambungkan ke internet dan muat ulang halaman ini sekali agar aplikasi dapat dibuka saat offline.</p>
                <button onclick="window.location.reload()">Muat Ulang Halaman</button>
              </div>
            </body>
            </html>`,
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // 4. Same-origin Static Assets (Vite bundled JS, CSS, icons, images)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate for assets
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(ASSET_CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Cache miss: fetch from network and store in asset cache
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(ASSET_CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((err) => {
            // Strictly do NOT return HTML fallback for scripts/css, throw error to avoid syntax parse errors
            throw err;
          });
      })
    );
  }
});
