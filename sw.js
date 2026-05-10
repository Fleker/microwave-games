/**
 * Microwave Games — Service Worker
 * Strategy: cache-first for game assets, network-first for the registry.
 *
 * All cache keys are built from BASE (= self.registration.scope) so the SW
 * works correctly whether the site is served from / (localhost) or from a
 * subpath like /microwave-games/ (GitHub Pages).
 *
 * Bump CACHE_NAME when you deploy changes that require a cache bust.
 */

const CACHE_NAME = 'microwave-games-v3';

// self.registration.scope is the canonical base URL for this SW's scope,
// e.g. 'http://localhost:3000/' or 'https://user.github.io/microwave-games/'
const BASE = self.registration.scope;

const APP_SHELL = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}css/main.css`,
  `${BASE}js/app.js`,
  `${BASE}js/game-registry.js`,
  `${BASE}icons/icon.svg`,
  `${BASE}icons/icon-maskable.svg`,
  `${BASE}games/registry.json`,
];

// ── Install: pre-cache app shell + all registered game files ─────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache the app shell
      await cache.addAll(APP_SHELL);

      // Fetch the registry and cache every game file listed in cacheFiles
      try {
        const res = await fetch(`${BASE}games/registry.json`);
        const { games } = await res.json();
        const gameFiles = games.flatMap(g =>
          (g.cacheFiles || [g.path]).map(f =>
            f.startsWith('http') ? f : `${BASE}${f.replace(/^\//, '')}`
          )
        );
        if (gameFiles.length) await cache.addAll(gameFiles);
      } catch (err) {
        console.warn('[SW] Could not pre-cache game files:', err);
      }
    })
  );
  self.skipWaiting();
});

// ── Activate: remove stale caches ────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for the registry so newly added games appear quickly
  if (url.pathname.endsWith('registry.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for everything else (app shell, game assets)
  event.respondWith(cacheFirst(request));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    // Use request.url (plain GET) instead of the full Request object so that
    // navigate-mode requests don't cause fetch to fail in SW context.
    const response = await fetch(request.url);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Offline fallback: only serve the app shell for the scope root.
    // Game iframe navigations get a 503 so they don't silently load
    // the wrong page.
    if (request.mode === 'navigate') {
      const url = new URL(request.url);
      const scopePath = new URL(BASE).pathname;
      if (url.pathname === scopePath || url.pathname === `${scopePath}index.html`) {
        return caches.match(`${BASE}index.html`);
      }
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request.url);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
