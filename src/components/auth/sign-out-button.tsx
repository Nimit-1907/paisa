"use client";

import * as React from "react";

import { Loader2, LogOut } from "lucide-react";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
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
