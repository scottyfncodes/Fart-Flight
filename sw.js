// Offline support for the Home Screen app. Network-first, so a deploy is
// picked up on the next launch; the cache only answers when offline.
const CACHE = "kurt-v2";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "fonts/luckiest-guy-latin.woff2",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "src/audio.js",
  "src/background.js",
  "src/collision.js",
  "src/config.js",
  "src/fx.js",
  "src/game.js",
  "src/hair.js",
  "src/input.js",
  "src/kurt.js",
  "src/main.js",
  "src/obstacles.js",
  "src/particles.js",
  "src/powerups.js",
  "src/progression.js",
  "src/scoring.js",
  "src/storage.js",
  "src/ui.js",
  "src/utils.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
