"use client";

import { Repeat, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Only this record" or "the whole series?"
 *
 * Asked whenever an edited record came from a recurring rule, because the two
 * answers are both reasonable and guessing wrong is expensive: silently
 * changing the rule re-prices every month to come, and silently not changing
 * it means the user corrects the same amount again next month.
 *
 * A dialog on every size rather than a sheet — it is a question, and it has to
 * be answered before the save can go anywhere.
 */
export function EditScopeDialog({
  open,
  onOpenChange,
  pending = false,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onChoose: (applyToRule: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>This record repeats</DialogTitle>
          <DialogDescription>
            Choose what your changes should apply to. Records already created
            stay as they are either way.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            size="touch"
            className="w-full justify-start"
            disabled={pending}
            onClick={() => onChoose(false)}
          >
            <Receipt className="size-4" aria-hidden="true" />
            Only this record
          </Button>

          <Button
            variant="outline"
            size="touch"
            className="w-full justify-start"
            disabled={pending}
            onClick={() => onChoose(true)}
          >
            <Repeat className="size-4" aria-hidden="true" />
            This record and the rule
          </Button>

          <Button
            variant="ghost"
            size="touch"
            className="w-full"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>

        <p className="text-text-secondary text-xs">
          Updating the rule changes future occurrences only.
        </p>
      </DialogContent>
    </Dialog>
  );
}
