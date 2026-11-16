"use client";

import * as React from "react";

import {
  ArrowLeft,
  Check,
  Landmark,
  Loader2,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { completeOnboarding, startTracking } from "@/actions/profile";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/shared/amount-input";
import {
  type Currency,
  DEFAULT_CURRENCY,
  searchCurrencies,
} from "@/lib/currencies";
import { formatWith, tryToMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

const STEPS = ["You", "Currency", "Account"] as const;

/**
 * 0–2 are the questions; 3 is the end.
 *
 * Setup used to finish with a toast and a redirect, which lands somebody on
 * a screen full of someone else's demo data with no idea whether anything
 * was saved. The last step says what was set up and offers the one thing
 * there is to do next.
 */
type Step = 0 | 1 | 2 | 3;

/**
 * Which step each field belongs to.
 *
 * The whole form is submitted from the last step, so the server can reject
 * something filled in two steps ago, a name past 80 characters, which
 * nothing checks client-side. Without this the message would be attached to
 * a field that is not on screen, and so shown nowhere at all.
 */
const STEP_OF_FIELD: Record<string, Step> = {
  displayName: 0,
  currencyCode: 1,
  accountName: 2,
  openingBalance: 2,
  bankName: 2,
  bankBalance: 2,
};

export function OnboardingFlow({
  initialName,
  initialAccountName,
}: {
  initialName: string;
  initialAccountName: string;
}) {
  const [step, setStep] = React.useState<Step>(0);
  const [displayName, setDisplayName] = React.useState(initialName);
  const [currency, setCurrency] = React.useState<Currency>(DEFAULT_CURRENCY);
  const [accountName, setAccountName] = React.useState(initialAccountName);
  const [openingBalance, setOpeningBalance] = React.useState("");
  const [wantsBank, setWantsBank] = React.useState(false);
  const [bankName, setBankName] = React.useState("");
  const [bankBalance, setBankBalance] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  /** Which field the error belongs under, so it is never shown on another. */
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const openingMinor = openingBalance
    ? tryToMinor(openingBalance, currency.decimals)
    : 0n;

  function next() {
    if (step === 0 && displayName.trim().length === 0) {
      setError("Tell us what to call you.");
      setErrorField("displayName");
      return;
    }
    setError(null);
    setErrorField(null);
    setStep((current) => Math.min(current + 1, 2) as Step);
  }

  function back() {
    setError(null);
    setErrorField(null);
    setStep((current) => Math.max(current - 1, 0) as Step);
  }

  async function finish() {
    if (openingMinor === null) {
      setError("That opening balance is not a number.");
      setErrorField("openingBalance");
      return;
    }

    setSaving(true);

    try {
      const result = await completeOnboarding({
        displayName,
        currencyCode: currency.code,
        accountName,
        openingBalance,
        // Only when the panel is open: a name typed and then collapsed is
        // a change of mind, not an account.
        bankName: wantsBank ? bankName : undefined,
        bankBalance: wantsBank ? bankBalance : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? "openingBalance");
        // Everything is submitted from the last step, so a complaint about
        // the name or the currency would otherwise point at a field two
        // steps back and be rendered nowhere at all. Go to the step that
        // owns it, where the message and the field are together.
        setStep(STEP_OF_FIELD[result.field ?? ""] ?? 2);
        toast.error(result.error);
        return;
      }

      // No refresh here: this page redirects anyone whose setup is already
      // done, and refreshing would bounce them off the welcome screen that
      // was the point of finishing.
      setStep(3);
    } catch (thrown) {
      // A dropped connection rejects the action. Without this the button
      // would sit on "Setting up…" for ever with nothing explaining why.
      console.error("[onboarding]", thrown);
      const message =
        "Could not save your setup. Check your connection and try again.";
      setError(message);
      setErrorField("openingBalance");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-1 flex-col">
      <ol
        className={cn("mb-8 flex items-center gap-2", step === 3 && "hidden")}
        aria-label="Setup progress"
      >
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors",
                index <= step ? "bg-ink" : "bg-surface-muted",
              )}
            />
            <span
              className={cn(
                "mt-2 block text-xs font-semibold",
                index === step ? "text-text" : "text-text-secondary",
              )}
              aria-current={index === step ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-1 flex-col justify-center pb-6">
        {step === 0 ? (
          <section className="space-y-6">
            <header>
              <h1 className="font-display text-3xl tracking-tight">
                First, your name
              </h1>
              <p className="text-text-secondary mt-1.5 text-sm">
                Only used to greet you. Nobody else sees it.
              </p>
            </header>

            <FormRow
              id="displayName"
              label="Your name"
              error={
                errorField === "displayName" ? (error ?? undefined) : undefined
              }
            >
              {(field) => (
                <Input
                  {...field}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- this step has just replaced the one before it, so focus has to land somewhere.
                  autoFocus
                  placeholder="Aarav"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      next();
                    }
                  }}
                />
              )}
            </FormRow>
          </section>
        ) : null}

        {step === 1 ? (
          <CurrencyStep selected={currency} onSelect={setCurrency} />
        ) : null}

        {step === 2 ? (
          <section className="space-y-6">
            <header>
              <h1 className="font-display text-3xl tracking-tight">
                Your first account
              </h1>
              <p className="text-text-secondary mt-1.5 text-sm">
                Every record is booked against an account. You can add banks,
                cards and wallets later.
              </p>
            </header>

            <div className="bg-surface space-y-4 rounded-card border p-4">
              <div className="flex items-center gap-3">
                <span className="bg-tint-peri text-text flex size-10 items-center justify-center rounded-control">
                  <Wallet className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Created for you at signup
                  </p>
                  <p className="text-text-secondary text-xs">
                    Rename it or set what is in it right now.
                  </p>
                </div>
              </div>

              <FormRow id="accountName" label="Account name" required>
                {(field) => (
                  <Input
                    {...field}
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    placeholder="Cash"
                  />
                )}
              </FormRow>

              <FormRow
                id="openingBalance"
                label="Opening balance"
                error={
                  errorField === "openingBalance"
                    ? (error ?? undefined)
                    : undefined
                }
                hint={
                  openingMinor !== null
                    ? `Starts at ${formatWith(
                        {
                          code: currency.code,
                          symbol: currency.symbol,
                          decimals: currency.decimals,
                        },
                        openingMinor,
                      )}`
                    : undefined
                }
              >
                {(field) => (
                  <AmountInput
                    {...field}
                    value={openingBalance}
                    onChange={setOpeningBalance}
                    allowNegative
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- the account name above is already filled in, so this is the one empty field on a step that has just replaced the one before it.
                    autoFocus
                    placeholder="0"
                  />
                )}
              </FormRow>
            </div>

            {/*
            A second account, offered rather than asked for.

            Most people finish setup with one, so this is a disclosure and
            not a fourth step - a step that exists to be skipped is a step
            that makes setup feel longer than it is.
          */}
            {wantsBank ? (
              <div className="bg-surface rounded-card space-y-4 border p-4">
                <div className="flex items-center gap-3">
                  <span className="bg-tint-peri text-text rounded-control flex size-10 items-center justify-center">
                    <Landmark className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Bank account</p>
                    <p className="text-text-secondary text-xs">
                      Transfers between this and your cash are not spending.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="touch"
                    className="px-3"
                    onClick={() => setWantsBank(false)}
                  >
                    Remove
                  </Button>
                </div>

                <FormRow
                  id="bankName"
                  label="Account name"
                  error={
                    errorField === "bankName" ? (error ?? undefined) : undefined
                  }

                  required
                >
                  {(field) => (
                    <Input
                      {...field}
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- the field has just appeared in response to a tap, so focus belongs in it.
                      autoFocus
                      placeholder="HDFC"
                    />
                  )}
                </FormRow>

                <FormRow
                  id="bankBalance"
                  label="Balance right now"
                  error={
                    errorField === "bankBalance"
                      ? (error ?? undefined)
                      : undefined
                  }
                >
                  {(field) => (
                    <AmountInput
                      {...field}
                      value={bankBalance}
                      onChange={setBankBalance}
                      allowNegative
                      placeholder="0"
                    />
                  )}
                </FormRow>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="w-full"
                onClick={() => setWantsBank(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add a bank account
              </Button>
            )}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="text-center">
            <span className="bg-tint-mint text-income mx-auto mb-5 flex size-14 items-center justify-center rounded-card">
              <Check className="size-7" aria-hidden="true" />
            </span>

            <h2 className="font-display text-3xl tracking-tight">
              You are set up, {displayName.trim()}.
            </h2>

            <p className="text-text-secondary mt-2 text-sm">
              Tracking in {currency.name} ({currency.symbol}), starting with{" "}
              {/* Both accounts named when there are two: a summary that leaves
                one out invites a second trip to Accounts to check. */}
              {wantsBank && bankName.trim()
                ? `${accountName.trim() || "your first account"} and ${bankName.trim()}`
                : accountName.trim() || "your first account"}
              .
            </p>

            <div className="pb-safe mt-8">
              {/*
              A form, not an onClick: the action rebuilds the shell and
              redirects in one step, so there is no window where this page
              has been invalidated and is still on screen waiting to be
              clicked. Straight into the sheet, because the next thing to do
              is the whole point of the app.
            */}
              <form action={startTracking}>
                <Button type="submit" size="touch" className="w-full">
                  Add your first expense
                </Button>
              </form>
            </div>
          </section>
        ) : null}
      </div>

      {step === 3 ? null : (
        <StickyActionBar className="-mx-4 px-4">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={back}
              disabled={saving}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
          ) : null}

          {step < 2 ? (
            <Button
              type="button"
              size="touch"
              className="flex-1"
              onClick={next}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              size="touch"
              className="flex-1"
              onClick={finish}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Setting up…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Start tracking
                </>
              )}
            </Button>
          )}
        </StickyActionBar>
      )}
    </div>
  );
}

function CurrencyStep({
  selected,
  onSelect,
}: {
  selected: Currency;
  onSelect: (currency: Currency) => void;
}) {
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => searchCurrencies(query), [query]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          Which currency?
        </h1>
        <p className="text-text-secondary mt-1.5 text-sm">
          Sets the symbol and the decimal places every amount is shown with.
          Changeable later in Settings.
        </p>
      </header>

      {/*
        No autofocus here, unlike the other two steps.

        This step is a list to pick from with a sensible answer already
        selected, and opening the keyboard would cover the list with it -
        hiding the thing the step is for in order to offer a search nobody
        asked for yet.
      */}
      <div className="relative">
        <Search
          className="text-text-secondary pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search rupee, USD, €…"
          aria-label="Search currencies"
          className="pl-9"
        />
      </div>

      <div
        className="bg-surface divide-hairline max-h-[45dvh] divide-y overflow-y-auto overscroll-contain rounded-card border"
        role="radiogroup"
        aria-label="Currency"
      >
        {results.map((currency) => {
          const active = currency.code === selected.code;

          return (
            <button
              key={currency.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(currency)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 px-4 text-left",
                "duration-[120ms] transition-[background-color,box-shadow,border-color] motion-reduce:transition-none",
                // The chosen row carries the ink edge every other selected
                // thing in this app does, not just a change of background.
                active
                  ? "accent-sm bg-surface relative z-10"
                  : "hoverable:bg-surface-muted border border-transparent",
              )}
            >
              <span className="amount text-text-secondary w-9 shrink-0 text-base">
                {currency.symbol}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {currency.name}
                </span>
                <span className="text-text-secondary block text-xs">
                  {currency.code} ·{" "}
                  {currency.decimals === 0
                    ? "no decimals"
                    : `${currency.decimals} decimals`}
                </span>
              </span>
              {active ? (
                <Check
                  className="text-text size-5 shrink-0"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}

        {results.length === 0 ? (
          <p className="text-text-secondary px-4 py-8 text-center text-sm">
            No currency matches “{query}”.
          </p>
        ) : null}
      </div>
    </section>
  );
}
