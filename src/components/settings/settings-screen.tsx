"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, ChevronRight, Loader2, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { updateProfile } from "@/actions/profile";
import { ChangePasswordCard } from "@/components/settings/change-password-card";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Currency, findCurrency, searchCurrencies } from "@/lib/currencies";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const WEEK_DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export type SettingsProfile = {
  displayName: string;
  email: string;
  currencyCode: string;
  /** What the stored amounts currently mean. */
  decimals: number;
  weekStart: number;
  theme: "light" | "dark" | "system";
};

/**
 * Everything about the account in one form.
 *
 * Saved in one go rather than field by field: changing a currency and a week
 * start are two halves of the same thought, and an autosave that fires on
 * every keystroke of a name is a write per letter.
 */
export function SettingsScreen({ profile }: { profile: SettingsProfile }) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const [displayName, setDisplayName] = React.useState(profile.displayName);
  const [currencyCode, setCurrencyCode] = React.useState(profile.currencyCode);
  const [weekStart, setWeekStart] = React.useState(profile.weekStart);
  const [theme, setThemeValue] = React.useState(profile.theme);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  const currency = findCurrency(currencyCode);
  const currentDecimals = profile.decimals;

  // The theme is applied on tap so it can be seen, but it is only *saved*
  // with the rest of the form. Leaving the screen without saving puts the
  // stored one back, so what is on screen and what is stored never disagree.
  const saved = React.useRef(profile.theme);
  const chosen = React.useRef(profile.theme);
  chosen.current = theme;

  React.useEffect(() => {
    return () => {
      // Read on the way out, not on the way in: a save updates saved.current,
      // and a cleanup holding the pre-save value would undo the save.
      if (chosen.current !== saved.current) setTheme(saved.current);
    };
  }, [setTheme]);

  const dirty =
    displayName !== profile.displayName ||
    currencyCode !== profile.currencyCode ||
    weekStart !== profile.weekStart ||
    theme !== profile.theme;

  async function save() {
    setSaving(true);
    setError(null);
    setErrorField(null);

    try {
      const result = await updateProfile({
        displayName,
        currencyCode,
        weekStart,
        theme,
      });

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      // next-themes keeps its own copy in localStorage, so the stored
      // preference and what is on screen have to be set together.
      setTheme(theme);
      saved.current = theme;
      toast.success("Settings saved");
      router.refresh();
    } catch (thrown) {
      // Without this the button would sit on "Saving…" for ever.
      console.error("[settings]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-card space-y-4 rounded-2xl border p-4">
        <FormRow
          id="display-name"
          label="Your name"
          error={errorField === "displayName" ? (error ?? undefined) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              autoComplete="name"
            />
          )}
        </FormRow>

        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <button
            id="currency"
            type="button"
            onClick={() => setPickerOpen(true)}
            className="focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="amount text-lg font-semibold">
              {currency?.symbol ?? "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {currency?.name ?? currencyCode}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {currency
                  ? formatMoney(123456n, {
                      symbol: currency.symbol,
                      decimals: currency.decimals,
                    })
                  : ""}
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden="true"
            />
          </button>

          {currency && currency.code !== profile.currencyCode ? (
            <p
              className={cn(
                "text-xs",
                currency.decimals === currentDecimals
                  ? "text-muted-foreground"
                  : "text-warning font-medium",
              )}
            >
              {currency.decimals === currentDecimals
                ? "Amounts already saved keep their value; only the symbol changes."
                : `Amounts already saved will be rescaled to ${
                    currency.decimals === 0
                      ? "whole units"
                      : `${currency.decimals} decimal places`
                  }, and rounding cannot be undone.`}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label id="week-start-label">Week starts on</Label>
          <div
            role="radiogroup"
            aria-labelledby="week-start-label"
            className="flex flex-wrap gap-1"
          >
            {WEEK_DAYS.map((day) => {
              const active = weekStart === day.value;
              return (
                <button
                  key={day.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setWeekStart(day.value)}
                  className={cn(
                    "focus-visible:ring-ring h-11 min-w-11 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label id="theme-label">Appearance</Label>
          <div
            role="radiogroup"
            aria-labelledby="theme-label"
            className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1"
          >
            {THEMES.map((option) => {
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setThemeValue(option.value);
                    // Applied straight away: a theme you cannot see until you
                    // press Save is a guess, not a choice.
                    setTheme(option.value);
                  }}
                  className={cn(
                    "focus-visible:ring-ring h-11 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && !errorField ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <Button
          size="touch"
          className="w-full"
          disabled={saving || !dirty}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </section>

      <ChangePasswordCard />

      <DeleteAccountCard email={profile.email} />

      <CurrencySheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={currencyCode}
        onSelect={(next) => {
          setCurrencyCode(next.code);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function CurrencySheet({
  open,
  onOpenChange,
  selected,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string;
  onSelect: (currency: Currency) => void;
}) {
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => searchCurrencies(query), [query]);

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a currency"
      description="The symbol and decimal places used everywhere."
    >
      <SheetBody>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rupee, USD, €…"
            className="pl-9"
            aria-label="Search currencies"
          />
        </div>

        <ul className="divide-border divide-y">
          {results.map((currency) => {
            const active = currency.code === selected;
            return (
              <li key={currency.code}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(currency)}
                  className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 px-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="amount w-8 shrink-0 text-center text-base font-semibold">
                    {currency.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {currency.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {currency.code} ·{" "}
                      {formatMoney(123456n, {
                        symbol: currency.symbol,
                        decimals: currency.decimals,
                      })}
                    </span>
                  </span>
                  {active ? (
                    <Check className="text-primary size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}

          {results.length === 0 ? (
            <li className="text-muted-foreground py-6 text-center text-sm">
              No currency matches “{query}”.
            </li>
          ) : null}
        </ul>
      </SheetBody>

      <SheetFooter>
        <Button
          variant="outline"
          size="touch"
          className="flex-1"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}
