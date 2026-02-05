// Minimal service worker for PWA installability.
// Full offline caching will be added in a later phase.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
