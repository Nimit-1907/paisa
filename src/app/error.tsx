"use client";

import * as React from "react";

import Link from "next/link";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/routes";

/**
 * The error boundary for every route under it.
 *
 * Two things it will not do. It will not show `error.message`: a Postgres or
 * PostgREST message names tables, columns and constraints, which is
 * frightening to read and occasionally says more about the schema than a
 * stranger should learn from a crash. And it will not blame the person,
 * whatever happened, they pressed a button.
 *
 * Two ways out, because `reset()` only helps when the failure was transient.
 * If the route is broken every time, retrying forever is a trap, so Records
 * is there as well.
 *
 * The digest is shown, small and last. It is the one string that connects
 * what somebody saw to what the server logged, and it identifies the error,
 * not the user.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // The browser console is this app's error-reporting path; see the notes
    // on the queries. Logged on mount so a failure that only happens for one
    // person is still recoverable from their devtools.
    console.error("[route]", error);
  }, [error]);

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4 text-center">
      <span className="bg-tint-rose text-expense rounded-card mb-5 flex size-14 items-center justify-center">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>

      <h1 className="font-display text-3xl tracking-[-0.02em]">
        That did not load.
      </h1>

      <p className="text-text-secondary mt-2 text-sm text-pretty">
        Something went wrong at our end. Nothing you have saved is affected.
        Your records are on the server, not on this screen.
      </p>

      <div className="mt-7 flex w-full flex-col gap-2">
        <Button size="touch" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>

        <Button variant="outline" size="touch" asChild>
          <Link href={HOME_PATH}>Back to your records</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-text-secondary mt-6 font-mono text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
