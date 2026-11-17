"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recordPayout } from "@/actions/investments";
import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { AmountInput } from "@/components/shared/amount-input";
import { DatePicker, formatDay } from "@/components/shared/date-picker";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { minorToAmountText, parseAmount } from "@/lib/amount";
import type { Investment } from "@/lib/investments";

/**
 * What a deposit paid out. Pre-filled with the maturity amount from the
 * receipt, because that is usually right; editable, because a bank that
 * deducted TDS paid something else.
 */
export function PayoutSheet({
  open,
  onOpenChange,
  investment,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment;
  today: string;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const formatMoney = useFormatMoney();

  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [close, setClose] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setAmount(
      investment.maturityAmount !== null
        ? minorToAmountText(BigInt(investment.maturityAmount), currency.decimals)
        : "",
    );
    // The maturity date, unless it is still ahead: a payout taken early is
    // dated the day it was taken.
    setDate(
      investment.maturityDate && investment.maturityDate <= today
        ? investment.maturityDate
        : today,
    );
    setClose(true);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment.id]);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const result = await recordPayout({
        id: investment.id,
        amount,
        on: date,
        close,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      const minor = parseAmount(amount, currency.decimals);
      toast.success(
        `Payout of ${formatMoney(minor.ok ? minor.minor : 0n)} recorded${close ? ". Closed." : "."}`,
      );
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

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record payout"
      description={
        investment.maturityDate
          ? `${investment.name} matures on ${formatDay(investment.maturityDate)}.`
          : investment.name
      }
    >
      <SheetBody>
        <div className="grid grid-cols-2 gap-2">
          <FormRow id="payout-amount" label="Amount received" required error={error ?? undefined}>
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
            id="payout-date"
            label="On"
            required
            value={date}
            onChange={setDate}
            max={today}
          />
        </div>

        <div className="rounded-control flex items-center justify-between gap-3 border px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="payout-close">Close this investment</Label>
            <p className="text-text-secondary mt-0.5 text-xs">
              {investment.schedule
                ? "Stops the instalments and moves it to Closed."
                : "Moves it to Closed. Its history stays."}
            </p>
          </div>
          <Switch id="payout-close" checked={close} onCheckedChange={setClose} />
        </div>
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
          Save payout
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}
