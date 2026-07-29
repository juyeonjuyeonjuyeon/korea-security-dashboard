const CACHE = "security-board-v20";
const ASSETS = ["./", "./index.html", "./tech.html", "./styles.css", "./app.js", "./tech.js", "./manifest.webmanifest", "./config/risk-weights.json", "./config/sources.json", "./icon-32.png", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./data/dashboard.json", "./data/tech.json", "./data/history/index.json"];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener("activate", event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => clients.claim())
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});
