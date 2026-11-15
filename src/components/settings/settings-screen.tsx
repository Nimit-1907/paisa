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
import { Pill } from "@/components/shared/pill";
import { SectionHeader } from "@/components/shared/section-header";
import { Card } from "@/components/shared/surface";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Currency,
  findCurrency,
  searchCurrencies,
} from "@/lib/currencies";
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
export function SettingsScreen({
  profile,
  preferences,
}: {
  profile: SettingsProfile;
  /** The two switches that save themselves; see PreferencesCard. */
  preferences: React.ReactNode;
}) {
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
    <div className="space-y-5">
      <section>
        <SectionHeader className="mb-1.5 px-1" title="Profile" />

        <Card className="space-y-4 p-4">
          <FormRow
            id="display-name"
            label="Your name"
            error={
              errorField === "displayName" ? (error ?? undefined) : undefined
            }
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
        </Card>
      </section>

      <section>
        <SectionHeader
          className="mb-1.5 px-1"
          title="Currency and format"
          trailing={
            // How an amount will look, as a pill: the point of this section
            // is what the rest of the app will read like, and a sample is
            // worth more than the code.
            currency ? (
              <Pill tone="accent">
                {formatMoney(123456n, {
                  symbol: currency.symbol,
                  decimals: currency.decimals,
                })}
              </Pill>
            ) : null
          }
        />

        <Card className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <button
              id="currency"
              type="button"
              onClick={() => setPickerOpen(true)}
              className=" flex min-h-11 w-full items-center gap-3 rounded-control border px-3 text-left transition-colors hoverable:bg-surface-muted "
            >
              <span className="amount text-lg font-semibold">
                {currency?.symbol ?? "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {currency?.name ?? currencyCode}
                </span>
                <span className="text-text-secondary block truncate text-xs">
                  {currency
                    ? formatMoney(123456n, {
                        symbol: currency.symbol,
                        decimals: currency.decimals,
                      })
                    : ""}
                </span>
              </span>
              <ChevronRight
                className="text-text-secondary size-4 shrink-0"
                aria-hidden="true"
              />
            </button>

            {currency && currency.code !== profile.currencyCode ? (
              <p
                className={cn(
                  "text-xs",
                  currency.decimals === currentDecimals
                    ? "text-text-secondary"
                    : "text-text font-semibold",
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
        </Card>
      </section>

      <section>
        <SectionHeader className="mb-1.5 px-1" title="Preferences" />

        <Card className="space-y-4 p-4">
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
                      "pressable h-11 min-w-11 rounded-full px-2.5 text-xs font-semibold",
                      "duration-[120ms] transition-[background-color,box-shadow,border-color] motion-reduce:transition-none",
                      active
                        ? "accent-sm bg-surface text-text"
                        : "bg-surface-muted text-text-secondary hoverable:bg-hairline border border-transparent",
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {preferences}
        </Card>
      </section>

      <section>
        <SectionHeader className="mb-1.5 px-1" title="Appearance" />

        <Card className="p-4">
          <div
            role="radiogroup"
            aria-label="Appearance"
            className="grid grid-cols-3 gap-2"
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
                    "rounded-control pressable flex flex-col items-center gap-2 p-2",
                    "duration-[120ms] transition-[box-shadow,border-color] motion-reduce:transition-none",
                    active
                      ? "accent-sm bg-surface"
                      : "border border-transparent",
                  )}
                >
                  <ThemePreview theme={option.value} />
                  <span className="text-text text-xs font-semibold">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      <div className="space-y-4">
        {error && !errorField ? (
          <p role="alert" className="text-expense text-sm">
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
      </div>

      <section>
        <SectionHeader className="mb-1.5 px-1" title="Security" />
        <ChangePasswordCard />
      </section>

      <section>
        <SectionHeader
          className="mb-1.5 px-1"
          title="Danger zone"
          description="There is no undo for this one."
        />
        <DeleteAccountCard email={profile.email} />
      </section>

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
            className="text-text-secondary pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
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

        <ul className="divide-hairline divide-y">
          {results.map((currency) => {
            const active = currency.code === selected;
            return (
              <li key={currency.code}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(currency)}
                  className="hoverable:bg-surface-muted flex min-h-12 w-full items-center gap-3 px-1 text-left transition-colors  "
                >
                  <span className="amount w-8 shrink-0 text-center text-base font-semibold">
                    {currency.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {currency.name}
                    </span>
                    <span className="text-text-secondary block text-xs">
                      {currency.code} ·{" "}
                      {formatMoney(123456n, {
                        symbol: currency.symbol,
                        decimals: currency.decimals,
                      })}
                    </span>
                  </span>
                  {active ? (
                    <Check
                      className="text-text size-4 shrink-0"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}

          {results.length === 0 ? (
            <li className="text-text-secondary py-6 text-center text-sm">
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

/**
 * A two-line sketch of what a screen looks like in that theme.
 *
 * Three words — Light, Dark, System — ask somebody to imagine the result.
 * Thirty pixels of the actual surfaces show it, and `system` is drawn as
 * the two halves because that is what following the device means.
 */
function ThemePreview({ theme }: { theme: "light" | "dark" | "system" }) {
  const sketch = (dark: boolean, className?: string) => (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-10 flex-col justify-center gap-1 overflow-hidden px-1.5",
        dark ? "bg-preview-dark-page" : "bg-preview-light-page",
        className,
      )}
    >
      <span
        className={cn(
          "block h-1.5 w-7 rounded-full",
          dark ? "bg-preview-dark-ink" : "bg-preview-light-ink",
        )}
      />
      <span
        className={cn(
          "block h-1 w-5 rounded-full",
          dark ? "bg-preview-dark-line" : "bg-preview-light-line",
        )}
      />
    </span>
  );

  return (
    <span className="rounded-control flex w-full overflow-hidden border">
      {theme === "system" ? (
        <>
          {sketch(false, "w-1/2")}
          {sketch(true, "w-1/2")}
        </>
      ) : (
        sketch(theme === "dark", "w-full")
      )}
    </span>
  );
}
