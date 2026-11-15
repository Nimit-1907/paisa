"use client";

import * as React from "react";

import {
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  ListPlus,
  Loader2,
  Pencil,
  Repeat,
  Trash2,
  TriangleAlert,
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
import { AmountDisplay } from "@/components/records/amount-field";
import { Amount } from "@/components/shared/amount";
import { EditScopeDialog } from "@/components/records/edit-scope-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  type AccountOption,
  AccountField,
  type CategoryOption,
  CategoryGrid,
  TypeTabs,
  WhenField,
} from "@/components/shared/entry-pickers";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
  SheetHead,
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
import { describeLocal, nowLocal } from "@/lib/dates";
import { balanceAfterTransfer } from "@/lib/overdraw";
import { formatWith } from "@/lib/money";
import { PRESSABLE, useShake } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/shared/tile";

export type { AccountOption, CategoryOption };

/**
 * What lives behind "More options", so an error there can open it.
 *
 * Three fields shorter since Phase 14: the note, the account and the date
 * are on the sheet itself now.
 */
const FOLDED_FIELDS = new Set(["repeat", "frequency", "interval", "endDate"]);

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
  balancesKnown = true,
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
  /** False when the balance lookup failed, so the overdraw check cannot run. */
  balancesKnown?: boolean;
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
  // "Saved ✓" on the button, for the run-of-receipts path where the sheet
  // stays open and the cleared amount is otherwise the only acknowledgement.
  const [justSaved, setJustSaved] = React.useState(false);
  // Shared by the amount and the keypad, which are no longer next to each
  // other: tapping a key has to put the caret back in the field above.
  const amountRef = React.useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

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
    // Nothing but Repeat is folded now, and Repeat is never pre-set.
    setMoreOpen(false);
    setDiscardOpen(false);
    setDeleteOpen(false);
    setJustSaved(false);

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

  // 1.2s, then the button goes back to naming what it will do. Not a
  // transition on the label: the word has to change, and a word that
  // changes is a timer either way.
  React.useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 1200);
    return () => window.clearTimeout(id);
  }, [justSaved]);

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
   * The grid, with the usual ones first.
   *
   * Phase 13 gave the suggestions a labelled chip row of their own above
   * the grid. The reference has one grid, and two rows of the same tiles
   * asking the same question was the thing people hesitated over in the
   * screenshots: the second row looks like a different set. Sorting them to
   * the front keeps the shortcut — the first four tiles are the four it
   * would have offered — and the grid's hint says why they are there.
   */
  const suggestedIds = new Set(suggestions.map((category) => category.id));
  const gridCategories =
    suggestions.length === 0
      ? visibleCategories
      : [
          ...suggestions,
          ...visibleCategories.filter(
            (category) => !suggestedIds.has(category.id),
          ),
        ];

  /** "Today, 1:30 pm" — what the When card shows over its native input. */
  const whenLabel = describeLocal(occurredAt, nowLocal(timeZone));

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

  /**
   * Whether this transfer takes the From account below zero.
   *
   * Null unless there is a balance to check, an amount that parses, and a
   * transfer to check it against — there is nothing useful to say about an
   * account whose balance this screen was never given.
   */
  const overdraw = React.useMemo(() => {
    if (type !== "transfer") return null;

    const from = accounts.find((account) => account.id === accountId);
    if (!from || from.balance === null || from.balance === undefined) {
      return null;
    }

    const sum = evaluate(amount || "0", currency.decimals);
    if (!sum.ok || sum.minor <= 0n) return null;

    const balance = BigInt(from.balance);

    // Only when this is the same account the transfer already came out of:
    // a transfer moved here from somewhere else never touched this balance,
    // so there is nothing to put back. See src/lib/overdraw.ts.
    const original =
      editing && editing.mode !== "copy" && editing.accountId === accountId
        ? BigInt(editing.amount)
        : null;

    const after = balanceAfterTransfer({
      balance,
      amount: sum.minor,
      original,
    });
    if (after >= 0n) return null;

    // What it "has" is the balance without this transfer in it, so the two
    // figures in the sentence are measured the same way.
    const held = original === null ? balance : balance + original;

    return { name: from.name, balance: held, after };
  }, [type, accounts, accountId, amount, currency.decimals, editing]);

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
    errorField === "occurredAt" ||
    (errorField === "accountId" && type !== "transfer") ||
    (errorField === "toAccountId" && type === "transfer") ||
    (errorField === "categoryId" && type !== "transfer");

  /** What is folded away, so the row says whether it is worth opening. */
  const moreSummary =
    frequency === "none" ? "" : `Repeats ${REPEAT_LABELS[frequency]}`;

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
        toast.success("Saved. Future occurrences updated too.");
      }

      if (andAnother) {
        // Keep the type, account and date; clear what is specific to the
        // record just saved, so a run of receipts is a few taps each. No
        // toast of its own: the shared one already names what was saved, and
        // the cleared amount says the sheet is ready for the next.
        setAmount("");
        setNote("");
        setError(null);
        setJustSaved(true);
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
      {/*
        The type and the amount do not scroll.

        They are what the keypad at the bottom is editing, and a keypad whose
        display has scrolled off the top is a calculator with no screen.
      */}
      <SheetHead>
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

        {/*
          The amount, the note, then what it was.

          Phase 14 reorders the sheet to the reference's order, which is the
          order the sentence comes out in: four hundred and fifty, for lunch
          with the team, on Food, from HDFC, today. The keypad moves to the
          bottom, below everything it is not about.
        */}
        <AmountDisplay
          value={amount}
          onChange={setAmount}
          tone={type}
          focusOnOpen={!editing}
          invalid={errorField === "amount"}
          error={errorField === "amount" ? (error ?? undefined) : undefined}
          shaking={shaking}
          inputRef={amountRef}
          onEnter={() => {
            if (saving) return;
            void requestSave();
          }}
        />
      </SheetHead>

      {/* A notch tighter where the sheet is fighting for room: at 780px
          those four pixels a gap are what put the second row of categories
          on screen instead of three pixels below it. */}
      <SheetBody
        fill
        className="space-y-3 [@media(max-height:780px)]:space-y-2"
      >
        <div className="relative">
          <Pencil
            className="text-text-secondary pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="note"
            aria-label="Note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Lunch with the team"
            maxLength={500}
            // A native datalist rather than a combobox we built. Notes
            // repeat far more than people expect, and retyping one on a
            // phone keyboard is most of the effort of logging the record.
            // The browser's own suggestion UI costs nothing to hydrate, is
            // keyboard-operable everywhere, and — unlike a popup of our own
            // — cannot cover the Save button on a short screen.
            list={noteHints.length ? "note-hints" : undefined}
            autoComplete="off"
            className="h-11 pl-9"
          />
          {noteHints.length ? (
            <datalist id="note-hints">
              {noteHints.map((hint) => (
                <option key={hint} value={hint} />
              ))}
            </datalist>
          ) : null}
        </div>

        {!editing && quickAdds.length > 0 && type === "expense" ? (
          /*
            No visible "Quick add" heading.

            The chips say what they are — a category, an amount, one tap —
            and at 360×800 the sheet is 24px short of showing a second row
            of categories. A label that explains chips is worth less than a
            row of the thing they are a shortcut to. The group keeps the
            name for a screen reader.
          */
          <div>
            <div
              role="group"
              aria-label="Quick add"
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0"
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
                    "bg-surface-muted hoverable:bg-hairline flex h-11 shrink-0 items-center gap-2 rounded-full pr-3 pl-1.5 text-sm",
                  )}
                >
                  <Tile tint={quick.tint} icon={quick.icon} size="sm" />
                  <span className="font-semibold">{quick.name}</span>
                  <span className="amount text-text-secondary">
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

        {type === "transfer" ? (
          <>
            {/*
              From, swap, To — one row.

              Picking the wrong way round is the mistake people make on this
              screen, and correcting it meant two pickers and four taps. The
              swap sits between the two cards it swaps, disabled until both
              are chosen: swapping one account with nothing is not a thing
              anybody means.
            */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <AccountField
                id="from-account"
                label="From"
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
              />

              <Button
                type="button"
                variant="outline"
                size="icon-touch"
                aria-label="Swap the two accounts"
                disabled={!accountId || !toAccountId}
                onClick={() => {
                  const from = accountId;
                  setAccountId(toAccountId);
                  setToAccountId(from);
                }}
              >
                <ArrowUpDown className="size-4" aria-hidden="true" />
              </Button>

              <AccountField
                id="to-account"
                label="To"
                accounts={accounts.filter(
                  (account) => account.id !== accountId,
                )}
                value={toAccountId}
                onChange={setToAccountId}
                invalid={errorField === "toAccountId"}
              />
            </div>

            {(errorField === "toAccountId" || errorField === "occurredAt") &&
            error ? (
              <p role="alert" className="text-expense text-sm">
                {error}
              </p>
            ) : null}

            <WhenField
              value={occurredAt}
              onChange={setOccurredAt}
              display={whenLabel}
              invalid={errorField === "occurredAt"}
            />

            {/*
              A warning, not a block.

              An account can legitimately go below zero — a credit card is
              negative by definition, and a balance can be out of date
              because a record has not been entered yet. Refusing the
              transfer would make this app argue with reality; saying so and
              letting it through is the honest version.
            */}
            {/*
              "Nobody checked" is not "nothing to worry about".

              When the balance lookup failed, staying quiet would look
              exactly like an account with plenty in it. Said once, where
              the warning would have been.
            */}
            {!balancesKnown && accountId ? (
              <p
                role="status"
                className="bg-surface-muted text-text-secondary rounded-control px-3 py-2 text-xs font-medium"
              >
                Balances could not be loaded, so this will not warn you if the
                account is short.
              </p>
            ) : null}

            {overdraw ? (
              <p
                role="status"
                className="bg-tint-butter text-text rounded-control flex items-start gap-2 px-3 py-2 text-xs font-medium"
              >
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {/* `auto`, not `never`: a credit card is negative, and
                      "has ₹500" for an account at −₹500 states a debt as
                      money held. */}
                  {overdraw.name} has{" "}
                  <Amount value={overdraw.balance} signDisplay="auto" />. This
                  takes it to{" "}
                  <Amount value={overdraw.after} signDisplay="auto" />.
                </span>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <CategoryGrid
              categories={gridCategories}
              value={categoryId}
              onChange={setCategoryId}
              hint={suggestions.length > 0 ? `Usually ${partOfDay}` : undefined}
              error={
                errorField === "categoryId" ? (error ?? undefined) : undefined
              }
            />

            <div className="grid grid-cols-2 gap-2">
              <AccountField
                id="account"
                label="Account"
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                invalid={errorField === "accountId"}
              />

              <WhenField
                value={occurredAt}
                onChange={setOccurredAt}
                display={whenLabel}
                invalid={errorField === "occurredAt"}
              />
            </div>

            {(errorField === "accountId" || errorField === "occurredAt") &&
            error ? (
              <p role="alert" className="text-expense text-sm">
                {error}
              </p>
            ) : null}
          </>
        )}

        {/*
          What is left behind the fold.

          The note, the account and the date came out from under it in
          Phase 14 — a form that hides three of its five fields is a form
          people fill in twice. Repeat is all that stays, because it turns
          one record into a standing instruction and belongs nowhere near
          the thing you tap by reflex. Nothing is folded while editing, so
          the row itself goes.
        */}
        {editing ? null : (
          <>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="more-options"
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                PRESSABLE,
                "hoverable:bg-surface-muted rounded-control flex min-h-11 w-full items-center gap-2 border px-3 text-sm font-semibold",
              )}
            >
              <span className="flex-1 text-left">More options</span>
              <span className="text-text-secondary truncate text-xs font-normal">
                {moreSummary}
              </span>
              <ChevronDown
                className={cn(
                  "text-text-secondary size-4 shrink-0 duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-safe:transition-transform motion-reduce:transition-none",
                  moreOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>

            <div id="more-options" hidden={!moreOpen}>
              <div className="space-y-2 rounded-control border p-3">
                <div className="flex items-center gap-2">
                  <Repeat
                    className="text-text-secondary size-4 shrink-0"
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
                  {(["none", ...RECURRENCE_FREQUENCIES] as const).map(
                    (value) => {
                      const active = frequency === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setFrequency(value)}
                          className={cn(
                            "rounded-segment pressable flex h-11 items-center px-3 text-xs font-semibold transition-[background-color,box-shadow,border-color] duration-[120ms] motion-reduce:transition-none",
                            active
                              ? "accent-sm bg-surface text-text"
                              : "text-text-secondary hoverable:bg-surface-muted border border-transparent",
                          )}
                        >
                          {value === "none" ? "No" : REPEAT_LABELS[value]}
                        </button>
                      );
                    },
                  )}
                </div>

                {frequency !== "none" ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <FormRow id="repeat-interval" label="Every" required>
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

                    <FormRow id="repeat-end" label="Until">
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
            </div>
          </>
        )}

        {/*
          The catch-all, for any error with nowhere else to appear.

          Which fields have a slot depends on what is on screen: a transfer
          has no category, an expense has no second account, and the date
          lives behind "More options". Asking whether this error's field is
          actually being rendered — rather than whether it is on a list of
          fields that usually are — is what stops a save refusing silently.
        */}
        {error && !errorShownInline ? (
          <p role="alert" className="text-expense text-sm">
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
              // Confirmed, unlike the swipe and the row menu.
              //
              // Those two are one gesture away from the list you were
              // already reading, and the toast's Undo is the right net for
              // them. This one is at the bottom of a form somebody opened
              // to *change* a record: a tap here while scrolling is a
              // different mistake, and it costs a sheet-worth of typing as
              // well as the record.
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete record
            </Button>
          </div>
        ) : null}
      </SheetBody>

      {/*
        The save row is one row even at 360px: stacked, the two buttons cost
        a whole row of categories on a short screen, and the labels are
        short enough to share.
      */}
      <SheetFooter className="flex-col gap-2">
        <div className="flex w-full gap-2">
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
                {saveLabel}
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-4" aria-hidden="true" />
                )}
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
                {/*
                  Not a bare plus. The dock's plus means "add a record" and
                  this sits two thumb-widths from it meaning "save this one
                  and start the next" — the same glyph for a different verb,
                  beside the Save button it is not. A plus on a list says it
                  adds to the run you are already keeping.
                */}
                <ListPlus className="size-5" aria-hidden="true" />
              </Button>
              <Button
                size="touch"
                className="min-w-0 flex-1"
                onClick={() => void save(false)}
                disabled={saving}
              >
                <span className="truncate">
                  {justSaved ? "Saved" : saveLabel}
                </span>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : justSaved ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-4" aria-hidden="true" />
                )}
              </Button>
            </>
          )}
        </div>
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
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this record?"
        description={
          amountLabel
            ? `${amountLabel} will be removed from your records. You can undo this straight away.`
            : "It will be removed from your records. You can undo this straight away."
        }
        confirmLabel="Delete"
        onConfirm={() => {
          setDeleteOpen(false);
          onOpenChange(false);
          if (editingId && onDelete) void onDelete(editingId);
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
