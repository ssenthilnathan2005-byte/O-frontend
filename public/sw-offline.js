const CACHE = "db-offline-v1";
const TOKEN_API_RE = /\/api\/tokens\/[^/]+$/;

// Cache app shell on install
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// Network-first for token API, cache fallback
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (TOKEN_API_RE.test(url.pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // For everything else: network only (don't cache large assets)
});
