"use client";

import * as React from "react";

import { toast } from "sonner";

/**
 * Surfaces the `?error=` the auth callback redirects with, an expired or
 * already-used confirmation link, usually, instead of dropping the user on a
 * login page with no explanation.
 */
export function AuthErrorToast({ message }: { message?: string }) {
  const shown = React.useRef(false);

  React.useEffect(() => {
    if (!message || shown.current) return;
    shown.current = true;
    toast.error(message);
  }, [message]);

  return null;
}
