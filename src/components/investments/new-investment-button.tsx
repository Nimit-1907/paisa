"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import { InvestmentSheet } from "@/components/investments/investment-sheet";
import { Button } from "@/components/ui/button";
import type { InvestmentGoal } from "@/lib/investments";
import { cn } from "@/lib/utils";

/** "New investment", with its sheet, wherever a screen needs one. */
export function NewInvestmentButton({
  goals,
  today,
  goalId = null,
  className,
}: {
  goals: InvestmentGoal[];
  today: string;
  /** Start the new investment in this goal. */
  goalId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        size="touch"
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" aria-hidden="true" />
        New investment
      </Button>
      <InvestmentSheet
        open={open}
        onOpenChange={setOpen}
        investment={null}
        goals={goals}
        today={today}
        defaultGoalId={goalId}
      />
    </>
  );
}
