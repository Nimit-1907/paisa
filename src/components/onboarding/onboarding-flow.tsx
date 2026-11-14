"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { ArrowLeft, Check, Loader2, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  completeOnboarding,
  refreshAfterOnboarding,
} from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
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

export function OnboardingFlow({
  initialName,
  initialAccountName,
}: {
  initialName: string;
  initialAccountName: string;
}) {
  const router = useRouter();

  const [step, setStep] = React.useState<Step>(0);
  const [displayName, setDisplayName] = React.useState(initialName);
  const [currency, setCurrency] = React.useState<Currency>(DEFAULT_CURRENCY);
  const [accountName, setAccountName] = React.useState(initialAccountName);
  const [openingBalance, setOpeningBalance] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const openingMinor = openingBalance
    ? tryToMinor(openingBalance, currency.decimals)
    : 0n;

  function next() {
    if (step === 0 && displayName.trim().length === 0) {
      setError("Tell us what to call you.");
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, 2) as Step);
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0) as Step);
  }

  /*
   * The app shell is cached from before setup finished, so it still holds
   * the old name and currency. Thrown away the moment the welcome screen
   * appears rather than when its button is pressed — somebody might leave
   * this screen another way, and a stale shell would follow them.
   *
   * Invalidating the cache does not re-render this page; only a refresh
   * would, and that is what would have taken this screen away.
   */
  const shellRefreshed = React.useRef<Promise<unknown> | null>(null);

  React.useEffect(() => {
    if (step !== 3 || shellRefreshed.current) return;

    shellRefreshed.current = refreshAfterOnboarding().catch(
      (thrown: unknown) => console.error("[onboarding]", thrown),
    );
  }, [step]);

  async function finish() {
    if (openingMinor === null) {
      setError("That opening balance is not a number.");
      return;
    }

    setSaving(true);

    try {
      const result = await completeOnboarding({
        displayName,
        currencyCode: currency.code,
        accountName,
        openingBalance,
      });

      if (!result.ok) {
        setError(result.error);
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
      const message = "Could not save your setup. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <ol
        className={cn("mb-8 flex items-center gap-2", step === 3 && "hidden")}
        aria-label="Setup progress"
      >
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-2 block text-xs font-semibold",
                index === step ? "text-foreground" : "text-muted-foreground",
              )}
              aria-current={index === step ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="space-y-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">
              First, your name
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Only used to greet you — nobody else sees it.
            </p>
          </header>

          <FormRow id="displayName" label="Your name" error={error ?? undefined}>
            {(field) => (
              <Input
                {...field}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- this step has just replaced the one before it, so focus has to land somewhere.
                autoFocus
                placeholder="Nimit"
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
            <h1 className="text-2xl font-semibold tracking-tight">
              Your first account
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Every record is booked against an account. You can add banks,
              cards and wallets later.
            </p>
          </header>

          <div className="bg-card space-y-4 rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <Wallet className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Created for you at signup</p>
                <p className="text-muted-foreground text-xs">
                  Rename it or set what is in it right now.
                </p>
              </div>
            </div>

            <FormRow id="accountName" label="Account name">
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
              error={error ?? undefined}
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
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-base">
                    {currency.symbol}
                  </span>
                  <Input
                    {...field}
                    value={openingBalance}
                    onChange={(event) => setOpeningBalance(event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className="amount pl-9"
                  />
                </div>
              )}
            </FormRow>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="text-center">
          <span className="bg-income-soft text-income mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl">
            <Check className="size-7" aria-hidden="true" />
          </span>

          <h2 className="text-2xl font-semibold tracking-tight">
            You are set up, {displayName.trim()}.
          </h2>

          <p className="text-muted-foreground mt-2 text-sm">
            Tracking in {currency.name} ({currency.symbol}), starting with{" "}
            {accountName.trim() || "your first account"}.
          </p>

          <div className="pb-safe mt-8">
            <Button
              type="button"
              size="touch"
              className="w-full"
              onClick={() => {
                void (async () => {
                  // Tapping straight away would otherwise race the effect
                  // above and navigate into the very cache it is clearing.
                  await shellRefreshed.current;

                  // Straight into the sheet: the next thing to do is the
                  // whole point of the app, and a screen with a button on
                  // it is one more decision than it needs.
                  router.replace("/records?add=1");
                })();
              }}
            >
              Add your first expense
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? null : (
      <div className="pb-safe mt-8 flex gap-2">
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
          <Button type="button" size="touch" className="flex-1" onClick={next}>
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
      </div>
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Which currency?
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Sets the symbol and the decimal places every amount is shown with.
          Changeable later in Settings.
        </p>
      </header>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
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
        className="bg-card divide-border max-h-[45dvh] divide-y overflow-y-auto overscroll-contain rounded-2xl border"
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
                  "hoverable:bg-muted/60 focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  active && "bg-primary/5",
                )}
              >
                <span className="amount text-muted-foreground w-9 shrink-0 text-base">
                  {currency.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {currency.name}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {currency.code} ·{" "}
                    {currency.decimals === 0
                      ? "no decimals"
                      : `${currency.decimals} decimals`}
                  </span>
                </span>
                {active ? (
                  <Check className="text-primary size-5 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
          );
        })}

        {results.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            No currency matches “{query}”.
          </p>
        ) : null}
      </div>
    </section>
  );
}
