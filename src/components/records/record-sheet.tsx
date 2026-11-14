"use client";

import * as React from "react";

import { Check, Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { SavedTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/lib/action-result";
import { useCurrency } from "@/components/profile-provider";
import { AmountKeypad } from "@/components/records/amount-keypad";
import {
  type AccountOption,
  AccountSelect,
  type CategoryOption,
  CategoryGrid,
  TypeTabs,
} from "@/components/shared/entry-pickers";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type RecurrenceFrequency,
  RECURRENCE_FREQUENCIES,
  REPEAT_LABELS,
  type TransactionType,
} from "@/lib/schemas/transactions";
import { cn } from "@/lib/utils";

export type { AccountOption, CategoryOption };

/** What the sheet is editing, if anything. */
export type RecordDraft = {
  id: string;
  type: TransactionType;
  /** Minor units as text. */
  amount: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string | null;
  /** Local `yyyy-mm-ddThh:mm`. */
  occurredAtLocal: string;
};

export type RecordSubmit = (
  values: {
    type: TransactionType;
    amount: string;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    note: string | null;
    occurredAt: string;
    repeat: {
      frequency: RecurrenceFrequency;
      interval: number;
      endDate: string | null;
    } | null;
  },
  context: { editingId: string | null },
) => Promise<ActionResult<SavedTransaction>>;

/**
 * Add or edit a record.
 *
 * One sheet for both, and for all three types: the fields that differ are a
 * category grid versus a second account, and splitting that into three
 * components would mean three places to keep the keypad and the repeat row in
 * step.
 */
export function RecordSheet({
  open,
  onOpenChange,
  accounts,
  categories,
  draft,
  defaultAmountText = "",
  onSubmit,
  onDelete,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  /** Omitted when adding. */
  draft?: RecordDraft | null;
  defaultAmountText?: string;
  onSubmit: RecordSubmit;
  /** Only offered while editing. Undo lives in the toast it raises. */
  onDelete?: (id: string) => void | Promise<void>;
  timeZone: string;
}) {
  const currency = useCurrency();
  const editing = draft ?? null;

  const [type, setType] = React.useState<TransactionType>("expense");
  const [amount, setAmount] = React.useState(defaultAmountText);
  const [accountId, setAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [occurredAt, setOccurredAt] = React.useState("");
  const [frequency, setFrequency] = React.useState<RecurrenceFrequency | "none">(
    "none",
  );
  const [interval, setInterval] = React.useState("1");
  const [endDate, setEndDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  const editingId = editing?.id ?? null;

  // Reset when the sheet opens, or when it is pointed at a different record.
  // Keyed on the id rather than the object, so a refresh underneath does not
  // wipe what is being typed.
  React.useEffect(() => {
    if (!open) return;

    setType(editing?.type ?? "expense");
    setAmount(
      editing ? minorToText(editing.amount, currency.decimals) : defaultAmountText,
    );
    setAccountId(editing?.accountId ?? accounts[0]?.id ?? "");
    setToAccountId(editing?.toAccountId ?? "");
    setCategoryId(editing?.categoryId ?? "");
    setNote(editing?.note ?? "");
    setOccurredAt(editing?.occurredAtLocal ?? nowLocal(timeZone));
    setFrequency("none");
    setInterval("1");
    setEndDate("");
    setError(null);
    setErrorField(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId]);

  const visibleCategories = categories.filter(
    (category) => category.kind === (type === "income" ? "income" : "expense"),
  );

  async function save(andAnother: boolean) {
    setSaving(true);
    setError(null);
    setErrorField(null);

    try {
      const result = await onSubmit(
        {
          type,
          amount,
          accountId,
          toAccountId: type === "transfer" ? (toAccountId || null) : null,
          categoryId: type === "transfer" ? null : (categoryId || null),
          note: note.trim() ? note.trim() : null,
          occurredAt,
          repeat:
            frequency === "none"
              ? null
              : {
                  frequency,
                  interval: Number(interval) || 1,
                  endDate: endDate || null,
                },
        },
        { editingId },
      );

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      if (result.data.repeatSaved === false) {
        toast.warning(
          "Saved, but the repeat could not be set up. Try adding it again.",
        );
      }

      if (andAnother) {
        // Keep the type, account and date; clear what is specific to the
        // record just saved, so a run of receipts is a few taps each.
        setAmount("");
        setNote("");
        setError(null);
        toast.success("Saved — add another");
        return;
      }

      onOpenChange(false);
    } catch (thrown) {
      console.error("[records]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    amount.trim() !== "" &&
    accountId !== "" &&
    (type === "transfer" ? toAccountId !== "" : categoryId !== "");

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit record" : "Add record"}
      description={
        editing ? undefined : "Log an expense, income or transfer."
      }
    >
      <SheetBody>
        <TypeTabs
          value={type}
          onChange={(next) => {
            setType(next);
            // Both are cleared on any change of type: a category belongs to
            // one kind, so an expense category left behind when switching to
            // Income would be submitted invisibly — the grid shows nothing
            // selected, but the value is still there.
            setCategoryId("");
            setToAccountId("");
          }}
        />

        <AmountKeypad
          value={amount}
          onChange={setAmount}
          tone={type}
          autoFocus={!editing}
        />

        {type === "transfer" ? (
          <>
            <AccountSelect
              id="from-account"
              label="From"
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
            <AccountSelect
              id="to-account"
              label="To"
              accounts={accounts.filter((account) => account.id !== accountId)}
              value={toAccountId}
              onChange={setToAccountId}
              error={errorField === "toAccountId" ? (error ?? undefined) : undefined}
            />
          </>
        ) : (
          <>
            <CategoryGrid
              categories={visibleCategories}
              value={categoryId}
              onChange={setCategoryId}
              error={errorField === "categoryId" ? (error ?? undefined) : undefined}
            />

            <AccountSelect
              id="account"
              label="Account"
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
          </>
        )}

        <FormRow
          id="occurred-at"
          label="When"
          error={errorField === "occurredAt" ? (error ?? undefined) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          )}
        </FormRow>

        <FormRow id="note" label="Note" hint="Optional">
          {(props) => (
            <Input
              {...props}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Swiggy — team lunch"
              maxLength={500}
            />
          )}
        </FormRow>

        {editing ? null : (
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Repeat
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
              <Label htmlFor="repeat" className="flex-1">
                Repeat
              </Label>
            </div>

            <div
              id="repeat"
              role="radiogroup"
              aria-label="Repeat"
              className="flex flex-wrap gap-1"
            >
              {(["none", ...RECURRENCE_FREQUENCIES] as const).map((value) => {
                const active = frequency === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFrequency(value)}
                    className={cn(
                      "focus-visible:ring-ring h-9 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {value === "none" ? "No" : REPEAT_LABELS[value]}
                  </button>
                );
              })}
            </div>

            {frequency !== "none" ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <FormRow id="repeat-interval" label="Every">
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min={1}
                      max={365}
                      inputMode="numeric"
                      value={interval}
                      onChange={(event) => setInterval(event.target.value)}
                    />
                  )}
                </FormRow>

                <FormRow id="repeat-end" label="Until" hint="Optional">
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  )}
                </FormRow>
              </div>
            ) : null}
          </div>
        )}

        {error && !errorField ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        {editing && onDelete ? (
          <div className="border-t pt-4">
            <Button
              variant="destructive"
              size="touch"
              className="w-full"
              disabled={saving}
              onClick={() => {
                // No confirmation: the undo in the toast is the safety net,
                // and a dialog on every delete is the kind of friction that
                // makes people stop tidying their records.
                onOpenChange(false);
                void onDelete(editing.id);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete record
            </Button>
          </div>
        ) : null}
      </SheetBody>

      <SheetFooter className="flex-col gap-2 sm:flex-row">
        {editing ? (
          <>
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
              onClick={() => void save(false)}
              disabled={saving || !canSave}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="touch"
              className="flex-1"
              onClick={() => void save(true)}
              disabled={saving || !canSave}
            >
              <Plus className="size-4" aria-hidden="true" />
              Save &amp; add another
            </Button>
            <Button
              size="touch"
              className="flex-1"
              onClick={() => void save(false)}
              disabled={saving || !canSave}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Save
            </Button>
          </>
        )}
      </SheetFooter>
    </ResponsiveSheet>
  );
}

/** `yyyy-mm-ddThh:mm` for right now, in the user's timezone. */
function nowLocal(timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Minor units back into something the keypad can show and edit. */
function minorToText(minor: string, decimals: number): string {
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;

  if (decimals === 0) return abs.toString();

  const factor = 10n ** BigInt(decimals);
  const whole = abs / factor;
  const fraction = (abs % factor).toString().padStart(decimals, "0");

  return `${whole}.${fraction}`;
}
