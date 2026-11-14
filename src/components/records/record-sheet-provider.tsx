"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/actions/transactions";
import {
  type AccountOption,
  type CategoryOption,
  type RecordDraft,
  RecordSheet,
  type RecordSubmit,
} from "@/components/records/record-sheet";

type RecordSheetContextValue = {
  openAdd: () => void;
  openEdit: (draft: RecordDraft) => void;
  /**
   * Lets the screen showing the records take over saving, so the row can
   * appear before the server answers. Returns the undo function.
   */
  setSubmitHandler: (handler: RecordSubmit | null) => () => void;
  setDeleteHandler: (handler: ((id: string) => void) | null) => () => void;
  ready: boolean;
};

const RecordSheetContext = React.createContext<RecordSheetContextValue>({
  openAdd: () => {},
  openEdit: () => {},
  setSubmitHandler: () => () => {},
  setDeleteHandler: () => () => {},
  ready: false,
});

/**
 * Holds the one Add Record sheet the whole app shares.
 *
 * The FAB is in the (app) layout and has to work from every tab, so the sheet
 * lives here rather than in any one screen. The Records screen takes over
 * submitting while it is mounted — that is what lets a new row appear
 * optimistically instead of waiting for a round trip.
 */
export function RecordSheetProvider({
  accounts,
  categories,
  timeZone,
  children,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  timeZone: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<RecordDraft | null>(null);
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
      openAdd: () => {
        setDraft(null);
        setOpen(true);
      },
      openEdit: (next) => {
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
      ready: accounts.length > 0,
    }),
    [accounts.length],
  );

  const submit = React.useCallback<RecordSubmit>(
    (values, context) =>
      (handlerRef.current ?? defaultSubmit)(values, context),
    [defaultSubmit],
  );

  const remove = React.useCallback(
    async (id: string) => {
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
    [router],
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
        onSubmit={submit}
        onDelete={remove}
        timeZone={timeZone}
      />
    </RecordSheetContext.Provider>
  );
}

export function useRecordSheet() {
  return React.useContext(RecordSheetContext);
}
