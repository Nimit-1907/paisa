"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateRecurringRule } from "@/actions/recurring";
import { useCurrency } from "@/components/profile-provider";
import { AmountKeypad } from "@/components/records/amount-keypad";
import {
  type AccountOption,
  AccountSelect,
  DateField,
  CategoryGrid,
  type CategoryOption,
  TypeTabs,
} from "@/components/shared/entry-pickers";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Stepper } from "@/components/shared/stepper";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeSchedule } from "@/lib/recurrence";
import type { RecurringRule } from "@/lib/recurring-rule";
import {
  RECURRENCE_FREQUENCIES,
  REPEAT_LABELS,
  type RecurrenceFrequency,
  type TransactionType,
} from "@/lib/schemas/transactions";

/**
 * Edit a recurring rule.
 *
 * The same template a record has — type, amount, category, account, note —
 * plus the schedule. Nothing here touches the records the rule has already
 * created: changing the rent to ₹24,000 is a statement about next month, not
 * a correction of the last three.
 *
 * "Next due" doubles as the schedule's anchor, so moving a monthly rule to
 * the 31st is one date to change rather than two fields that can disagree.
 */
export function RuleSheet({
  open,
  onOpenChange,
  rule,
  accounts,
  categories,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: RecurringRule | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  /** Today where the user is, `yyyy-mm-dd`. */
  today: string;
}) {
  const router = useRouter();
  const currency = useCurrency();

  const [type, setType] = React.useState<TransactionType>("expense");
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [frequency, setFrequency] =
    React.useState<RecurrenceFrequency>("monthly");
  const [interval, setInterval] = React.useState("1");
  const [nextRunOn, setNextRunOn] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  const ruleId = rule?.id ?? null;

  // Keyed on the id, not the object: a revalidation underneath must not wipe
  // what is half-typed.
  React.useEffect(() => {
    if (!open || !rule) return;

    setType(rule.type);
    setAmount(minorToText(rule.amount, currency.decimals));
    setAccountId(rule.accountId);
    setToAccountId(rule.toAccountId ?? "");
    setCategoryId(rule.categoryId ?? "");
    setNote(rule.note ?? "");
    setFrequency(rule.frequency);
    setInterval(String(rule.interval));
    // dueOn is null for a rule that is paused or has run out, and its cursor
    // can be months behind. Offering that stale date would re-anchor the
    // schedule into the past on save, and the generator would answer with a
    // pile of back-dated records.
    setNextRunOn(
      rule.dueOn ?? (rule.nextRunOn > today ? rule.nextRunOn : today),
    );
    setEndDate(rule.endDate ?? "");
    setError(null);
    setErrorField(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ruleId]);

  const visibleCategories = categories.filter(
    (category) => category.kind === (type === "income" ? "income" : "expense"),
  );

  // Validated here rather than coerced: Number("") and Number("0") both fall
  // back to 1, which saves a schedule the user did not type.
  const intervalNumber = /^\d+$/.test(interval.trim())
    ? Number(interval.trim())
    : null;
  const intervalError =
    intervalNumber === null
      ? "Use a whole number."
      : intervalNumber < 1
        ? "Repeat at least every 1."
        : intervalNumber > 365
          ? "That is too far apart."
          : null;

  const preview =
    nextRunOn && intervalNumber !== null && !intervalError
      ? describeSchedule({
          frequency,
          interval: intervalNumber,
          startDate: nextRunOn,
        })
      : "";

  async function save() {
    if (!rule) return;

    if (intervalError || intervalNumber === null) {
      setError(intervalError);
      setErrorField("interval");
      return;
    }

    setSaving(true);
    setError(null);
    setErrorField(null);

    try {
      const result = await updateRecurringRule({
        id: rule.id,
        type,
        amount,
        accountId,
        toAccountId: type === "transfer" ? toAccountId || null : null,
        categoryId: type === "transfer" ? null : categoryId || null,
        note: note.trim() ? note.trim() : null,
        frequency,
        interval: intervalNumber,
        nextRunOn,
        endDate: endDate || null,
      });

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      toast.success("Rule saved — future occurrences updated");
      onOpenChange(false);
      router.refresh();
    } catch (thrown) {
      // Without this the sheet would sit on "Saving…" for ever.
      console.error("[recurring]", thrown);
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
    nextRunOn !== "" &&
    intervalError === null &&
    (type === "transfer" ? toAccountId !== "" : categoryId !== "");

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit recurring"
      description="Changes apply to future occurrences only."
    >
      <SheetBody>
        <TypeTabs
          value={type}
          onChange={(next) => {
            setType(next);
            setCategoryId("");
            setToAccountId("");
          }}
        />

        <AmountKeypad value={amount} onChange={setAmount} tone={type} />

        {type === "transfer" ? (
          <>
            <AccountSelect
              id="rule-from-account"
              label="From"
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
            <AccountSelect
              id="rule-to-account"
              label="To"
              accounts={accounts.filter((account) => account.id !== accountId)}
              value={toAccountId}
              onChange={setToAccountId}
              error={
                errorField === "toAccountId" ? (error ?? undefined) : undefined
              }
            />
          </>
        ) : (
          <>
            <CategoryGrid
              categories={visibleCategories}
              value={categoryId}
              onChange={setCategoryId}
              error={
                errorField === "categoryId" ? (error ?? undefined) : undefined
              }
            />

            <AccountSelect
              id="rule-account"
              label="Account"
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
          </>
        )}

        <FormRow id="rule-note" label="Note" hint="Shown on every record">
          {(props) => (
            <Input
              {...props}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Rent — landlord UPI"
              maxLength={500}
            />
          )}
        </FormRow>

        <div className="space-y-2 rounded-control border p-3">
          <Label id="rule-frequency-label">Repeats</Label>

          <SegmentedControl
            label="Repeats"
            value={frequency}
            onChange={setFrequency}
            options={RECURRENCE_FREQUENCIES.map((value) => ({
              value,
              label: REPEAT_LABELS[value],
            }))}
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <FormRow
              id="rule-interval"
              label="Every"
              error={
                // Shown as soon as it is wrong, rather than only on save:
                // the Save button is disabled, and a disabled button with no
                // explanation is the worst of both.
                intervalError ??
                (errorField === "interval" ? (error ?? undefined) : undefined)
              }
            >
              {(props) => (
                <Stepper
                  id={props.id}
                  label="Every how many"
                  value={interval}
                  onChange={setInterval}
                />
              )}
            </FormRow>

            <DateField
              id="rule-next"
              label="Next due"
              value={nextRunOn}
              onChange={setNextRunOn}
              invalid={errorField === "nextRunOn"}
            />
          </div>

          <DateField
            id="rule-end"
            label="Until"
            placeholder="No end date"
            value={endDate}
            onChange={setEndDate}
            min={nextRunOn || undefined}
            invalid={errorField === "endDate"}
          />

          {errorField === "nextRunOn" || errorField === "endDate" ? (
            <p role="alert" className="text-expense text-sm">
              {error}
            </p>
          ) : null}

          {preview ? (
            <p className="text-text-secondary text-xs" aria-live="polite">
              {preview}, starting {nextRunOn}
            </p>
          ) : null}
        </div>

        {error && !errorField ? (
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
          disabled={saving || !canSave}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Save rule
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}

/** Minor units back into something the keypad can show and edit. */
function minorToText(minor: string, decimals: number): string {
  const value = BigInt(minor);
  const abs = value < 0n ? -value : value;

  if (decimals === 0) return abs.toString();

  const factor = 10n ** BigInt(decimals);
  const whole = abs / factor;
  const fraction = (abs % factor).toString().padStart(decimals, "0");

  return `${whole}.${fraction}`;
}
