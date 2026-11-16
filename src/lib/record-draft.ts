import { instantToLocal } from "@/lib/dates";
import type { RecordDraft } from "@/components/records/record-sheet";
import type { TransactionRow } from "@/lib/queries/transactions";

/**
 * A record as the sheet's draft.
 *
 * Shared by Edit and Duplicate on the records list, by the detail sheet, and
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
