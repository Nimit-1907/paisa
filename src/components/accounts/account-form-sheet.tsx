"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createAccount, updateAccount } from "@/actions/accounts";
import type { AccountView } from "@/components/accounts/types";
import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { ColorPicker } from "@/components/shared/color-picker";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { IconPicker } from "@/components/shared/icon-picker";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_COLOR } from "@/lib/colors";
import { ACCOUNT_TYPE_ICONS, DEFAULT_ACCOUNT_ICON } from "@/lib/icons";
import { fromMinor, tryToMinor } from "@/lib/money";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type AccountType,
} from "@/lib/schemas/accounts";
import { cn } from "@/lib/utils";

/**
 * Add or edit an account.
 *
 * One sheet for both: the fields are identical, and two components would mean
 * two places to keep the validation and the pickers in step.
 */
export function AccountFormSheet({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omitted when adding. */
  account?: AccountView;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const formatMoney = useFormatMoney();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>("bank");
  const [icon, setIcon] = React.useState<string>(DEFAULT_ACCOUNT_ICON);
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [initialBalance, setInitialBalance] = React.useState("");
  const [includeInTotal, setIncludeInTotal] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [field, setField] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset when the sheet opens, or when it is pointed at a different account.
  // Keyed on the id rather than the object: a router.refresh while the sheet
  // is open hands over a new object, and depending on that would wipe
  // whatever the user had typed.
  const accountId = account?.id;

  React.useEffect(() => {
    if (!open) return;

    setName(account?.name ?? "");
    setType(account?.type ?? "bank");
    setIcon(account?.icon ?? ACCOUNT_TYPE_ICONS[account?.type ?? "bank"]);
    setColor(account?.color ?? DEFAULT_COLOR);
    setInitialBalance(
      account ? fromMinor(BigInt(account.initialBalance), currency.decimals) : "",
    );
    setIncludeInTotal(account?.includeInTotal ?? true);
    setError(null);
    setField(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, currency.decimals]);

  const parsedBalance = initialBalance.trim()
    ? tryToMinor(initialBalance, currency.decimals)
    : 0n;

  async function save() {
    setSaving(true);
    setError(null);
    setField(null);

    try {
      const payload = {
        name,
        type,
        icon,
        color,
        initialBalance,
        includeInTotal,
      };

      const result = account
        ? await updateAccount({ ...payload, id: account.id })
        : await createAccount(payload);

      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      toast.success(account ? "Account updated" : "Account added");
      onOpenChange(false);
      // revalidatePath marks the cache; this is what makes the open page
      // actually re-render with the new data.
      router.refresh();
    } catch {
      const message = "Could not save the account. Check your connection.";
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
      title={account ? "Edit account" : "New account"}
      description={
        account
          ? "Changing the opening balance moves every balance that follows it."
          : "Cash, a bank account, a card or a wallet — anything money sits in."
      }
    >
      <SheetBody>
        <FormRow
          id="account-name"
          label="Name"
          error={field === "name" ? (error ?? undefined) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="HDFC Savings"
              autoFocus={!account}
            />
          )}
        </FormRow>

        <div className="space-y-1.5">
          <Label htmlFor="account-type">Type</Label>
          <div
            id="account-type"
            role="radiogroup"
            aria-label="Account type"
            className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1"
          >
            {ACCOUNT_TYPES.map((value) => {
              const active = value === type;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setType(value);
                    // Only follow the type if the user has not chosen an icon
                    // of their own.
                    if (!account && icon === ACCOUNT_TYPE_ICONS[type]) {
                      setIcon(ACCOUNT_TYPE_ICONS[value]);
                    }
                  }}
                  className={cn(
                    "focus-visible:ring-ring h-11 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ACCOUNT_TYPE_LABELS[value]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Icon and colour</Label>
          <div className="flex items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              <DynamicIcon name={icon} className="size-5" />
            </span>
            <ColorPicker value={color} onChange={setColor} className="flex-1" />
          </div>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>

        <FormRow
          id="account-balance"
          label="Opening balance"
          error={field === "initialBalance" ? (error ?? undefined) : undefined}
          hint={
            parsedBalance !== null
              ? `Starts at ${formatMoney(parsedBalance)}`
              : undefined
          }
        >
          {(props) => (
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-base">
                {currency.symbol}
              </span>
              <Input
                {...props}
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="amount pl-9"
              />
            </div>
          )}
        </FormRow>

        <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="include-in-total">Include in total</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Off for accounts you track but do not count as yours.
            </p>
          </div>
          <Switch
            id="include-in-total"
            checked={includeInTotal}
            onCheckedChange={setIncludeInTotal}
          />
        </div>

        {error && !field ? (
          <p role="alert" className="text-destructive text-sm">
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
          onClick={save}
          disabled={saving || name.trim().length === 0}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : account ? (
            "Save changes"
          ) : (
            "Add account"
          )}
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}

