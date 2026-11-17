"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  deleteRecurringRule,
  payOccurrenceNow,
  setRecurringRulePaused,
  skipNextOccurrence,
} from "@/actions/recurring";
import { deleteTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/lib/action-result";
import type { RecurringRule } from "@/lib/recurring-rule";
import { dayLabel } from "@/lib/relative-day";

/**
 * Everything that can be done to a rule from a button.
 *
 * The list and the detail page offer the same four actions, so the wiring,
 * which action, which arguments, which words in the toast, lives here once.
 * Two copies would drift, and the one that drifted would be the one nobody
 * looked at.
 */
export function useRuleActions() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async <T>(
      work: () => Promise<ActionResult<T>>,
      success: (data: T) => string,
      /** Runs instead of the refresh, navigating away after a delete. */
      after?: () => void,
    ) => {
      setPending(true);

      try {
        const result = await work();

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success(success(result.data));
        if (after) after();
        else router.refresh();
      } catch (thrown) {
        console.error("[recurring]", thrown);
        toast.error("Could not do that. Check your connection and try again.");
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const pause = React.useCallback(
    (rule: RecurringRule) =>
      run(
        () => setRecurringRulePaused({ id: rule.id, paused: true }),
        () => "Paused",
      ),
    [run],
  );

  const resume = React.useCallback(
    (rule: RecurringRule) =>
      run(
        () => setRecurringRulePaused({ id: rule.id, paused: false }),
        () => "Resumed",
      ),
    [run],
  );

  const skip = React.useCallback(
    (rule: RecurringRule) => {
      // Guarded here as well as in the UI: a rule with nothing left due has
      // no occurrence to skip, and the RPC would refuse it.
      if (!rule.dueOn) return Promise.resolve();

      return run(
        () => skipNextOccurrence({ id: rule.id, on: rule.dueOn as string }),
        (data) => `Skipped. Next on ${dayLabel(data.nextRunOn)}`,
      );
    },
    [run],
  );

  const remove = React.useCallback(
    (rule: RecurringRule, deleteTransactions: boolean, after?: () => void) =>
      run(
        () => deleteRecurringRule({ id: rule.id, deleteTransactions }),
        (data) =>
          data.deletedTransactions === 0
            ? "Deleted. Past records kept."
            : `Deleted, along with ${data.deletedTransactions} ${
                data.deletedTransactions === 1 ? "record" : "records"
              }`,
        after,
      ),
    [run],
  );

  /**
   * The next occurrence, recorded now on its own day, with Undo.
   *
   * Undo deletes the record it made; the database then puts that day back
   * on the rule's schedule (20261118120000_paid_early_undo.sql), so a
   * mistaken tap costs nothing.
   */
  const payNow = React.useCallback(
    async (rule: RecurringRule) => {
      if (!rule.dueOn) return;
      setPending(true);

      try {
        const result = await payOccurrenceNow({ id: rule.id, on: rule.dueOn });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        const made = result.data.transactionId;
        if (!made) {
          toast.success("That one was already added");
          router.refresh();
          return;
        }

        toast.success("Paid early", {
          description: `Added to your records for ${dayLabel(rule.dueOn)}`,
          action: {
            label: "Undo",
            onClick: () => {
              void (async () => {
                try {
                  const undone = await deleteTransaction({ id: made });
                  if (!undone.ok) toast.error(undone.error);
                } catch (thrown) {
                  console.error("[recurring]", thrown);
                  toast.error("Could not undo that. Check your connection.");
                } finally {
                  router.refresh();
                }
              })();
            },
          },
        });
        router.refresh();
      } catch (thrown) {
        console.error("[recurring]", thrown);
        toast.error("Could not add that record. Check your connection.");
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { pending, pause, resume, skip, remove, payNow };
}
