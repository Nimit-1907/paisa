"use client";

import * as React from "react";

/**
 * Paisa works online only, so no service worker should control the page.
 *
 * Phones that installed an earlier version still carry the old caching
 * worker. `public/sw.js` replaces it with one that removes itself; this does
 * the same from the page, so whichever runs first wins and nothing stale is
 * ever served again.
 */
export function RemoveServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => void registration.unregister());
    });

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        keys.forEach((key) => void caches.delete(key));
      });
    }
  }, []);

  return null;
}
