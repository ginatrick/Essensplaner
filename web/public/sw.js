// App-Shell-Cache fürs Offline-Öffnen. Keine Daten-Synchronisierung —
// die Einkaufsliste hält ihren eigenen Offline-Stand in localStorage
// (web/lib/plan/offlineCache.ts).
const CACHE = "mealplanner-shell-v1";
const SHELL_URLS = ["/plan", "/einkaufslisten", "/vorraete", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
