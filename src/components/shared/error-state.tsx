"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Something did not load.
 *
 * Deliberately the same shape as {@link EmptyState} — icon, one sentence, one
 * button — because from where the user sits these are the same situation:
 * the screen is not showing what they came for, and there is exactly one
 * thing to try. What it must never do is blame them or show a stack trace;
 * what it must always do is offer the retry, since the usual cause is a
 * train going into a tunnel.
 *
 * The message is ours, not the server's. A Postgres error string is both
 * frightening and useless to read, and occasionally says more about the
 * schema than it should.
 */
export function ErrorState({
  title = "That did not load",
  description = "Something went wrong at our end. Your records are safe.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  /** Omitted on a server-rendered error, where the retry is a reload. */
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-border/70 bg-card rounded-card flex flex-col items-center border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="bg-destructive/10 text-destructive rounded-card mb-4 flex size-12 items-center justify-center">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-ink-2 mx-auto mt-1 max-w-[42ch] text-sm">
        {description}
      </p>
      <Button
        variant="outline"
        className="mt-5"
        onClick={onRetry ?? (() => window.location.reload())}
      >
        <RotateCcw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
