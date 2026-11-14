"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  deleteRecurringRule,
  setRecurringRulePaused,
  skipNextOccurrence,
} from "@/actions/recurring";
import type { ActionResult } from "@/lib/action-result";
import type { RecurringRule } from "@/lib/recurring-rule";
import { dayLabel } from "@/lib/relative-day";

/**
 * Everything that can be done to a rule from a button.
 *
 * The list and the detail page offer the same four actions, so the wiring —
 * which action, which arguments, which words in the toast — lives here once.
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
      /** Runs instead of the refresh — navigating away after a delete. */
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
        (data) => `Skipped — next on ${dayLabel(data.nextRunOn)}`,
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
            ? "Deleted — past records kept"
            : `Deleted, along with ${data.deletedTransactions} ${
                data.deletedTransactions === 1 ? "record" : "records"
              }`,
        after,
      ),
    [run],
  );

  return { pending, pause, resume, skip, remove };
}
