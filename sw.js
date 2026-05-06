/**
 * Microwave Games — Service Worker
 * Strategy: cache-first for game assets, network-first for the registry.
 * Bump CACHE_NAME when you deploy changes that require a cache bust.
 */

const CACHE_NAME = 'microwave-games-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/js/app.js',
  '/js/game-registry.js',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/games/registry.json',
];

// ── Install: pre-cache app shell + all registered game files ─────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache the app shell
      await cache.addAll(APP_SHELL);

      // Fetch the registry and cache every game file listed in cacheFiles
      try {
        const res = await fetch('/games/registry.json');
        const { games } = await res.json();
        const gameFiles = games.flatMap(g =>
          (g.cacheFiles || [g.path]).map(f => (f.startsWith('/') ? f : '/' + f))
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
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Offline and not cached — return a minimal offline page for navigation
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
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
