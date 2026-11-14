"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

/**
 * Tells the user what the catch-up just created.
 *
 * It also refreshes, because the layout and the page render in parallel: the
 * records query can finish before the generator has inserted anything, so
 * without this the new rows would only appear on the next navigation.
 *
 * Refreshing cannot loop — the second render finds today already stamped, so
 * `created` comes back 0 and this does nothing.
 */
export function RecurringCreatedToast({ created }: { created: number }) {
  const router = useRouter();
  const handled = React.useRef(false);

  React.useEffect(() => {
    if (created <= 0 || handled.current) return;
    handled.current = true;

    toast.success(
      created === 1
        ? "1 recurring record added"
        : `${created} recurring records added`,
      { id: "recurring-created" },
    );

    router.refresh();
  }, [created, router]);

  return null;
}
