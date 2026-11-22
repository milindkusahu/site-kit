const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE = "/offline/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(PAGES).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() => caches.match(request).then((hit) => hit ?? caches.match(OFFLINE)));
}

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ??
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(ASSETS).then((cache) => cache.put(request, copy));
        return response;
      }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/\.(?:js|css|woff2?|png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname)) event.respondWith(cacheFirst(request));
});
