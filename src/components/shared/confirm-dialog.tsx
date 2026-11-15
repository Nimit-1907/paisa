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

/**
 * Confirmation for something that cannot be undone.
 *
 * A dialog on every size, not a bottom sheet: a destructive question should
 * not look like the sheets people dismiss by swiping all day.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "destructive",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Red only for what removes something. Archiving hides an account and can
   * be reversed; a red button would claim otherwise.
   */
  tone?: "destructive" | "default";
  pending?: boolean;
  /**
   * Omit to show an explanation with a single button: "you cannot do that,
   * and here is why". Better than a disabled menu item, which says no and
   * says nothing else.
   */
  onConfirm?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          {onConfirm ? (
            <Button
              variant={tone === "destructive" ? "destructive" : "default"}
              size="touch"
              className="flex-1"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
