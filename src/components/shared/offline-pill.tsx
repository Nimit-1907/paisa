"use client";

import { CloudOff } from "lucide-react";

import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";

/**
 * A small, honest note that what you are reading came from the cache.
 *
 * The service worker keeps the last version of every screen, so going into a
 * tunnel does not empty the app — which is good, and also the problem: a
 * month that looks complete but is missing this morning's lunch is worse
 * than a blank page, because nothing tells you to doubt it. The pill is that
 * something.
 *
 * It renders nothing at all when online, so there is no reserved space to
 * shift the layout when it appears (Phase 11: CLS stays at 0).
 */
export function OfflinePill({ className }: { className?: string }) {
  const online = useOnline();

  if (online) return null;

  return (
    <span
      // Polite, not assertive: this is a status, and interrupting what
      // somebody is reading to tell them the wifi dropped is not urgent.
      role="status"
      className={cn(
        "bg-warning-soft text-warning rounded-full px-2 py-0.5 text-label inline-flex shrink-0 items-center gap-1 font-semibold",
        className,
      )}
    >
      <CloudOff className="size-3" aria-hidden="true" />
      Offline
    </span>
  );
}

/**
 * The sentence that goes with a disabled write.
 *
 * Offline, saving is turned off rather than queued. Queuing would mean a
 * record that exists on this phone and nowhere else, and two of them if the
 * user gives up and retypes it on a laptop — the honest version is to say
 * what is not possible and why.
 */
export function OfflineNotice({ className }: { className?: string }) {
  const online = useOnline();

  if (online) return null;

  return (
    <p
      role="status"
      className={cn(
        "bg-warning-soft text-warning rounded-control flex items-start gap-2 px-3 py-2 text-xs font-medium",
        className,
      )}
    >
      <CloudOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      You are offline, so this cannot be saved yet. Your connection will come
      back and the button will work again.
    </p>
  );
}
