"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createGoal, deleteGoal, updateGoal } from "@/actions/investments";
import { useCurrency } from "@/components/profile-provider";
import { AmountInput } from "@/components/shared/amount-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { TintPicker } from "@/components/shared/tint-picker";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { minorToAmountText } from "@/lib/amount";
import type { InvestmentGoal } from "@/lib/investments";
import { type TintKey, TINT_KEYS } from "@/lib/tokens";

/** A new goal takes the next tint along, so two goals rarely share one. */
const GOAL_TINTS: TintKey[] = [
  "peri",
  "sand",
  "mint",
  "butter",
  "sky",
  "lilac",
  "peach",
  "teal",
];

/**
 * A goal: what the money is for. The target is optional; with one, the
 * goal shows how far along it is, without one, its share of the whole.
 */
export function GoalSheet({
  open,
  onOpenChange,
  goal,
  goalCount,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null makes a new one. */
  goal: InvestmentGoal | null;
  goalCount: number;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const currency = useCurrency();

  const [name, setName] = React.useState("");
  const [tint, setTint] = React.useState<TintKey>("peri");
  const [target, setTarget] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [field, setField] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const goalId = goal?.id ?? null;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setField(null);
    setName(goal?.name ?? "");
    setTint(
      goal?.tint ?? GOAL_TINTS[goalCount % GOAL_TINTS.length] ?? TINT_KEYS[0],
    );
    setTarget(
      goal?.targetAmount
        ? minorToAmountText(BigInt(goal.targetAmount), currency.decimals)
        : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goalId]);

  async function save() {
    setSaving(true);
    setError(null);
    setField(null);

    try {
      const values = { name, tint, target: target.trim() || null };
      const result = goal
        ? await updateGoal({ id: goal.id, ...values })
        : await createGoal(values);

      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      toast.success(goal ? "Goal saved." : `Goal ${name.trim()} added.`);
      if (!goal && result.data && "id" in result.data) {
        onCreated?.(result.data.id);
      }
      onOpenChange(false);
      router.refresh();
    } catch (thrown) {
      console.error("[investments]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!goal) return;
    setSaving(true);
    try {
      const result = await deleteGoal({ id: goal.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Goal ${goal.name} deleted. Its investments are under No goal.`,
      );
      setConfirmDelete(false);
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={goal ? "Edit goal" : "New goal"}
        description="Group investments by what they are for."
      >
        <SheetBody>
          <FormRow
            id="goal-name"
            label="Name"
            required
            error={field === "name" ? (error ?? undefined) : undefined}
          >
            {(props) => (
              <Input
                {...props}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Retirement"
                maxLength={60}
              />
            )}
          </FormRow>

          <TintPicker value={tint} onChange={setTint} />

          <FormRow
            id="goal-target"
            label="Target"
            hint="With a target, the goal shows how far along it is."
            error={field === "target" ? (error ?? undefined) : undefined}
          >
            {(props) => (
              <AmountInput
                {...props}
                value={target}
                onChange={setTarget}
                placeholder="1000000"
              />
            )}
          </FormRow>

          {goal ? (
            <Button
              variant="outline"
              size="touch"
              className="text-expense"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete goal
            </Button>
          ) : null}

          {error && !field ? (
            <p role="alert" className="text-expense text-sm">
              {error}
            </p>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="touch"
            className="flex-1"
            onClick={() => void save()}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {goal ? "Save" : "Add goal"}
          </Button>
        </SheetFooter>
      </ResponsiveSheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${goal?.name ?? "this goal"}?`}
        description="Its investments and their entries stay, under No goal."
        pending={saving}
        onConfirm={() => void remove()}
      />
    </>
  );
}
