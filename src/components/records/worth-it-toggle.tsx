"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { setWorthIt } from "@/actions/transactions";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * "Worth it?" on a spend: two buttons, Worth it and Regret.
 *
 * One tap sets it, the same one again takes it off. It saves at once, with
 * nothing to confirm: it is a feeling, not a figure, and changing it is as
 * cheap as setting it. The choice shows straight away and goes back if the
 * save fails.
 */
export function WorthItToggle({
  recordId,
  value,
}: {
  recordId: string;
  /** true, false (a regret), or null, not said. */
  value: boolean | null;
}) {
  const router = useRouter();
  const [shown, setShown] = React.useState(value);
  const [, startTransition] = React.useTransition();

  // A different record, or the server's answer arriving.
  React.useEffect(() => setShown(value), [value, recordId]);

  function choose(next: boolean) {
    const target = shown === next ? null : next;
    const before = shown;
    setShown(target);

    startTransition(async () => {
      try {
        const result = await setWorthIt({ id: recordId, worthIt: target });
        if (!result.ok) {
          setShown(before);
          toast.error(result.error);
          return;
        }
        router.refresh();
      } catch (thrown) {
        console.error("[records]", thrown);
        setShown(before);
        toast.error("Could not save that. Check your connection.");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <Label id={`worth-${recordId}`}>Worth it?</Label>
      <div
        role="group"
        aria-labelledby={`worth-${recordId}`}
        className="grid grid-cols-2 gap-2"
      >
        <Choice
          pressed={shown === true}
          onClick={() => choose(true)}
          icon={<ThumbsUp className="size-4" aria-hidden="true" />}
          label="Worth it"
        />
        <Choice
          pressed={shown === false}
          onClick={() => choose(false)}
          icon={<ThumbsDown className="size-4" aria-hidden="true" />}
          label="Regret"
        />
      </div>
    </div>
  );
}

function Choice({
  pressed,
  onClick,
  icon,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-control pressable flex h-11 items-center justify-center gap-2 border text-sm font-semibold",
        // accent-sm is "this one is selected", as on a segmented control.
        pressed
          ? "bg-surface accent-sm text-text"
          : "bg-surface text-text-secondary hoverable:text-text",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
