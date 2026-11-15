"use client";

import * as React from "react";

import { Loader2, LogOut } from "lucide-react";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Sign out, in expense text on a plain surface.
 *
 * The `destructive` variant rather than the colour of the thing it is:
 * signing out loses nothing, but it is the one row in the Account group
 * that ends the session, and the brief asks for it to read that way.
 */
export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      size="touch"
      className={className}
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      Sign out
    </Button>
  );
}
