"use client";

import * as React from "react";

import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { SavedTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/lib/action-result";
import type {
  EntryDefaults,
  PartOfDay,
  QuickAdd,
} from "@/lib/queries/accounts";
import { useCurrency } from "@/components/profile-provider";
import { AmountKeypad } from "@/components/records/amount-keypad";
import { EditScopeDialog } from "@/components/records/edit-scope-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { evaluate } from "@/lib/calculator";
import { nowLocal } from "@/lib/dates";
import { formatWith } from "@/lib/money";
import { PRESSABLE, useShake } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ColorDot } from "@/components/shared/color-dot";

export type { AccountOption, CategoryOption };

/** What lives behind "More options", so an error there can open it. */
const FOLDED_FIELDS = new Set([
  "occurredAt",
  "note",
  "repeat",
  "frequency",
  "interval",
  "endDate",
]);

/** How the suggestion row introduces itself. */
const PART_OF_DAY_LABEL: Record<PartOfDay, string> = {
  morning: "in the morning",
  afternoon: "in the afternoon",
  evening: "in the evening",
  night: "at night",
};

/** What the sheet is editing, if anything. */
export type RecordDraft = {
  id: string;
  /**
   * `edit` changes the record `id` points at; `copy` uses it as a starting
   * point for a new one.
   *
   * On the draft rather than as a separate prop because it travels with the
   * data: a sheet that has the values but not the intent is one `title` away
   * from offering Delete on a record that does not exist yet.
   */
  mode?: "edit" | "copy";
  type: TransactionType;
  /** Minor units as text. */
  amount: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string | null;
  /** Local `yyyy-mm-ddThh:mm`. */
  occurredAtLocal: string;
  /** Set when a recurring rule created this record. */
  recurringRuleId?: string | null;
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
    /** Push the same change onto the rule that created this record. */
    applyToRule?: boolean;
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
  defaultType = "expense",
  defaultAmountText = "",
  onSubmit,
  onDelete,
  timeZone,
  entryDefaults,
  quickAdds = [],
  noteHints = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  /** Omitted when adding. */
  draft?: RecordDraft | null;
  /** Which tab a new record starts on. Ignored while editing. */
  defaultType?: TransactionType;
  defaultAmountText?: string;
  onSubmit: RecordSubmit;
  /** Only offered while editing. Undo lives in the toast it raises. */
  onDelete?: (id: string) => void | Promise<void>;
  timeZone: string;
  /** The account last used, and the categories usual at this hour. */
  entryDefaults?: EntryDefaults;
  /** One-tap chips for the things this person buys over and over. */
  quickAdds?: QuickAdd[];
  /** Notes written before, offered as you type. */
  noteHints?: string[];
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
  const [frequency, setFrequency] = React.useState<
    RecurrenceFrequency | "none"
  >("none");
  const [interval, setInterval] = React.useState("1");
  const [endDate, setEndDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const [shaking, shake] = useShake();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  /**
   * What the sheet was opened with.
   *
   * Compared against rather than a `dirty` flag set by every onChange: a
   * flag set on the first keystroke stays set after the value is typed back
   * to what it was, and then asks somebody to confirm discarding nothing.
   */
  const opened = React.useRef<string>("");

  // A copy starts from a record but is not one, so it has no id to update.
  const copying = editing?.mode === "copy";
  const editingId = editing && !copying ? editing.id : null;

  // Reset when the sheet opens, or when it is pointed at a different record.
  // Keyed on the id rather than the object, so a refresh underneath does not
  // wipe what is being typed.
  React.useEffect(() => {
    if (!open) return;

    setType(editing?.type ?? defaultType);
    setAmount(
      editing
        ? minorToText(editing.amount, currency.decimals)
        : defaultAmountText,
    );
    setAccountId(
      editing?.accountId ??
        entryDefaults?.lastAccountId ??
        accounts[0]?.id ??
        "",
    );
    setToAccountId(editing?.toAccountId ?? "");
    setCategoryId(editing?.categoryId ?? "");
    setNote(editing?.note ?? "");
    setOccurredAt(editing?.occurredAtLocal ?? nowLocal(timeZone));
    setFrequency("none");
    setInterval("1");
    setEndDate("");
    setError(null);
    setErrorField(null);
    setScopeOpen(false);
    setMoreOpen(
      Boolean(
        editing &&
        (editing.note ||
          editing.recurringRuleId ||
          editing.occurredAtLocal.slice(0, 10) !==
            nowLocal(timeZone).slice(0, 10)),
      ),
    );
    setDiscardOpen(false);

    // Snapshot taken from the same values that were just set, not from
    // state — state has not updated yet inside this effect.
    opened.current = snapshot({
      type: editing?.type ?? defaultType,
      amount: editing
        ? minorToText(editing.amount, currency.decimals)
        : defaultAmountText,
      accountId:
        editing?.accountId ??
        entryDefaults?.lastAccountId ??
        accounts[0]?.id ??
        "",
      toAccountId: editing?.toAccountId ?? "",
      categoryId: editing?.categoryId ?? "",
      note: editing?.note ?? "",
      occurredAt: editing?.occurredAtLocal ?? nowLocal(timeZone),
      frequency: "none",
      interval: "1",
      endDate: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId]);

  const changed =
    opened.current !== "" &&
    opened.current !==
      snapshot({
        type,
        amount,
        accountId,
        toAccountId,
        categoryId,
        note,
        occurredAt,
        frequency,
        interval,
        endDate,
      });

  /**
   * Closing, with a question if there is something to lose.
   *
   * A sheet is dismissed by swiping it down or tapping the backdrop, both of
   * which are easy to do by accident on a phone and neither of which looks
   * like "throw this away". Opening is never intercepted, and nor is closing
   * an untouched sheet — a confirmation nobody needed is how people learn to
   * dismiss confirmations without reading them.
   */
  function requestClose(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }

    if (changed && !saving) {
      setDiscardOpen(true);
      return;
    }

    onOpenChange(false);
  }

  // A hidden field cannot be corrected. Every field inside the fold, not
  // only the date: a collapsed section with the error in it is a form that
  // refuses to save and will not say why.
  React.useEffect(() => {
    if (errorField && FOLDED_FIELDS.has(errorField)) setMoreOpen(true);
  }, [errorField]);

  const visibleCategories = categories.filter(
    (category) => category.kind === (type === "income" ? "income" : "expense"),
  );

  /**
   * The categories usually picked at this hour, in order.
   *
   * Only for a new expense: editing already has its category, and income has
   * too few categories for a shortcut to shorten anything.
   */
  const suggestions =
    editing || type !== "expense"
      ? []
      : (entryDefaults?.suggestedCategoryIds ?? [])
          .map((id) => visibleCategories.find((category) => category.id === id))
          .filter((category): category is CategoryOption => Boolean(category))
          .slice(0, 4);

  /*
   * The wording comes from the same decision the categories did, which was
   * made in the profile's timezone. Reading the device's clock here would
   * caption an evening row "in the morning" on the first day of a trip.
   */
  const partOfDay = PART_OF_DAY_LABEL[entryDefaults?.partOfDay ?? "night"];

  /*
   * The result, spelled out on the button.
   *
   * "Save" asks you to remember what you typed; "Save expense · ₹450" shows
   * you. It is the last thing anybody reads before committing, and it is the
   * cheapest place to catch a mistyped amount. Falls back to the plain verb
   * while there is no usable amount yet, so the button never reads
   * "Save expense · ₹0".
   */
  const amountSum = evaluate(amount || "0", currency.decimals);
  const amountLabel =
    amountSum.ok && amountSum.minor > 0n
      ? formatWith(currency, amountSum.minor, {
          signDisplay: "never",
          // Whole rupees on a button, the same as on the chips: the paise
          // are in the field directly above it.
          whole: true,
        })
      : null;

  const toAccountName = accounts.find(
    (account) => account.id === toAccountId,
  )?.name;

  const saveLabel = editing
    ? "Save changes"
    : type === "transfer"
      ? amountLabel && toAccountName
        ? `Move ${amountLabel} to ${toAccountName}`
        : "Save transfer"
      : amountLabel
        ? `Save ${type} · ${amountLabel}`
        : `Save ${type}`;

  /** Whether the field this error belongs to is on screen to show it. */
  const errorShownInline =
    errorField === "amount" ||
    errorField === "accountId" ||
    (errorField === "toAccountId" && type === "transfer") ||
    (errorField === "categoryId" && type !== "transfer") ||
    (errorField === "occurredAt" && moreOpen);

  /** What is folded away, so the row says whether it is worth opening. */
  const moreSummary = [
    occurredAt.slice(0, 10) === nowLocal(timeZone).slice(0, 10)
      ? null
      : "dated",
    note.trim() ? "note" : null,
    frequency === "none" ? null : "repeats",
  ]
    .filter(Boolean)
    .join(" · ");

  /**
   * What is still missing, in the order the sheet asks for it.
   *
   * The Save button used to be disabled until everything was filled in,
   * which is a dead end: a button that does nothing never says why. It is
   * live now, and pressing it points at the first thing that is not ready.
   */
  function firstProblem(): { field: string; message: string } | null {
    const sum = evaluate(amount || "0", currency.decimals);

    if (amount.trim() === "" || (sum.ok && sum.minor <= 0n)) {
      return { field: "amount", message: "Enter an amount first." };
    }

    if (!sum.ok) return { field: "amount", message: sum.error };

    if (!accountId) {
      return {
        field: "accountId",
        message:
          type === "transfer"
            ? "Choose where it came from."
            : "Choose an account.",
      };
    }

    if (type === "transfer" && !toAccountId) {
      return { field: "toAccountId", message: "Choose where it went." };
    }

    if (type !== "transfer" && !categoryId) {
      return { field: "categoryId", message: "Choose a category." };
    }

    return null;
  }

  /**
   * Save, or ask the one question that has to come first.
   *
   * Editing a record that belongs to a rule asks whether the change is for
   * this one or for every future one. That question is only worth asking if
   * the form is actually saveable — otherwise somebody answers it and then
   * gets told the amount is missing.
   */
  function requestSave() {
    const problem = firstProblem();

    if (problem) {
      setError(problem.message);
      setErrorField(problem.field);
      if (problem.field === "amount") shake();
      return;
    }

    if (editing?.recurringRuleId) {
      setScopeOpen(true);
      return;
    }

    void save(false);
  }

  async function save(andAnother: boolean, applyToRule = false) {
    const problem = firstProblem();

    if (problem) {
      setError(problem.message);
      setErrorField(problem.field);
      if (problem.field === "amount") shake();
      return;
    }

    setSaving(true);
    setError(null);
    setErrorField(null);

    try {
      const result = await onSubmit(
        {
          type,
          amount,
          accountId,
          toAccountId: type === "transfer" ? toAccountId || null : null,
          categoryId: type === "transfer" ? null : categoryId || null,
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
          applyToRule,
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

      if (result.data.ruleSaved === false) {
        toast.warning(
          "The record was saved, but the recurring rule was not. Edit it from Recurring.",
        );
      } else if (result.data.ruleSaved === true) {
        toast.success("Saved — future occurrences updated too");
      }

      if (andAnother) {
        // Keep the type, account and date; clear what is specific to the
        // record just saved, so a run of receipts is a few taps each. No
        // toast of its own: the shared one already names what was saved, and
        // the cleared amount says the sheet is ready for the next.
        setAmount("");
        setNote("");
        setError(null);
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

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={requestClose}
      title={editingId ? "Edit record" : "Add record"}
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

        {!editing && quickAdds.length > 0 && type === "expense" ? (
          <div className="space-y-1.5">
            <Label id="quick-add-label">Quick add</Label>
            <div
              role="group"
              aria-labelledby="quick-add-label"
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
            >
              {quickAdds.map((quick) => (
                <button
                  key={`${quick.categoryId}-${quick.amount}-${quick.accountId}`}
                  type="button"
                  onClick={() => {
                    // Fills the form rather than saving: the amount is the
                    // usual one, not necessarily today's one, and the whole
                    // point is that it can still be edited.
                    setAmount(minorToText(quick.amount, currency.decimals));
                    setCategoryId(quick.categoryId);
                    setAccountId(quick.accountId);
                    setError(null);
                    setErrorField(null);
                  }}
                  className={cn(
                    PRESSABLE,
                    "hoverable:bg-muted/60 focus-visible:ring-ring flex h-11 shrink-0 items-center gap-2 rounded-full border pr-3 pl-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  )}
                >
                  <ColorDot color={quick.color} icon={quick.icon} size="sm" />
                  <span className="font-semibold">{quick.name}</span>
                  <span className="amount text-ink-2">
                    {formatWith(currency, BigInt(quick.amount), {
                      signDisplay: "never",
                      whole: true,
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <AmountKeypad
          value={amount}
          onChange={setAmount}
          tone={type}
          focusOnOpen={!editing}
          invalid={errorField === "amount"}
          error={errorField === "amount" ? (error ?? undefined) : undefined}
          shaking={shaking}
          onEnter={() => {
            if (saving) return;
            void requestSave();
          }}
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
              error={
                errorField === "toAccountId" ? (error ?? undefined) : undefined
              }
            />
          </>
        ) : (
          <>
            {suggestions.length > 0 ? (
              <div className="space-y-1.5">
                <Label id="suggested-label">Usually {partOfDay}</Label>
                <div
                  role="group"
                  aria-labelledby="suggested-label"
                  className="flex flex-wrap gap-1.5"
                >
                  {suggestions.map((category) => {
                    const active = category.id === categoryId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setCategoryId(category.id)}
                        className={cn(
                          "focus-visible:ring-ring flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                          active
                            ? "border-primary bg-primary/5"
                            : "text-muted-foreground hoverable:bg-muted/60",
                        )}
                      >
                        <ColorDot
                          color={category.color}
                          icon={category.icon}
                          size="sm"
                        />
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <CategoryGrid
              categories={visibleCategories}
              value={categoryId}
              onChange={setCategoryId}
              error={
                errorField === "categoryId" ? (error ?? undefined) : undefined
              }
            />

            <AccountSelect
              id="account"
              label="Account"
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              error={
                errorField === "accountId" ? (error ?? undefined) : undefined
              }
            />
          </>
        )}

        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="more-options"
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            PRESSABLE,
            "hoverable:bg-muted/60 focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <span className="flex-1 text-left">More options</span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            {moreSummary}
          </span>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 shrink-0 duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-safe:transition-transform motion-reduce:transition-none",
              moreOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        <div id="more-options" hidden={!moreOpen} className="space-y-4">
          <FormRow
            id="occurred-at"
            label="When"
            error={
              errorField === "occurredAt" ? (error ?? undefined) : undefined
            }
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
              <>
                <Input
                  {...props}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Swiggy — team lunch"
                  maxLength={500}
                  // A native datalist rather than a combobox we built.
                  // Notes repeat far more than people expect, and retyping
                  // one on a phone keyboard is most of the effort of
                  // logging the record. The browser's own suggestion UI
                  // costs nothing to hydrate, is keyboard-operable
                  // everywhere, and - unlike a popup of our own - cannot
                  // cover the Save button on a short screen.
                  list={noteHints.length ? "note-hints" : undefined}
                  autoComplete="off"
                />
                {noteHints.length ? (
                  <datalist id="note-hints">
                    {noteHints.map((hint) => (
                      <option key={hint} value={hint} />
                    ))}
                  </datalist>
                ) : null}
              </>
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
                        "focus-visible:ring-ring h-9 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hoverable:bg-muted",
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
        </div>

        {/*
          The catch-all, for any error with nowhere else to appear.

          Which fields have a slot depends on what is on screen: a transfer
          has no category, an expense has no second account, and the date
          lives behind "More options". Asking whether this error's field is
          actually being rendered — rather than whether it is on a list of
          fields that usually are — is what stops a save refusing silently.
        */}
        {error && !errorShownInline ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        {editingId && onDelete ? (
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
                void onDelete(editingId);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete record
            </Button>
          </div>
        ) : null}
      </SheetBody>

      {/* One row even at 360px: stacked, the two buttons cost a whole row of
          categories on a short screen, and the labels are short enough to
          share. */}
      <SheetFooter className="gap-2">
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
              onClick={requestSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              {saveLabel}
            </Button>
          </>
        ) : (
          <>
            {/*
              One primary, full width, saying what it will do. The run-of-
              receipts shortcut keeps its place beside it as an icon: it is
              the rarer action, and spelling it out cost the primary button
              the room to name the amount.
            */}
            <Button
              variant="outline"
              size="icon-touch"
              aria-label="Save and add another"
              onClick={() => void save(true)}
              disabled={saving}
            >
              <Plus className="size-5" aria-hidden="true" />
            </Button>
            <Button
              size="touch"
              className="min-w-0 flex-1"
              onClick={() => void save(false)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              <span className="truncate">{saveLabel}</span>
            </Button>
          </>
        )}
      </SheetFooter>

      <EditScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        pending={saving}
        onChoose={(applyToRule) => {
          setScopeOpen(false);
          void save(false, applyToRule);
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard changes?"
        description={
          editingId
            ? "Your edits to this record will not be saved."
            : "This record has not been saved yet."
        }
        confirmLabel="Discard"
        onConfirm={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </ResponsiveSheet>
  );
}

/**
 * Every field that can be typed, as one comparable string.
 *
 * Trimmed, because trailing whitespace in a note is not a change worth
 * stopping somebody over, and ordered explicitly so the comparison does not
 * depend on key order.
 */
function snapshot(values: {
  type: string;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  note: string;
  occurredAt: string;
  frequency: string;
  interval: string;
  endDate: string;
}): string {
  return [
    values.type,
    values.amount.trim(),
    values.accountId,
    values.toAccountId,
    values.categoryId,
    values.note.trim(),
    values.occurredAt,
    values.frequency,
    values.interval,
    values.endDate,
  ].join("\u0000");
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
