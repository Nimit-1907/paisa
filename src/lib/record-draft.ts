import { instantToLocal } from "@/lib/dates";
import type { RecordDraft } from "@/components/records/record-sheet";
import type { TransactionRow } from "@/lib/queries/transactions";

/**
 * A record as the sheet's draft.
 *
 * Shared by Edit and Log again on the records list, by the detail sheet, and
 * by a search result, four places that all mean "open this record in the
 * sheet", and which were one copy-paste away from disagreeing about whether
 * the recurring rule travels with it.
 */
export function draftOf(
  record: TransactionRow,
  timeZone: string,
): Omit<RecordDraft, "mode"> {
  return {
    id: record.id,
    type: record.type,
    amount: record.amount,
    accountId: record.accountId,
    toAccountId: record.toAccountId,
    categoryId: record.categoryId,
    note: record.note,
    occurredAtLocal: instantToLocal(record.occurredAt, timeZone),
    recurringRuleId: record.recurringRuleId,
  };
}

/**
 * A record as the start of a new one: "Log again".
 *
 * Everything it was, dated `now` in the profile's timezone, and not part of
 * its recurring rule: a rule's occurrences are made by the rule. No `mode`,
 * which is how the sheet knows to save it as a new record rather than over
 * this one.
 */
export function logAgainDraft(
  record: TransactionRow,
  timeZone: string,
  now: Date,
): Omit<RecordDraft, "mode"> {
  return {
    ...draftOf(record, timeZone),
    occurredAtLocal: instantToLocal(now, timeZone),
    recurringRuleId: null,
  };
}

/**
 * A prefilled draft with anything archived taken out.
 *
 * Log again starts from an old record, whose account or category may have
 * been archived since. The pickers only list open ones, so an archived id
 * would show as "Choose" and still be saved. Dropped, the account falls
 * back to the sheet's guess and the category asks to be chosen.
 */
export function withoutInactive<
  T extends {
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
  },
>(draft: T, active: { accountIds: string[]; categoryIds: string[] }): T {
  const open = (id: string | null, ids: string[]) =>
    id !== null && ids.includes(id) ? id : null;

  return {
    ...draft,
    accountId: open(draft.accountId, active.accountIds) ?? "",
    toAccountId: open(draft.toAccountId, active.accountIds),
    categoryId: open(draft.categoryId, active.categoryIds),
  };
}
