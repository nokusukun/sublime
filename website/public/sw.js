const CACHE_NAME = "sublime-v2";

const APP_SHELL = [
  "/",
  "/docs/foundation",
  "/docs/anti-patterns",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  // HTML pages: network-first, cache fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(
                '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Sublime</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1c1917;color:#e7e5e4;text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#a8a29e;max-width:30ch}</style></head><body><div><h1>You are offline</h1><p>Reconnect to continue browsing Sublime docs.</p></div></body></html>',
                { headers: { "Content-Type": "text/html" } }
              )
          )
        )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    )
  );
});
