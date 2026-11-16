"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { startGoogleSignIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * "Continue with Google", under the email form.
 *
 * Rendered only by pages that have checked googleSignInEnabled on the
 * server, the same check startGoogleSignIn makes, so the button and the
 * action cannot disagree.
 */
export function GoogleSignIn({ next }: { next?: string }) {
  const [pending, startTransition] = React.useTransition();
  // Set once the browser is on its way to Google and never cleared: the
  // transition ends before the page does, and a second click would start
  // another flow whose PKCE cookie breaks the first's callback.
  const [redirecting, setRedirecting] = React.useState(false);
  const busy = pending || redirecting;

  return (
    // The card stacks nothing for its children, so the gap is set here.
    <div className="mt-5 space-y-4">
      <p className="text-text-secondary flex items-center gap-3 text-xs before:h-px before:flex-1 before:bg-hairline after:h-px after:flex-1 after:bg-hairline">
        or
      </p>
      <Button
        type="button"
        variant="outline"
        size="touch"
        className="w-full"
        disabled={busy}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await startGoogleSignIn({ next });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setRedirecting(true);
              window.location.assign(result.data.url);
            } catch (thrown) {
              console.error("[auth]", thrown);
              toast.error("Could not reach Google. Try again in a moment.");
            }
          })
        }
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        Continue with Google
      </Button>
    </div>
  );
}

/** The "G", in the text colour: the app's colours come from its tokens. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.7 12 2.7 6.9 2.7 2.78 6.83 2.78 12S6.9 21.3 12 21.3c5.32 0 8.85-3.74 8.85-9.01 0-.6-.07-1.06-.15-1.5Z"
      />
    </svg>
  );
}
