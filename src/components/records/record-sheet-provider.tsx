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
import { parseAmount } from "@/lib/amount";
import { EMPTY_SHEET_DATA, type SheetData } from "@/lib/sheet-data";
import {
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
   * Opens Add Record prefilled from a record: "Log again". The draft has no
   * `mode`, so Save creates a new record and never touches the original.
   */
  openLogAgain: (draft: Omit<RecordDraft, "mode">) => void;
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
  /** False when there is no account to book a record to. */
  ready: boolean;
};

const RecordSheetContext = React.createContext<RecordSheetContextValue>({
  openAdd: () => {},
  openEdit: () => {},
  openLogAgain: () => {},
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
  data,
  timeZone,
  firstRecordSeen,
  children,
}: {
  /**
   * Streamed rather than awaited by the layout, so no page waits for the
   * pickers of a sheet that is not open. Read with use() below, inside a
   * Suspense boundary of its own.
   */
  data: Promise<SheetData>;
  timeZone: string;
  /** False until the "first record" note has been shown once. */
  firstRecordSeen: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const tap = useHaptic();
  const [open, setOpen] = React.useState(false);
  // The resolved sheet data, lifted out of the Suspense boundary below for
  // the two things outside it that need it: whether Add is ready, and the
  // category name in the saved toast.
  const [loaded, setLoaded] = React.useState<SheetData | null>(null);
  const accounts = loaded?.accounts ?? EMPTY_SHEET_DATA.accounts;
  const categories = loaded?.categories ?? EMPTY_SHEET_DATA.categories;
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
      openLogAgain: (next) => {
        setDraft(next);
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
      // Ready while the pickers are still loading: a tap in those few
      // milliseconds opens the sheet, which appears as soon as they land.
      // Not ready only once it is known there is no account to book to.
      ready: loaded === null || accounts.length > 0,
    }),
    [loaded, accounts.length, lastSavedId],
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

      const sum = parseAmount(values.amount || "0", currency.decimals);
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

  // A sheet opened while the pickers loaded, which then came back with no
  // account to book to: close it rather than leave an empty form open.
  React.useEffect(() => {
    if (!loaded || loaded.accounts.length > 0) return;
    setOpen(false);

    // Said rather than only disabled: a dead Add button explains nothing.
    // Refreshing re-runs the layout, which hands over a new promise.
    if (loaded.failed) {
      toast.error("Could not load your accounts.", {
        id: "sheet-data-failed",
        description: "Adding a record needs them.",
        action: { label: "Retry", onClick: () => router.refresh() },
      });
    }
  }, [loaded, router]);

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

      {/*
        Its own boundary, with nothing as the fallback: the sheet is closed
        until somebody taps Add, which stays disabled until this resolves.
      */}
      <React.Suspense fallback={null}>
        <LoadedSheet
          data={data}
          onLoaded={setLoaded}
          open={open}
          onOpenChange={setOpen}
          draft={draft}
          defaultType={addType}
          onSubmit={submit}
          onDelete={remove}
          timeZone={timeZone}
        />
      </React.Suspense>
    </RecordSheetContext.Provider>
  );
}

/** The sheet, once the layout's promise of its pickers has resolved. */
function LoadedSheet({
  data,
  onLoaded,
  ...sheet
}: {
  data: Promise<SheetData>;
  onLoaded: (data: SheetData) => void;
} & Omit<React.ComponentProps<typeof RecordSheet>, keyof SheetData>) {
  const resolved = React.use(data);

  React.useEffect(() => {
    onLoaded(resolved);
  }, [resolved, onLoaded]);

  return <RecordSheet {...sheet} {...resolved} />;
}

export function useRecordSheet() {
  return React.useContext(RecordSheetContext);
}
