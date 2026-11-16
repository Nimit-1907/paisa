"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { markFirstRecordSeen } from "@/actions/profile";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/actions/transactions";
import {
  useCurrency,
  useFormatMoney,
  useHaptic,
} from "@/components/profile-provider";
import { evaluate } from "@/lib/calculator";
import type { EntryDefaults, QuickAdd } from "@/lib/queries/accounts";
import {
  type AccountOption,
  type CategoryOption,
  type RecordDraft,
  RecordSheet,
  type RecordSubmit,
} from "@/components/records/record-sheet";
import type { TransactionType } from "@/lib/schemas/transactions";

/** What the toast calls each kind of record. */
const LABELS = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
} as const;

type RecordSheetContextValue = {
  /** Opens a blank sheet, optionally on the Income or Transfer tab. */
  openAdd: (type?: TransactionType) => void;
  openEdit: (draft: RecordDraft) => void;
  /**
   * Lets the screen showing the records take over saving, so the row can
   * appear before the server answers. Returns the undo function.
   */
  setSubmitHandler: (handler: RecordSubmit | null) => () => void;
  setDeleteHandler: (handler: ((id: string) => void) | null) => () => void;
  /**
   * The record saved a moment ago, so the list can point at it.
   *
   * Clears itself after a second and a half: it marks "this one is new", not
   * "this one is selected".
   */
  lastSavedId: string | null;
  ready: boolean;
};

const RecordSheetContext = React.createContext<RecordSheetContextValue>({
  openAdd: () => {},
  openEdit: () => {},
  setSubmitHandler: () => () => {},
  setDeleteHandler: () => () => {},
  lastSavedId: null,
  ready: false,
});

/**
 * Holds the one Add Record sheet the whole app shares.
 *
 * The FAB is in the (app) layout and has to work from every tab, so the sheet
 * lives here rather than in any one screen. The Records screen takes over
 * submitting while it is mounted, that is what lets a new row appear
 * optimistically instead of waiting for a round trip.
 */
export function RecordSheetProvider({
  accounts,
  categories,
  timeZone,
  entryDefaults,
  quickAdds,
  noteHints,
  balancesKnown,
  firstRecordSeen,
  children,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  timeZone: string;
  entryDefaults: EntryDefaults;
  /** The things this person buys over and over, as one-tap chips. */
  quickAdds: QuickAdd[];
  /** Notes written before, offered as you type. */
  noteHints: string[];
  /** False when the balance lookup failed, so the sheet can say so. */
  balancesKnown: boolean;
  /** False until the "first record" note has been shown once. */
  firstRecordSeen: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const tap = useHaptic();
  const [open, setOpen] = React.useState(false);
  const [lastSavedId, setLastSavedId] = React.useState<string | null>(null);
  // Within this page's lifetime the profile prop is stale the moment the
  // first record is saved, so the ref stops a second celebration.
  const celebrated = React.useRef(false);
  const [draft, setDraft] = React.useState<RecordDraft | null>(null);
  /** Which tab a sheet opened from the palette or Transfer starts on. */
  const [addType, setAddType] = React.useState<TransactionType>("expense");
  const handlerRef = React.useRef<RecordSubmit | null>(null);
  const deleteRef = React.useRef<((id: string) => void) | null>(null);

  const defaultSubmit = React.useCallback<RecordSubmit>(
    async (values, context) => {
      const result = context.editingId
        ? await updateTransaction({ ...values, id: context.editingId })
        : await createTransaction(values);

      if (result.ok) router.refresh();
      return result;
    },
    [router],
  );

  const value = React.useMemo<RecordSheetContextValue>(
    () => ({
      openAdd: (type) => {
        setDraft(null);
        setAddType(type ?? "expense");
        setOpen(true);
      },
      openEdit: (next) => {
        setDraft({ ...next, mode: "edit" });
        setOpen(true);
      },
      setSubmitHandler: (handler) => {
        handlerRef.current = handler;
        return () => {
          if (handlerRef.current === handler) handlerRef.current = null;
        };
      },
      setDeleteHandler: (handler) => {
        deleteRef.current = handler;
        return () => {
          if (deleteRef.current === handler) deleteRef.current = null;
        };
      },
      lastSavedId,
      ready: accounts.length > 0,
    }),
    [accounts.length, lastSavedId],
  );

  /**
   * Every save ends the same way, wherever the sheet was opened from.
   *
   * This is the ending people repeat most, so it says what was saved rather
   * than that something was: "Expense saved / ₹450 · Food". Undo deletes the
   * record it just made, with no second toast, the row leaving the list is
   * the confirmation.
   */
  const submit = React.useCallback<RecordSubmit>(
    async (values, context) => {
      const result = await (handlerRef.current ?? defaultSubmit)(
        values,
        context,
      );

      if (!result.ok) return result;

      tap();

      if (context.editingId) {
        setLastSavedId(context.editingId);
        return result;
      }

      const saved = result.data.id;
      setLastSavedId(saved);

      const sum = evaluate(values.amount || "0", currency.decimals);
      const category = categories.find(
        (option) => option.id === values.categoryId,
      );

      const parts = [
        sum.ok ? formatMoney(sum.minor, { signDisplay: "never" }) : null,
        values.type === "transfer" ? "Transfer" : (category?.name ?? null),
      ].filter(Boolean);

      // The first record is the moment this app either becomes a habit or
      // does not. It gets the sentence; every one after it gets the receipt.
      const first = !firstRecordSeen && !celebrated.current;

      if (first) {
        celebrated.current = true;

        // Nothing user-facing hangs on this: the worst a failure costs is
        // the same friendly line a second time. It is still logged rather
        // than dropped, because a rejection nobody handles is how a broken
        // action stays broken.
        markFirstRecordSeen()
          .then((noted) => {
            if (!noted.ok) console.error("[records]", noted.error);
          })
          .catch((thrown: unknown) => console.error("[records]", thrown));
      }

      const undo = {
        label: "Undo",
        onClick: () => {
          void (async () => {
            try {
              const undone = await deleteTransaction({ id: saved });
              if (!undone.ok) toast.error(undone.error);
            } catch (thrown) {
              console.error("[records]", thrown);
              toast.error("Could not undo that. Check your connection.");
            } finally {
              router.refresh();
            }
          })();
        },
      };

      toast.success(
        first
          ? "Your first record is in. Nice start."
          : `${LABELS[values.type]} saved`,
        {
          /*
           * One toast, replaced each time.
           *
           * "Save & new" leaves the sheet open for the next receipt, so a
           * run of five would otherwise stack five toasts, each with its own
           * Undo pointing at a different record. One that updates in place
           * says the same thing more calmly, and its Undo always means the
           * last thing saved.
           */
          id: "record-saved",
          // Long enough to notice and reach for, short enough that it is
          // gone before the next record is typed.
          duration: 4500,
          description: parts.filter(Boolean).join(" · ") || undefined,
          action: undo,
        },
      );

      return result;
    },
    [
      defaultSubmit,
      categories,
      currency.decimals,
      firstRecordSeen,
      formatMoney,
      router,
      tap,
    ],
  );

  // Long enough to notice the new row, short enough not to read as a state.
  React.useEffect(() => {
    if (!lastSavedId) return;

    const timer = window.setTimeout(() => setLastSavedId(null), 1500);
    return () => window.clearTimeout(timer);
  }, [lastSavedId]);

  const remove = React.useCallback(
    async (id: string) => {
      tap();

      // The Records screen registers its own, which can show the row
      // disappearing and offer undo; elsewhere this is the fallback.
      if (deleteRef.current) {
        deleteRef.current(id);
        return;
      }

      try {
        const result = await deleteTransaction({ id });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Record deleted");
      } catch (thrown) {
        console.error("[records]", thrown);
        toast.error("Could not delete that. Check your connection.");
      } finally {
        // Either way: on success the row is gone, on failure the list goes
        // back to showing what the server still has.
        router.refresh();
      }
    },
    [router, tap],
  );

  return (
    <RecordSheetContext.Provider value={value}>
      {children}

      <RecordSheet
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        categories={categories}
        draft={draft}
        defaultType={addType}
        onSubmit={submit}
        onDelete={remove}
        timeZone={timeZone}
        entryDefaults={entryDefaults}
        quickAdds={quickAdds}
        noteHints={noteHints}
        balancesKnown={balancesKnown}
      />
    </RecordSheetContext.Provider>
  );
}

export function useRecordSheet() {
  return React.useContext(RecordSheetContext);
}
