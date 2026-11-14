"use client";

import * as React from "react";

import { toast } from "sonner";

/**
 * "Update available — reload".
 *
 * The worker is configured to take over as soon as it installs, which means
 * the page can end up running last week's JavaScript against this week's
 * cache. `controllerchange` is the moment that happens, and the only honest
 * response is to offer a reload.
 *
 * The first controller a page ever gets is not an update — it is the worker
 * installing for the first time — so that one is ignored.
 */
export function ServiceWorkerUpdates() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // No controller yet means this page loaded before any worker claimed it;
    // the first claim is an install, not an update.
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const onChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }

      if (reloading) return;

      toast("A new version is ready", {
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            reloading = true;
            window.location.reload();
          },
        },
      });
    };

    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  return null;
}
