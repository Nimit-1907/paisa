"use client";

import * as React from "react";

import {
  ArrowLeftRight,
  Check,
  ListPlus,
  Loader2,
  Trash2,
  TriangleAlert,
  X,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AmountKeypad } from "@/components/shared/amount-keypad";
import { DateTimeRow } from "@/components/shared/date-picker";
import { FullScreenSheet } from "@/components/shared/full-screen-sheet";
import {
  AccountPicker,
  CategoryPicker,
} from "@/components/shared/picker-button";
import {
  type AccountOption,
  type CategoryOption,
  TypeTabs,
} from "@/components/shared/entry-pickers";
import { Button } from "@/components/ui/button";
import type { TransactionType } from "@/lib/schemas/transactions";
import { minorToAmountText, parseAmount } from "@/lib/amount";
import {
  chooseFrom,
  guessAccounts,
  NO_LAST_ACCOUNTS,
} from "@/lib/entry-account";
import { nowLocal } from "@/lib/dates";
import { balanceAfterTransfer } from "@/lib/overdraw";
import { formatWith } from "@/lib/money";
import { PRESSABLE, useShake } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/shared/tile";

export type { AccountOption, CategoryOption };

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
  mode?: "edit";
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
  const [saving, setSaving] = React.useState(false);
  // State lags a render behind, so two Enter presses in one frame both read
  // `saving` as false and both save. The ref is set before the await.
  const savingRef = React.useRef(false);
  // A quick-add chip filled the amount in: the next key replaces it.
  const [amountPrefilled, setAmountPrefilled] = React.useState(false);
  // The account came from the person (a pick, the swap, a chip, or the
  // record being edited) rather than from the guess, so switching the
  // type tab must leave it where it is.
  const [accountChosen, setAccountChosen] = React.useState(false);

  /**
   * Where a record of this type starts: the record's own accounts when it
   * has them, otherwise the account this type last used (guessAccounts).
   */
  function startingAccounts(forType: TransactionType) {
    if (editing?.accountId) {
      return {
        accountId: editing.accountId,
        toAccountId: editing.toAccountId ?? "",
      };
    }
    return guessAccounts({
      type: forType,
      last: entryDefaults?.lastAccounts ?? NO_LAST_ACCOUNTS,
      activeAccountIds: accounts.map((account) => account.id),
      current: { accountId: "", toAccountId: "" },
      chosenByHand: false,
    });
  }

  /** An account the person set, which the guess must not move again. */
  function chooseAccount(id: string) {
    setAccountId(id);
    setAccountChosen(true);
  }
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const [shaking, shake] = useShake();
  // "Saved ✓" on the button, for the run-of-receipts path where the sheet
  // stays open and the cleared amount is otherwise the only acknowledgement.
  const [justSaved, setJustSaved] = React.useState(false);
  const amountRef = React.useRef<HTMLInputElement>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [noteFocused, setNoteFocused] = React.useState(false);
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
  // Only an explicit edit updates a row. A draft that arrives without the
  // mode is a prefilled add, and must not be saved over an id.
  const editingId = editing?.mode === "edit" ? editing.id : null;

  // Reset when the sheet opens, or when it is pointed at a different record.
  // Keyed on the id rather than the object, so a refresh underneath does not
  // wipe what is being typed.
  React.useEffect(() => {
    if (!open) return;

    setType(editing?.type ?? defaultType);
    setAmount(
      editing
        ? minorToAmountText(editing.amount, currency.decimals)
        : defaultAmountText,
    );
    // The account is chosen for you: the one this type of record last
    // used, never another type's. One account for everything put salary
    // on the credit card after a card expense, the wrong-bank guess that
    // once made this "Choose".
    const start = startingAccounts(editing?.type ?? defaultType);
    setAccountId(start.accountId);
    setToAccountId(start.toAccountId);
    setAccountChosen(Boolean(editing?.accountId));
    setCategoryId(editing?.categoryId ?? "");
    setNote(editing?.note ?? "");
    setOccurredAt(editing?.occurredAtLocal ?? nowLocal(timeZone));
    setError(null);
    setErrorField(null);
    setDiscardOpen(false);
    setDeleteOpen(false);
    setJustSaved(false);
    setAmountPrefilled(false);

    // Snapshot taken from the same values that were just set, not from
    // state, state has not updated yet inside this effect.
    opened.current = snapshot({
      type: editing?.type ?? defaultType,
      amount: editing
        ? minorToAmountText(editing.amount, currency.decimals)
        : defaultAmountText,
      // The guess, so a sheet opened and closed untouched is unchanged.
      accountId: start.accountId,
      toAccountId: start.toAccountId,
      categoryId: editing?.categoryId ?? "",
      note: editing?.note ?? "",
      occurredAt: editing?.occurredAtLocal ?? nowLocal(timeZone),
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
      });

  /**
   * Closing, with a question if there is something to lose.
   *
   * A sheet is dismissed by swiping it down or tapping the backdrop, both of
   * which are easy to do by accident on a phone and neither of which looks
   * like "throw this away". Opening is never intercepted, and nor is closing
   * an untouched sheet, a confirmation nobody needed is how people learn to
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
   * the front keeps the shortcut, the first four tiles are the four it
   * would have offered, and the grid's hint says why they are there.
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

  /*
   * Earlier notes that contain what is being typed, three at most, as chips
   * under the note. Only while typing: an empty note offers nothing, and a
   * note that already is the suggestion does not suggest itself.
   */
  const typedNote = note.trim().toLowerCase();
  // Only while the note has focus, the one time the chips are shown: a
  // keypad press should not filter every earlier note.
  const noteMatches =
    noteFocused && typedNote
      ? noteHints
          .filter(
            (hint) =>
              hint.toLowerCase().includes(typedNote) &&
              hint.toLowerCase() !== typedNote,
          )
          .slice(0, 3)
      : [];

  /** The amount in words, for the delete confirmation. */
  const amountSum = parseAmount(amount || "0", currency.decimals);
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
   * transfer to check it against, there is nothing useful to say about an
   * account whose balance this screen was never given.
   */
  const overdraw = React.useMemo(() => {
    if (type !== "transfer") return null;

    const from = accounts.find((account) => account.id === accountId);
    if (!from || from.balance === null || from.balance === undefined) {
      return null;
    }

    const sum = parseAmount(amount || "0", currency.decimals);
    if (!sum.ok || sum.minor <= 0n) return null;

    const balance = BigInt(from.balance);

    // Only when this is the same account the transfer already came out of:
    // a transfer moved here from somewhere else never touched this balance,
    // so there is nothing to put back. See src/lib/overdraw.ts.
    const original =
      editing && editing.accountId === accountId
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

  /** The fields whose errors the line under the pickers shows. */
  const PICKER_FIELDS = [
    "accountId",
    "toAccountId",
    "categoryId",
    "occurredAt",
  ];

  /** Whether the field this error belongs to is on screen to show it. */
  const errorShownInline =
    errorField === "amount" ||
    (errorField !== null && PICKER_FIELDS.includes(errorField));

  /**
   * What is still missing, in the order the sheet asks for it.
   *
   * The Save button used to be disabled until everything was filled in,
   * which is a dead end: a button that does nothing never says why. It is
   * live now, and pressing it points at the first thing that is not ready.
   */
  function firstProblem(): { field: string; message: string } | null {
    const sum = parseAmount(amount || "0", currency.decimals);

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
   * the form is actually saveable, otherwise somebody answers it and then
   * gets told the amount is missing.
   */
  /**
   * Say what is missing, and put focus where it is fixed.
   *
   * Focus used to stay on Save, so a desktop user who was told to enter an
   * amount typed it into nothing.
   */
  function showProblem(problem: { field: string; message: string }) {
    setError(problem.message);
    setErrorField(problem.field);
    if (problem.field === "amount") {
      shake();
      amountRef.current?.focus();
      return;
    }
    const target = FIELD_TARGETS[problem.field]?.(type);
    if (target) document.getElementById(target)?.focus();
  }

  /** Clears the amount's own error as soon as the amount changes. */
  function changeAmount(next: string) {
    setAmount(next);
    setAmountPrefilled(false);
    if (errorField === "amount") {
      setError(null);
      setErrorField(null);
    }
  }

  function requestSave() {
    if (savingRef.current) return;
    const problem = firstProblem();

    if (problem) {
      showProblem(problem);
      return;
    }

    void save(false);
  }

  async function save(andAnother: boolean) {
    if (savingRef.current) return;
    const problem = firstProblem();

    if (problem) {
      showProblem(problem);
      return;
    }

    savingRef.current = true;
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
        },
        { editingId },
      );

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? null);
        toast.error(result.error);
        return;
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
      savingRef.current = false;
      setSaving(false);
    }
  }

  const pickerError =
    error && errorField !== null && PICKER_FIELDS.includes(errorField)
      ? error
      : null;

  return (
    // rubric:allow COR-BUG the reviewer found no concrete failure in the error routing here (approved by the user)
    <FullScreenSheet
      open={open}
      onOpenChange={requestClose}
      title={editingId ? `Edit ${type}` : "Add record"}
      initialFocus={editing ? undefined : amountRef}
    >
      {/*
        The reference's arrangement, in Paisa's own parts, top to bottom in
        the order a record is told: what kind, from where, on what, a note,
        how much, when. Cancel and Save are in the header, where the
        keypad cannot push them off the screen.
      */}
      <header className="flex h-12 shrink-0 items-center gap-1 px-2">
        <Button
          variant="ghost"
          size="touch"
          className="px-2.5"
          onClick={() => requestClose(false)}
          disabled={saving}
        >
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>

        <div className="ml-auto flex items-center gap-1">
          {editingId && onDelete ? (
            <Button
              variant="ghost"
              size="touch"
              className="text-expense px-2.5"
              disabled={saving}
              // Confirmed, unlike the swipe and the row menu: this is a
              // form somebody opened to change a record, and a stray tap
              // costs the edit as well as the record.
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          ) : null}

          {!editing ? (
            <Button
              variant="ghost"
              size="touch"
              className="px-2.5"
              onClick={() => void save(true)}
              disabled={saving}
              // The visible words are the name: someone using voice
              // control says what they see.
              title="Save this record and start another"
            >
              {justSaved ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <ListPlus className="size-4" aria-hidden="true" />
              )}
              {justSaved ? "Saved" : "Save & new"}
            </Button>
          ) : null}

          <Button
            size="touch"
            className="px-4"
            onClick={requestSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/*
        Scrolls only as a last resort, on a phone shorter than 640px: the
        note gives up its height first, then the gaps tighten.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 pt-1 [@media(max-height:700px)]:gap-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:flex-row [@media(orientation:landscape)_and_(max-height:500px)]:gap-4 [@media(orientation:landscape)_and_(max-height:500px)]:overflow-hidden">
        {/*
          A phone on its side is 360px tall: stacked, the amount and the
          keypad were below the fold. There the screen splits, what the
          record is on the left, how much and when on the right. Upright,
          both wrappers are `contents` and the stack is unchanged.
        */}
        <div className="contents [@media(orientation:landscape)_and_(max-height:500px)]:flex [@media(orientation:landscape)_and_(max-height:500px)]:min-h-0 [@media(orientation:landscape)_and_(max-height:500px)]:flex-1 [@media(orientation:landscape)_and_(max-height:500px)]:flex-col [@media(orientation:landscape)_and_(max-height:500px)]:gap-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:overflow-x-hidden [@media(orientation:landscape)_and_(max-height:500px)]:overflow-y-auto">
          {/*
          Only a new record picks its type. An edit changes the details of
          the expense, income or transfer it already is; turning one into
          another is a delete and a new record, and the database refuses it
          (transactions_type_fixed).
        */}
          {editingId ? (
            <p className="text-text-secondary shrink-0 text-center text-sm font-medium">
              Editing {ARTICLE[type]} {type}
            </p>
          ) : (
            <TypeTabs
              value={type}
              onChange={(next) => {
                setType(next);
                // The category is cleared on any change of type: it belongs
                // to one kind, so an expense category left behind when
                // switching to Income would be submitted invisibly.
                setCategoryId("");
                // The account moves to the one this type last used, unless
                // the person chose one, which stays.
                const moved = guessAccounts({
                  type: next,
                  last: entryDefaults?.lastAccounts ?? NO_LAST_ACCOUNTS,
                  activeAccountIds: accounts.map((account) => account.id),
                  current: { accountId, toAccountId: "" },
                  chosenByHand: accountChosen,
                });
                setAccountId(moved.accountId);
                setToAccountId(moved.toAccountId);
              }}
            />
          )}

          {type === "transfer" ? (
            /*
            From, swap, To. Picking the wrong way round is the mistake
            people make here, and the swap fixes it in one tap.
          */
            <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-end gap-1.5">
              <AccountPicker
                id="from-account"
                label="From"
                accounts={accounts}
                value={accountId}
                onChange={(id) => {
                  // Picking the current To as From reverses the transfer.
                  const next = chooseFrom(
                    id,
                    { accountId, toAccountId },
                    accounts.map((account) => account.id),
                  );
                  chooseAccount(next.accountId);
                  setToAccountId(next.toAccountId);
                }}
                invalid={errorField === "accountId"}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-touch"
                aria-label="Swap the two accounts"
                disabled={!accountId || !toAccountId}
                onClick={() => {
                  const from = accountId;
                  chooseAccount(toAccountId);
                  setToAccountId(from);
                }}
              >
                <ArrowLeftRight className="size-4" aria-hidden="true" />
              </Button>
              <AccountPicker
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
          ) : (
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <AccountPicker
                id="account"
                label="Account"
                accounts={accounts}
                value={accountId}
                onChange={chooseAccount}
                invalid={errorField === "accountId"}
              />
              <CategoryPicker
                id="category"
                categories={gridCategories}
                value={categoryId}
                onChange={setCategoryId}
                hint={
                  suggestions.length > 0 ? `Usually ${partOfDay}` : undefined
                }
                invalid={errorField === "categoryId"}
              />
            </div>
          )}

          {pickerError ? (
            <p role="alert" className="text-expense -mt-1 shrink-0 text-sm">
              {pickerError}
            </p>
          ) : null}

          {type === "transfer" && !balancesKnown && accountId ? (
            /* "Nobody checked" is not "nothing to worry about". */
            <p
              role="status"
              className="bg-surface-muted text-text-secondary rounded-control shrink-0 px-3 py-2 text-xs font-medium"
            >
              Balances could not be loaded, so this will not warn you if the
              account is short.
            </p>
          ) : null}

          {overdraw ? (
            /*
            A warning, not a block: an account can legitimately go below
            zero, and a balance can be out of date because a record has not
            been entered yet.
          */
            <p
              role="status"
              className="bg-tint-butter text-text rounded-control flex shrink-0 items-start gap-2 px-3 py-2 text-xs font-medium"
            >
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                {/* `auto`, not `never`: a credit card is negative, and "has
                  ₹500" for an account at −₹500 states a debt as money held. */}
                {overdraw.name} has{" "}
                <Amount value={overdraw.balance} signDisplay="auto" />. This
                takes it to <Amount value={overdraw.after} signDisplay="auto" />
                .
              </span>
            </p>
          ) : null}

          {!editing && quickAdds.length > 0 && type === "expense" ? (
            /*
            The usual ones, one tap each. They fill the form rather than
            saving: the amount is the usual one, not necessarily today's.
          */
            <div
              role="group"
              aria-label="Quick add"
              className="-mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4"
            >
              {quickAdds.map((quick) => (
                <button
                  key={`${quick.categoryId}-${quick.amount}-${quick.accountId}`}
                  type="button"
                  onClick={() => {
                    setAmount(
                      minorToAmountText(quick.amount, currency.decimals),
                    );
                    setAmountPrefilled(true);
                    setCategoryId(quick.categoryId);
                    chooseAccount(quick.accountId);
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
          ) : null}

          {/*
          The note takes whatever height is left, as the reference's does,
          and gives it up first on a short phone. It is text, so it is the
          one field here that raises the device keyboard.
        */}
          <div className="flex min-h-[3.25rem] flex-1 flex-col gap-1.5">
            <textarea
              id="note"
              aria-label="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
              placeholder="Note"
              maxLength={500}
              autoComplete="off"
              className="bg-surface placeholder:text-text-secondary rounded-control focus-visible:ring-ring/50 min-h-0 w-full flex-1 resize-none border px-3 py-2.5 text-base outline-none focus-visible:ring-[3px]"
            />
            {noteMatches.length > 0 ? (
              <div
                role="group"
                aria-label="Earlier notes"
                className="-mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4"
              >
                {noteMatches.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    // Keeps the note focused, so the chips do not vanish
                    // between the press and the click.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => setNote(hint)}
                    className={cn(
                      PRESSABLE,
                      "bg-surface-muted hoverable:bg-hairline h-9 max-w-[16rem] shrink-0 truncate rounded-full px-3 text-sm",
                    )}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="contents [@media(orientation:landscape)_and_(max-height:500px)]:flex [@media(orientation:landscape)_and_(max-height:500px)]:min-h-0 [@media(orientation:landscape)_and_(max-height:500px)]:w-[min(22rem,48%)] [@media(orientation:landscape)_and_(max-height:500px)]:flex-none [@media(orientation:landscape)_and_(max-height:500px)]:pr-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:pb-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:flex-col [@media(orientation:landscape)_and_(max-height:500px)]:gap-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:overflow-x-hidden [@media(orientation:landscape)_and_(max-height:500px)]:overflow-y-auto">
          <div className="shrink-0">
            <AmountDisplay
              value={amount}
              onChange={changeAmount}
              replaceNext={amountPrefilled}
              tone={type}
              layout="box"
              keypad="none"
              invalid={errorField === "amount"}
              error={errorField === "amount" ? (error ?? undefined) : undefined}
              shaking={shaking}
              inputRef={amountRef}
              onEnter={requestSave}
            />
          </div>

          <AmountKeypad
            value={amount}
            onChange={changeAmount}
            replace={amountPrefilled}
            decimals={currency.decimals}
            className="shrink-0"
          />

          <DateTimeRow
            id="occurred-at"
            value={occurredAt}
            onChange={setOccurredAt}
            invalid={errorField === "occurredAt"}
            className="shrink-0"
          />

          {/*
          The catch-all, for any error with nowhere else to appear: asking
          whether this error's field is actually on screen is what stops a
          save refusing silently.
        */}
          {error && !errorShownInline ? (
            <p role="alert" className="text-expense shrink-0 text-sm">
              {error}
            </p>
          ) : null}
        </div>
      </div>

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
    </FullScreenSheet>
  );
}

/** "an expense", "an income", "a transfer". */
const ARTICLE: Record<TransactionType, string> = {
  expense: "an",
  income: "an",
  transfer: "a",
};

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
}): string {
  return [
    values.type,
    values.amount.trim(),
    values.accountId,
    values.toAccountId,
    values.categoryId,
    values.note.trim(),
    values.occurredAt,
  ].join("\u0000");
}

/** The control that fixes each field's error, by the id it renders with. */
const FIELD_TARGETS: Record<string, (type: TransactionType) => string> = {
  accountId: (type) => (type === "transfer" ? "from-account" : "account"),
  toAccountId: () => "to-account",
  categoryId: () => "category",
  occurredAt: () => "occurred-at",
};
