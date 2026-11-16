import { readAmount } from "@/lib/import/amount-text";
import type { ColumnMapping } from "@/lib/import/columns";
import type { ParsedCsv } from "@/lib/import/csv";
import { DATE_FORMATS, type DateFormat, readDate } from "@/lib/import/date-text";

/**
 * A parsed file and its mapping, into the rows the preview shows.
 *
 * Each line is one of three things: a record; not a record (a blank or zero
 * amount, which is what a statement's "Opening balance" line looks like);
 * or unreadable, with a sentence that says which line and why, so the
 * person can fix the file rather than guess.
 */

/** Which way round a single amount column is. */
export type SignConvention = "negative-spent" | "positive-spent";

export const NOTE_MAX = 500;

export type ImportRow = {
  line: number;
  type: "expense" | "income";
  /** Minor units, always positive: the type carries the direction. */
  amount: bigint;
  /** `yyyy-mm-dd`. */
  date: string;
  note: string | null;
};

export type Unreadable = { line: number; reason: string };

export type BuiltRows = {
  rows: ImportRow[];
  unreadable: Unreadable[];
  notRecords: number;
};

export function mappingProblem(mapping: ColumnMapping): string | null {
  if (mapping.date === null) return "Choose the Date column.";

  const amounts =
    mapping.mode === "single" ? [mapping.amount] : [mapping.debit, mapping.credit];

  if (mapping.mode === "single" && mapping.amount === null) {
    return "Choose the Amount column.";
  }
  if (mapping.mode === "split" && (mapping.debit === null || mapping.credit === null)) {
    return "Choose both the Debit and the Credit column.";
  }

  const used = [mapping.date, mapping.description, ...amounts].filter(
    (column): column is number => column !== null,
  );
  if (new Set(used).size !== used.length) return "Each column can be used once.";

  return null;
}

const quote = (text: string) => `"${text.trim()}"`;

export function buildImportRows(
  file: ParsedCsv,
  mapping: ColumnMapping,
  {
    dateFormat,
    sign,
    decimals,
  }: { dateFormat: DateFormat; sign: SignConvention; decimals: number },
): BuiltRows {
  const built: BuiltRows = { rows: [], unreadable: [], notRecords: 0 };
  const formatLabel =
    DATE_FORMATS.find((format) => format.value === dateFormat)?.label ?? dateFormat;

  // A `;`-separated file comes from a locale whose decimal mark is a comma.
  const amountOptions = { decimalComma: file.delimiter === ";" };

  const cell = (cells: string[], column: number | null) =>
    column === null ? "" : (cells[column] ?? "");

  for (const { line, cells } of file.rows) {
    const refuse = (reason: string) =>
      built.unreadable.push({ line, reason: `Line ${line}: ${reason}` });

    let type: ImportRow["type"];
    let amount: bigint;

    if (mapping.mode === "single") {
      const text = cell(cells, mapping.amount);
      const read = readAmount(text, decimals, amountOptions);

      if (read.kind === "blank") {
        built.notRecords += 1;
        continue;
      }
      if (read.kind === "error") {
        refuse(`the amount ${quote(text)} ${read.reason}.`);
        continue;
      }

      const negative = read.minor < 0n;
      // A Dr, Cr or trailing minus is the bank saying which way the money
      // went; the convention is only for numbers that do not say.
      const spent =
        read.marked || sign === "negative-spent" ? negative : !negative;
      type = spent ? "expense" : "income";
      amount = negative ? -read.minor : read.minor;
    } else {
      const debitText = cell(cells, mapping.debit);
      const creditText = cell(cells, mapping.credit);
      const debit = readAmount(debitText, decimals, amountOptions);
      const credit = readAmount(creditText, decimals, amountOptions);

      if (debit.kind === "error") {
        refuse(`the debit ${quote(debitText)} ${debit.reason}.`);
        continue;
      }
      if (credit.kind === "error") {
        refuse(`the credit ${quote(creditText)} ${credit.reason}.`);
        continue;
      }
      if (debit.kind === "blank" && credit.kind === "blank") {
        built.notRecords += 1;
        continue;
      }
      if (debit.kind === "value" && credit.kind === "value") {
        refuse("has both a debit and a credit.");
        continue;
      }

      const value = debit.kind === "value" ? debit : credit;
      if (value.kind !== "value") continue;

      type = debit.kind === "value" ? "expense" : "income";
      amount = value.minor < 0n ? -value.minor : value.minor;
    }

    const dateText = cell(cells, mapping.date);
    const date = readDate(dateText, dateFormat);
    if (!date) {
      refuse(`the date ${quote(dateText)} is not a ${formatLabel} date.`);
      continue;
    }

    const note = cell(cells, mapping.description)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NOTE_MAX);

    built.rows.push({ line, type, amount, date, note: note || null });
  }

  return built;
}
