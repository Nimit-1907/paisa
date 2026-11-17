"use client";

import * as React from "react";

import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createEntry, updateEntry } from "@/actions/investments";
import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { AmountInput } from "@/components/shared/amount-input";
import { DatePicker } from "@/components/shared/date-picker";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { minorToAmountText, parseAmount } from "@/lib/amount";
import type {
  Investment,
  InvestmentEntry,
  InvestmentEntryType,
} from "@/lib/investments";

/**
 * One movement: money in, or money out.
 *
 * Units and NAV are optional and for the user's own reference; the totals
 * are always by amount. A redemption larger than what is still in is
 * allowed, a fund that grew pays back more than went in, but it is said
 * out loud, because the other reason is a typo.
 */
export function EntrySheet({
  open,
  onOpenChange,
  investment,
  entry,
  initialType = "invest",
  today,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment;
  /** Null adds a new one. */
  entry: InvestmentEntry | null;
  initialType?: InvestmentEntryType;
  today: string;
  onSaved: (entry: InvestmentEntry) => void;
}) {
  const currency = useCurrency();
  const formatMoney = useFormatMoney();

  const [type, setType] = React.useState<InvestmentEntryType>(initialType);
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [units, setUnits] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [field, setField] = React.useState<string | null>(null);

  const entryId = entry?.id ?? null;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setField(null);

    if (!entry) {
      setType(initialType);
      setAmount("");
      setDate(today);
      setUnits("");
      setPrice("");
      setNote("");
      return;
    }

    setType(entry.type);
    setAmount(minorToAmountText(BigInt(entry.amount), currency.decimals));
    setDate(entry.occurredOn);
    setUnits(entry.units !== null ? String(entry.units) : "");
    setPrice(
      entry.price !== null
        ? minorToAmountText(BigInt(entry.price), currency.decimals)
        : "",
    );
    setNote(entry.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entryId, initialType]);

  // What is still in, before this entry: an edited redemption is measured
  // against the investment without itself.
  const parsed = parseAmount(amount, currency.decimals);
  const typed = parsed.ok ? Number(parsed.minor) : 0;
  const before =
    investment.net +
    (entry ? (entry.type === "redeem" ? entry.amount : -entry.amount) : 0);
  const overdraws = type === "redeem" && typed > 0 && typed > before;

  // Units times price, offered when both are typed and the amount is empty,
  // never written over something the user typed.
  const unitsNumber = Number(units);
  const priceParsed = parseAmount(price, currency.decimals);
  const suggested =
    !amount.trim() && unitsNumber > 0 && priceParsed.ok && priceParsed.minor > 0n
      ? Math.round(unitsNumber * Number(priceParsed.minor))
      : null;

  async function save() {
    setSaving(true);
    setError(null);
    setField(null);

    const values = {
      type,
      amount,
      date,
      units: units.trim() || null,
      price: price.trim() || null,
      note,
    };

    try {
      const result = entry
        ? await updateEntry({ id: entry.id, ...values })
        : await createEntry({ investmentId: investment.id, ...values });

      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      const minor = parseAmount(amount, currency.decimals);
      const priceMinor = parseAmount(price, currency.decimals);
      onSaved({
        id: result.data.id,
        investmentId: investment.id,
        type,
        amount: minor.ok ? Number(minor.minor) : 0,
        units: units.trim() ? Number(units) : null,
        price: price.trim() && priceMinor.ok ? Number(priceMinor.minor) : null,
        occurredOn: date,
        note: note.trim() || null,
        scheduled: entry?.scheduled ?? false,
      });

      toast.success(
        `${type === "invest" ? "Invested" : "Redeemed"} ${formatMoney(minor.ok ? minor.minor : 0n)}.`,
      );
      onOpenChange(false);
    } catch (thrown) {
      console.error("[investments]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const err = (name: string) => (field === name ? (error ?? undefined) : undefined);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? "Edit entry" : type === "invest" ? "Invest" : "Redeem"}
      description={investment.name}
    >
      <SheetBody>
        <SegmentedControl
          label="Money in or out"
          value={type}
          onChange={setType}
          options={[
            { value: "invest", label: "Invest" },
            { value: "redeem", label: "Redeem" },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          <FormRow id="entry-amount" label="Amount" required error={err("amount")}>
            {(props) => (
              <AmountInput
                {...props}
                value={amount}
                onChange={setAmount}
                placeholder="0"
              />
            )}
          </FormRow>
          <DatePicker
            id="entry-date"
            label="On"
            required
            value={date}
            onChange={setDate}
            max={today}
            invalid={field === "date"}
          />
        </div>

        {overdraws ? (
          <p role="status" className="bg-tint-butter text-text rounded-control px-3 py-2 text-sm">
            This takes out more than the {formatMoney(BigInt(Math.max(0, before)))}{" "}
            still in. Fine if it grew; check it if not.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <FormRow id="entry-units" label="Units" error={err("units")}>
            {(props) => (
              <Input
                {...props}
                value={units}
                onChange={(event) =>
                  setUnits(event.target.value.replace(/[^\d.]/g, ""))
                }
                inputMode="decimal"
                placeholder="12.345"
                maxLength={21}
              />
            )}
          </FormRow>
          <FormRow id="entry-price" label="NAV or price" error={err("price")}>
            {(props) => (
              <AmountInput
                {...props}
                value={price}
                onChange={setPrice}
                placeholder="0"
              />
            )}
          </FormRow>
        </div>

        {suggested !== null ? (
          <Button
            variant="outline"
            size="touch"
            onClick={() =>
              setAmount(minorToAmountText(BigInt(suggested), currency.decimals))
            }
          >
            Use {formatMoney(BigInt(suggested))} (units × price)
          </Button>
        ) : null}

        <FormRow id="entry-note" label="Note" error={err("note")}>
          {(props) => (
            <Input
              {...props}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={type === "invest" ? "Top-up from bonus" : "For the car"}
              maxLength={500}
            />
          )}
        </FormRow>

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
          disabled={saving || !amount.trim() || !date}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Save
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}
