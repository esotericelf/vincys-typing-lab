/* Vincy's typing lab — lightweight offline cache */
const CACHE_VERSION = 'vincys-typing-lab-v8';

/** Small assets only — large dict JSON is runtime-cached (avoids install hang). */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/main.js',
  './js/game.js',
  './js/keyboard3d.js',
  './js/mobileUi.js',
  './js/dictLoader.js',
  './js/fallbackDict.js',
  './js/cangjieData.js',
  './js/decompose.js',
  './js/audio.js',
  './js/bgm.js',
  './js/themeManager.js',
  './js/pwa.js',
  './src/playlist.json',
  './src/assets/cangjie-baseline.json',
  './dict/practice_chars.json',
  './texts/sanzi.txt',
  './texts/news.txt',
  './texts/classical.txt',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache skip', url, err);
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  const sameOrigin = url.origin === self.location.origin;
  const isStatic =
    sameOrigin ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (!isStatic) return;

  // Network-first for large dictionary JSON so updates aren't stuck behind a bad cache
  const isDictJson =
    sameOrigin &&
    (url.pathname.endsWith('/cangjie.json') ||
      url.pathname.endsWith('/cangjie5.json') ||
      url.pathname.endsWith('/cangjie-baseline.json'));

  if (isDictJson) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          const cached = await cache.match(req);
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
            })
            .catch(() => {})
        );
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok && (sameOrigin || url.hostname.includes('jsdelivr') || url.hostname.includes('fonts'))) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        if (req.mode === 'navigate') {
          const fallback = await cache.match('./index.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    })
  );
});
