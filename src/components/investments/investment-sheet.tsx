"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createInvestment, updateInvestment } from "@/actions/investments";
import { useCurrency } from "@/components/profile-provider";
import { AmountInput } from "@/components/shared/amount-input";
import { DatePicker } from "@/components/shared/date-picker";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Stepper } from "@/components/shared/stepper";
import { Tile } from "@/components/shared/tile";
import { TilePicker } from "@/components/shared/tile-picker";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { minorToAmountText } from "@/lib/amount";
import {
  CADENCE_LABELS,
  CADENCES,
  type Cadence,
  describeCadence,
  INVESTMENT_KINDS,
  type Investment,
  type InvestmentGoal,
  type InvestmentKind,
  KIND_META,
  nextInstallment,
} from "@/lib/investments";
import { occurrenceOn } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

type Ends = "never" | "count" | "date";

const KIND_OPTIONS = INVESTMENT_KINDS.map((kind) => ({
  id: kind,
  name: KIND_META[kind].label,
  icon: KIND_META[kind].icon,
  tint: KIND_META[kind].tint,
}));

/**
 * Make or edit an investment. What it asks follows the kind:
 *
 *   SIP, RD              the instalment and when it comes (always)
 *   PPF, EPF, NPS        the same, if "Repeats" is on; otherwise a first entry
 *   FD                   the deposit, then the maturity
 *   RD                   also the maturity
 *   everything else      what went in, and when
 *
 * The maturity figures are typed from the receipt. Nothing is calculated.
 */
export function InvestmentSheet({
  open,
  onOpenChange,
  investment,
  goals,
  today,
  defaultGoalId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null makes a new one. */
  investment: Investment | null;
  goals: InvestmentGoal[];
  today: string;
  /** A new investment from inside a goal's filter starts in that goal. */
  defaultGoalId?: string | null;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const editing = investment !== null;

  const [kind, setKind] = React.useState<InvestmentKind>("sip");
  const [name, setName] = React.useState("");
  const [goalId, setGoalId] = React.useState<string | null>(null);
  const [platform, setPlatform] = React.useState("");
  const [folio, setFolio] = React.useState("");
  const [note, setNote] = React.useState("");

  const [repeats, setRepeats] = React.useState(true);
  const [scheduleAmount, setScheduleAmount] = React.useState("");
  const [cadence, setCadence] = React.useState<Cadence>("monthly");
  const [firstDate, setFirstDate] = React.useState(today);
  const [ends, setEnds] = React.useState<Ends>("never");
  const [count, setCount] = React.useState("12");
  const [endDate, setEndDate] = React.useState("");

  const [rate, setRate] = React.useState("");
  const [tenure, setTenure] = React.useState("12");
  const [maturityDate, setMaturityDate] = React.useState("");
  // Until the user picks one, the maturity date follows the start and the
  // tenure: a 12-month FD from 28 Nov matures on 28 Nov next year.
  const [maturityTouched, setMaturityTouched] = React.useState(false);
  const [maturityAmount, setMaturityAmount] = React.useState("");

  const [firstAmount, setFirstAmount] = React.useState("");
  const [firstEntryDate, setFirstEntryDate] = React.useState(today);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [field, setField] = React.useState<string | null>(null);

  const investmentId = investment?.id ?? null;

  // Keyed on the id, so a revalidation underneath does not wipe a half-typed
  // form.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setField(null);

    if (!investment) {
      setKind("sip");
      setName("");
      setGoalId(defaultGoalId ?? null);
      setPlatform("");
      setFolio("");
      setNote("");
      setRepeats(true);
      setScheduleAmount("");
      setCadence("monthly");
      setFirstDate(today);
      setEnds("never");
      setCount("12");
      setEndDate("");
      setRate("");
      setTenure("12");
      setMaturityDate("");
      setMaturityTouched(false);
      setMaturityAmount("");
      setFirstAmount("");
      setFirstEntryDate(today);
      return;
    }

    const schedule = investment.schedule;
    setKind(investment.kind);
    setName(investment.name);
    setGoalId(investment.goalId);
    setPlatform(investment.platform ?? "");
    setFolio(investment.folio ?? "");
    setNote(investment.note ?? "");
    setRepeats(schedule !== null);
    setScheduleAmount(
      schedule ? minorToAmountText(BigInt(schedule.amount), currency.decimals) : "",
    );
    setCadence(schedule?.cadence ?? "monthly");
    // The schedule is re-anchored from its next instalment, so that is the
    // date to show, never the original start in the past.
    setFirstDate(nextInstallment(investment, today) ?? today);
    setEnds(schedule?.endDate ? "date" : "never");
    setCount(String(schedule?.installmentsTotal ?? 12));
    setEndDate(schedule?.endDate ?? "");
    setRate(investment.interestRate !== null ? String(investment.interestRate) : "");
    setTenure(String(investment.tenureMonths ?? 12));
    setMaturityDate(investment.maturityDate ?? "");
    setMaturityTouched(true);
    setMaturityAmount(
      investment.maturityAmount !== null
        ? minorToAmountText(BigInt(investment.maturityAmount), currency.decimals)
        : "",
    );
    setFirstAmount("");
    setFirstEntryDate(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investmentId]);

  const meta = KIND_META[kind];
  const hasSchedule =
    meta.schedule === "required" || (meta.schedule === "optional" && repeats);
  const isFd = kind === "fd";
  // What went in up front: an FD's deposit, a lump sum, what was already
  // held. Not for a schedule, whose instalments are the money in.
  const asksFirstEntry = !editing && !hasSchedule;

  const maturityStart = kind === "rd" ? firstDate : firstEntryDate;
  React.useEffect(() => {
    if (!meta.maturity || maturityTouched) return;
    const months = Number(tenure);
    if (!maturityStart || !Number.isInteger(months) || months < 1) return;
    setMaturityDate(
      occurrenceOn(
        { frequency: "monthly", interval: 1, startDate: maturityStart },
        months,
      ),
    );
  }, [meta.maturity, maturityTouched, maturityStart, tenure]);

  async function save() {
    setSaving(true);
    setError(null);
    setField(null);

    const schedule = hasSchedule
      ? {
          amount: scheduleAmount,
          // An RD is a monthly deposit, whatever was picked for a SIP first.
          cadence: kind === "rd" ? ("monthly" as const) : cadence,
          firstDate,
          ends,
          count: ends === "count" ? Number(count) : null,
          endDate: ends === "date" ? endDate || null : null,
        }
      : null;

    const maturity = meta.maturity
      ? {
          rate: rate.trim() || null,
          tenureMonths: tenure ? Number(tenure) : null,
          maturityDate,
          maturityAmount: maturityAmount.trim() || null,
        }
      : null;

    const details = {
      kind,
      name,
      goalId,
      platform,
      folio,
      note,
      schedule,
      maturity,
    };

    try {
      const result = investment
        ? await updateInvestment({ id: investment.id, ...details })
        : await createInvestment({
            ...details,
            firstEntry:
              asksFirstEntry && firstAmount.trim()
                ? { amount: firstAmount, date: firstEntryDate }
                : null,
          });

      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        toast.error(result.error);
        return;
      }

      if (investment) {
        toast.success("Saved. Past entries are unchanged.");
        onOpenChange(false);
        router.refresh();
        return;
      }

      const posted = "posted" in result.data ? Number(result.data.posted) : 0;
      toast.success(
        posted > 0
          ? `${name.trim()} added, with ${posted} ${posted === 1 ? "instalment" : "instalments"} up to today.`
          : `${name.trim()} added.`,
      );
      onOpenChange(false);
      router.push(`/investments/${result.data.id}`);
    } catch (thrown) {
      console.error("[investments]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    name.trim() !== "" &&
    (!hasSchedule ||
      (scheduleAmount.trim() !== "" &&
        firstDate !== "" &&
        (ends !== "date" || endDate !== ""))) &&
    (!meta.maturity || maturityDate !== "") &&
    (!isFd || editing || firstAmount.trim() !== "");

  const err = (name: string) => (field === name ? (error ?? undefined) : undefined);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit investment" : "New investment"}
      description={
        editing
          ? "Changes apply from the next instalment. Past entries stay."
          : "Track what goes in and what comes out."
      }
    >
      <SheetBody>
        {editing ? (
          <div className="flex items-center gap-3">
            <Tile tint={meta.tint} icon={meta.icon} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{meta.long}</p>
              <p className="text-text-secondary text-xs">
                The kind is fixed once made.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>
              Kind <span aria-hidden="true">*</span>
            </Label>
            <TilePicker
              label="Kind of investment"
              options={KIND_OPTIONS}
              value={kind}
              onChange={(next) => setKind(next as InvestmentKind)}
            />
          </div>
        )}

        <FormRow id="investment-name" label="Name" required error={err("name")}>
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={meta.example}
              maxLength={80}
            />
          )}
        </FormRow>

        {goals.length > 0 ? (
          <div className="space-y-1.5">
            <Label id="investment-goal-label">Goal</Label>
            <div
              role="radiogroup"
              aria-labelledby="investment-goal-label"
              className="flex flex-wrap gap-1.5"
            >
              {[...goals.map((goal) => ({ id: goal.id, name: goal.name })), { id: null, name: "No goal" }].map(
                (option) => {
                  const active = option.id === goalId;
                  return (
                    <button
                      key={option.id ?? "none"}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setGoalId(option.id)}
                      className={cn(
                        "pressable flex h-11 items-center rounded-full px-3.5 text-sm font-semibold",
                        "duration-[120ms] transition-[background-color,box-shadow,border-color] motion-reduce:transition-none",
                        active
                          ? "accent-sm bg-surface text-text"
                          : "bg-surface-muted text-text-secondary hoverable:bg-hairline border border-transparent",
                      )}
                    >
                      {option.name}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <FormRow id="investment-platform" label="Platform or bank" error={err("platform")}>
            {(props) => (
              <Input
                {...props}
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                placeholder="Groww"
                maxLength={60}
              />
            )}
          </FormRow>
          <FormRow id="investment-folio" label="Folio or account no." error={err("folio")}>
            {(props) => (
              <Input
                {...props}
                value={folio}
                onChange={(event) => setFolio(event.target.value)}
                placeholder="1234567/89"
                maxLength={60}
              />
            )}
          </FormRow>
        </div>

        {meta.schedule === "optional" ? (
          <div className="rounded-control flex items-center justify-between gap-3 border px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="investment-repeats">Repeats</Label>
              <p className="text-text-secondary mt-0.5 text-xs">
                Posts each instalment on its date.
              </p>
            </div>
            <Switch
              id="investment-repeats"
              checked={repeats}
              onCheckedChange={setRepeats}
            />
          </div>
        ) : null}

        {hasSchedule ? (
          <fieldset className="rounded-control space-y-3 border p-3">
            <legend className="px-1 text-sm font-semibold">
              {kind === "rd" ? "Monthly deposit" : "Instalment"}
            </legend>

            <FormRow
              id="investment-schedule-amount"
              label="Amount"
              required
              error={err("scheduleAmount")}
            >
              {(props) => (
                <AmountInput
                  {...props}
                  value={scheduleAmount}
                  onChange={setScheduleAmount}
                  placeholder="5000"
                />
              )}
            </FormRow>

            {kind === "rd" ? null : (
              <SegmentedControl
                label="How often"
                value={cadence}
                onChange={setCadence}
                options={CADENCES.map((value) => ({
                  value,
                  label: CADENCE_LABELS[value],
                }))}
              />
            )}

            <DatePicker
              id="investment-first-date"
              label={editing ? "Next instalment" : "First instalment"}
              required
              value={firstDate}
              onChange={setFirstDate}
              min={editing ? today : undefined}
              invalid={field === "firstDate"}
            />

            <div className="space-y-1.5">
              <Label id="investment-ends-label">Ends</Label>
              <SegmentedControl
                label="Ends"
                value={ends}
                onChange={setEnds}
                options={[
                  { value: "never", label: "Never" },
                  { value: "count", label: "After" },
                  { value: "date", label: "On a date" },
                ]}
              />
            </div>

            {ends === "count" ? (
              <FormRow id="investment-count" label="Instalments" required error={err("count")}>
                {(props) => (
                  <Stepper
                    id={props.id}
                    label="Number of instalments"
                    value={count}
                    onChange={setCount}
                    max={600}
                  />
                )}
              </FormRow>
            ) : null}

            {ends === "date" ? (
              <DatePicker
                id="investment-end-date"
                label="Last instalment"
                required
                value={endDate}
                onChange={setEndDate}
                min={firstDate || undefined}
                invalid={field === "endDate"}
              />
            ) : null}

            {firstDate && scheduleAmount ? (
              <p className="text-text-secondary text-xs" aria-live="polite">
                {describeCadence(kind === "rd" ? "monthly" : cadence, firstDate)}
                {!editing && firstDate <= today
                  ? ". Instalments up to today post as soon as you save."
                  : "."}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {asksFirstEntry ? (
          <fieldset className="rounded-control space-y-3 border p-3">
            <legend className="px-1 text-sm font-semibold">
              {isFd ? "Deposit" : "Money in"}
            </legend>
            <div className="space-y-3">
              <FormRow
                id="investment-first-amount"
                label="Amount"
                required={isFd}
                error={err("firstAmount") ?? err("firstEntry")}
              >
                {(props) => (
                  <AmountInput
                    {...props}
                    value={firstAmount}
                    onChange={setFirstAmount}
                    placeholder="25000"
                  />
                )}
              </FormRow>
              <DatePicker
                id="investment-first-entry-date"
                label="On"
                required
                value={firstEntryDate}
                onChange={setFirstEntryDate}
                max={today}
              />
            </div>
            {isFd ? null : (
              <p className="text-text-secondary text-xs">
                Held it before Paisa? Put in the total you invested and when
                you started. You can add more entries later.
              </p>
            )}
          </fieldset>
        ) : null}

        {meta.maturity ? (
          <fieldset className="rounded-control space-y-3 border p-3">
            <legend className="px-1 text-sm font-semibold">
              Maturity
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <FormRow id="investment-rate" label="Rate % a year" error={err("rate")}>
                {(props) => (
                  <Input
                    {...props}
                    value={rate}
                    onChange={(event) =>
                      setRate(event.target.value.replace(/[^\d.]/g, ""))
                    }
                    inputMode="decimal"
                    placeholder="7.1"
                    maxLength={6}
                  />
                )}
              </FormRow>
              <FormRow id="investment-tenure" label="Tenure in months">
                {(props) => (
                  <Stepper
                    id={props.id}
                    label="Tenure in months"
                    value={tenure}
                    onChange={setTenure}
                    max={600}
                  />
                )}
              </FormRow>
            </div>
            <div className="space-y-3">
              <DatePicker
                id="investment-maturity-date"
                label="Matures on"
                required
                value={maturityDate}
                onChange={(next) => {
                  setMaturityTouched(true);
                  setMaturityDate(next);
                }}
                invalid={field === "maturityDate" || field === "maturity"}
              />
              <FormRow
                id="investment-maturity-amount"
                label="Maturity amount"
                error={err("maturityAmount")}
              >
                {(props) => (
                  <AmountInput
                    {...props}
                    value={maturityAmount}
                    onChange={setMaturityAmount}
                    placeholder="From receipt"
                  />
                )}
              </FormRow>
            </div>
            {field === "maturityDate" || field === "maturity" ? (
              <p role="alert" className="text-expense text-sm">
                {error}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <FormRow id="investment-note" label="Note" error={err("note")}>
          {(props) => (
            <Input
              {...props}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nominee: Asha"
              maxLength={500}
            />
          )}
        </FormRow>

        {(field === "firstDate" || field === "endDate" || field === "schedule") && error ? (
          <p role="alert" className="text-expense text-sm">
            {error}
          </p>
        ) : null}
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
          disabled={saving || !canSave}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          {editing ? "Save" : "Add investment"}
        </Button>
      </SheetFooter>
    </ResponsiveSheet>
  );
}
