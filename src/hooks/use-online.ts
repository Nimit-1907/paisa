"use client";

import * as React from "react";

/**
 * Whether the browser thinks it can reach the network.
 *
 * Starts `true` on purpose, and not only because `navigator` does not exist
 * on the server: an "Offline" pill that flashes up on every first paint and
 * then disappears would teach people to distrust it. The events correct it
 * within a frame of the effect running.
 *
 * `navigator.onLine` is a floor, not a promise — it is false when there is
 * definitely no connection, and true when there might be one. That is the
 * right way round for this: the pill only ever appears when the browser is
 * certain, so it is never wrong when it is shown.
 */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
