"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteBudget, setBudget } from "@/actions/budgets";
import { useCurrency } from "@/components/profile-provider";
import { CategoryGrid } from "@/components/shared/entry-pickers";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWith, friendlyAmount, fromMinor } from "@/lib/money";
import { PRESSABLE } from "@/lib/motion";
import type { BudgetHint } from "@/lib/queries/budgets";
import { cn } from "@/lib/utils";
import { APPLY_FORWARD_MONTHS } from "@/lib/schemas/budgets";

export type BudgetCategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type BudgetDraft = {
  categoryId: string;
  /** Minor units as text; empty when there is no budget yet. */
  amount: string;
};

/**
 * Set or change one category's budget for the month on screen.
 *
 * The category grid is the same one the record sheet uses, filtered to
 * expenses — a budget on "Salary" is not a thing anyone means, and the
 * database refuses it anyway.
 */
export function BudgetSheet({
  open,
  onOpenChange,
  month,
  monthLabel,
  categories,
  draft,
  hints,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `yyyy-mm`. */
  month: string;
  /** "November 2026", for the copy. */
  monthLabel: string;
  categories: BudgetCategoryOption[];
  /** Null when adding from scratch. */
  draft: BudgetDraft | null;
  /** What each category has actually cost, for the suggestions. */
  hints: BudgetHint[];
}) {
  const router = useRouter();
  const currency = useCurrency();

  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [applyForward, setApplyForward] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  /*
   * Two numbers worth offering: what this category cost last month, and what
   * it has averaged over three. Rounded to something somebody would choose,
   * de-duplicated when they round to the same figure, and absent entirely
   * for a category with no history — a suggestion of ₹500 based on nothing
   * is worse than no suggestion.
   */
  const hint = hints.find((entry) => entry.categoryId === categoryId);

  const suggestions = React.useMemo(() => {
    if (!hint) return [];

    const options = [
      { label: "last month", minor: friendlyAmount(BigInt(hint.lastMonth), currency.decimals) },
      {
        label: "3-month average",
        minor: friendlyAmount(
          BigInt(hint.threeMonthAverage),
          currency.decimals,
        ),
      },
    ].filter((option) => option.minor > 0n);

    return options.filter(
      (option, index) =>
        options.findIndex((other) => other.minor === option.minor) === index,
    );
  }, [hint, currency.decimals]);

  const draftKey = draft ? `${draft.categoryId}:${draft.amount}` : null;
  const editing = Boolean(draft?.amount);

  React.useEffect(() => {
    if (!open) return;

    setCategoryId(draft?.categoryId ?? "");
    setAmount(
      draft?.amount
        ? fromMinor(BigInt(draft.amount), currency.decimals)
        : "",
    );
    setApplyForward(false);
    setError(null);
    setErrorField(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);

  async function save() {
    setSaving(true);
    setError(null);
    setErrorField(null);

    try {
      const result = await setBudget({
        categoryId,
        month,
        amount,
        applyForward,
      });

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.monthsWritten > 1
          ? `Budget set for ${result.data.monthsWritten} months`
          : "Budget set",
      );
      onOpenChange(false);
      router.refresh();
    } catch (thrown) {
      // Without this the sheet would sit on "Saving…" for ever.
      console.error("[budgets]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);

    try {
      const result = await deleteBudget({ categoryId, month });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Budget removed");
      onOpenChange(false);
      router.refresh();
    } catch (thrown) {
      console.error("[budgets]", thrown);
      toast.error("Could not remove that. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = categoryId !== "" && amount.trim() !== "";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit budget" : "Set a budget"}
      description={`A monthly limit for ${monthLabel}.`}
    >
      <SheetBody>
        {draft ? null : (
          <CategoryGrid
            categories={categories.map((category) => ({
              ...category,
              kind: "expense" as const,
            }))}
            value={categoryId}
            onChange={setCategoryId}
            error={
              errorField === "categoryId" ? (error ?? undefined) : undefined
            }
          />
        )}

        {suggestions.length > 0 ? (
          <div className="space-y-1.5">
            <Label id="budget-suggestions">Suggested</Label>
            <div
              role="group"
              aria-labelledby="budget-suggestions"
              className="flex flex-wrap gap-1.5"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() =>
                    setAmount(
                      fromMinor(suggestion.minor, currency.decimals),
                    )
                  }
                  className={cn(
                    PRESSABLE,
                    "hoverable:bg-muted/60 focus-visible:ring-ring flex h-11 items-center gap-2 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  )}
                >
                  <span className="amount font-semibold">
                    {formatWith(currency, suggestion.minor, {
                      signDisplay: "never",
                      whole: true,
                    })}
                  </span>
                  <span className="text-ink-2 text-xs">
                    {suggestion.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <FormRow
          id="budget-amount"
          label={`Monthly limit (${currency.symbol})`}
          error={errorField === "amount" ? (error ?? undefined) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="10000"
              className="amount text-lg"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the sheet has just been opened; this is the field it was opened for.
              autoFocus
            />
          )}
        </FormRow>

        <label className="hoverable:bg-muted/60 flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors">
          <input
            type="checkbox"
            checked={applyForward}
            onChange={(event) => setApplyForward(event.target.checked)}
            className="accent-primary mt-0.5 size-5 shrink-0"
          />
          <span className="min-w-0">
            <span className="text-sm font-semibold">Apply to all future months</span>
            <span className="text-ink-2 mt-0.5 block text-xs">
              Copies this limit into the next {APPLY_FORWARD_MONTHS} months,
              stopping at any month you have already set to something else.
            </span>
          </span>
        </label>

        {error && !errorField ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        {editing ? (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="touch"
              className="text-destructive hoverable:text-destructive w-full"
              disabled={saving}
              onClick={() => void remove()}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove this budget
            </Button>
          </div>
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
          disabled={saving || !canSave}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Save budget
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}
