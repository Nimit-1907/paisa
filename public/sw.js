/*
 * Paisa is online only. Earlier versions installed a caching service worker
 * at this path; browsers that still have it check this file for updates,
 * pick up this one, and it removes itself: every cache is deleted, the
 * worker unregisters, and open tabs reload from the network.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
