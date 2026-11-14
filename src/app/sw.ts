import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker (built to /public/sw.js by @serwist/next, dev-disabled).
 *
 * The app shell and static assets are precached so Paisa opens instantly from
 * the home screen. Records are not cached: they are per-user data behind
 * cookies, and a stale balance shown with no indication that it is stale is
 * worse than an honest "you are offline".
 *
 * That is also why the only offline affordance is the fallback page. Every
 * write in this app goes through a Server Action, so an offline queue would
 * mean reimplementing the whole write path against a local store — a real
 * feature, not a polish item.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // The new worker takes over at once rather than waiting for every tab to
  // close. The page notices and offers a reload, which is the only way the
  // user gets JS that matches the worker serving it.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
