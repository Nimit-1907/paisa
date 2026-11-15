"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Deleting a rule, and deciding what happens to what it already created.
 *
 * Keeping the records is the default and the safe answer: they are months of
 * real spending, and the rule is only the thing that made them. Deleting them
 * too is offered because a rule created by mistake leaves a trail of records
 * nobody wants to tidy by hand — but it is a deliberate second choice, and
 * the count is spelled out before the button is pressed.
 */
export function DeleteRuleDialog({
  open,
  onOpenChange,
  name,
  recordCount,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** How many records this rule has created so far. */
  recordCount: number;
  pending?: boolean;
  onConfirm: (deleteTransactions: boolean) => void;
}) {
  const [withRecords, setWithRecords] = React.useState(false);

  React.useEffect(() => {
    if (open) setWithRecords(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>
            The schedule stops. Choose what happens to the{" "}
            {recordCount === 1 ? "record" : "records"} it has already created.
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="What to do with past records"
          className="space-y-2"
        >
          <Choice
            active={!withRecords}
            onClick={() => setWithRecords(false)}
            title="Keep past records"
            description={
              recordCount === 0
                ? "Nothing has been created yet."
                : `${recordCount} ${
                    recordCount === 1 ? "record stays" : "records stay"
                  } in your history.`
            }
          />

          <Choice
            active={withRecords}
            onClick={() => setWithRecords(true)}
            title="Delete past records too"
            description={
              recordCount === 0
                ? "Nothing to remove."
                : `${recordCount} ${
                    recordCount === 1 ? "record" : "records"
                  } will be removed and balances will change.`
            }
            destructive
          />
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="touch"
            className="flex-1"
            onClick={() => onConfirm(withRecords)}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  active,
  onClick,
  title,
  description,
  destructive = false,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring w-full rounded-control border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? destructive
            ? "border-destructive bg-destructive/5"
            : "border-primary bg-primary/5"
          : "hoverable:bg-muted/60",
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="text-ink-2 block text-xs">{description}</span>
    </button>
  );
}
