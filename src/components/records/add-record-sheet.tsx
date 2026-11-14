"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { DEFAULT_CURRENCY_SYMBOL, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const RECORD_TYPES = [
  { value: "expense", label: "Expense", className: "data-[active=true]:bg-expense-soft data-[active=true]:text-expense" },
  { value: "income", label: "Income", className: "data-[active=true]:bg-income-soft data-[active=true]:text-income" },
  { value: "transfer", label: "Transfer", className: "data-[active=true]:bg-transfer-soft data-[active=true]:text-transfer" },
] as const;

type RecordType = (typeof RECORD_TYPES)[number]["value"];

type AddRecordSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Add Record sheet: a vaul bottom sheet on phones, a centred dialog from `lg`
 * up (CLAUDE.md). Phase 2 fills it with the real react-hook-form + zod form
 * and a Server Action; Phase 1 wires up the shell and the type selector.
 */
export function AddRecordSheet({ open, onOpenChange }: AddRecordSheetProps) {
  const isDesktop = useIsDesktop();
  const [type, setType] = React.useState<RecordType>("expense");

  const body = (
    <div className="space-y-5 px-4 pb-6 lg:px-0">
      <div
        role="radiogroup"
        aria-label="Record type"
        className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1"
      >
        {RECORD_TYPES.map((option) => {
          const active = type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              data-active={active}
              onClick={() => setType(option.value)}
              className={cn(
                "focus-visible:ring-ring h-11 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                "text-muted-foreground data-[active=true]:bg-background data-[active=true]:shadow-sm",
                option.className,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border p-4 text-center">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Amount
        </p>
        <p className="amount mt-1 text-3xl font-semibold">
          {formatMoney(0n, { symbol: DEFAULT_CURRENCY_SYMBOL })}
        </p>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        The amount keypad, category and account pickers arrive in Phase 2.
      </p>

      <div className="pb-safe flex gap-2">
        <Button
          variant="outline"
          size="touch"
          className="flex-1"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button size="touch" className="flex-1" disabled>
          Save
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add record</DialogTitle>
            <DialogDescription>
              Log an expense, income or transfer between accounts.
            </DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Add record</DrawerTitle>
          <DrawerDescription>
            Log an expense, income or transfer between accounts.
          </DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
}
