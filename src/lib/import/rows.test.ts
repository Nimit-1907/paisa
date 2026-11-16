import { describe, expect, it } from "vitest";

import type { ColumnMapping } from "@/lib/import/columns";
import { parseCsv } from "@/lib/import/csv";
import { buildImportRows, mappingProblem } from "@/lib/import/rows";

/**
 * A parsed file and a mapping, into the rows the preview shows.
 *
 * Three outcomes per line: a record, not a record (a blank or zero amount,
 * the "Opening balance" line at the top of a statement), or unreadable, with
 * a reason the person can go and fix.
 */

const single: ColumnMapping = {
  date: 0,
  description: 1,
  amount: 2,
  debit: null,
  credit: null,
  mode: "single",
};

const split: ColumnMapping = {
  date: 0,
  description: 1,
  amount: null,
  debit: 2,
  credit: 3,
  mode: "split",
};

const options = { dateFormat: "dmy" as const, sign: "negative-spent" as const, decimals: 2 };

describe("buildImportRows", () => {
  it("reads one signed amount column", () => {
    const file = parseCsv(
      "Date,Note,Amount\n01/11/2026,  Swiggy   dinner ,-450.50\n02/11/2026,Salary,50000\n",
    );

    expect(buildImportRows(file, single, options)).toEqual({
      rows: [
        { line: 2, type: "expense", amount: 45050n, date: "2026-11-01", note: "Swiggy dinner" },
        { line: 3, type: "income", amount: 5000000n, date: "2026-11-02", note: "Salary" },
      ],
      unreadable: [],
      notRecords: 0,
    });
  });

  it("flips the sign when positive is spent", () => {
    const file = parseCsv("Date,Note,Amount\n01/11/2026,Tea,20\n02/11/2026,Refund,-20\n");
    const { rows } = buildImportRows(file, single, { ...options, sign: "positive-spent" });

    expect(rows.map((row) => row.type)).toEqual(["expense", "income"]);
    expect(rows.map((row) => row.amount)).toEqual([2000n, 2000n]);
  });

  it("reads a debit and credit pair", () => {
    const file = parseCsv(
      "Date,Narration,Debit,Credit\n01/11/2026,Rent,15000,\n02/11/2026,Salary,,80000\n",
    );

    const { rows } = buildImportRows(file, split, options);
    expect(rows.map((row) => [row.type, row.amount])).toEqual([
      ["expense", 1500000n],
      ["income", 8000000n],
    ]);
  });

  it("skips blank and zero amounts as not records", () => {
    const file = parseCsv(
      "Date,Narration,Debit,Credit\nOpening balance,,,\n01/11/2026,Fee,0.00,\n02/11/2026,Tea,20,\n",
    );

    const built = buildImportRows(file, split, options);
    expect(built.rows).toHaveLength(1);
    expect(built.notRecords).toBe(2);
    expect(built.unreadable).toEqual([]);
  });

  it("explains what it cannot read", () => {
    const file = parseCsv(
      "Date,Note,Amount\n31/02/2026,Tea,20\n01/11/2026,Tea,abc\n",
    );

    expect(buildImportRows(file, single, options).unreadable).toEqual([
      { line: 2, reason: 'Line 2: the date "31/02/2026" is not a DD/MM/YYYY date.' },
      { line: 3, reason: 'Line 3: the amount "abc" is not an amount.' },
    ]);
  });

  it("refuses a row with both a debit and a credit", () => {
    const file = parseCsv("Date,N,Debit,Credit\n01/11/2026,X,10,20\n");

    expect(buildImportRows(file, split, options).unreadable).toEqual([
      { line: 2, reason: "Line 2: has both a debit and a credit." },
    ]);
  });

  it("keeps a missing description as no note and cuts a long one at 500", () => {
    const long = "x".repeat(600);
    const file = parseCsv(`Date,Note,Amount\n01/11/2026,,-5\n01/11/2026,${long},-5\n01/11/2026`);
    const { rows } = buildImportRows(file, single, options);

    expect(rows[0]?.note).toBeNull();
    expect(rows[1]?.note).toHaveLength(500);
    // The short third line has no amount at all: not a record.
    expect(rows).toHaveLength(2);
  });

  it("reads no note when there is no description column", () => {
    const file = parseCsv("Date,Amount\n01/11/2026,-5\n");
    const { rows } = buildImportRows(file, { ...single, description: null, amount: 1 }, options);

    expect(rows[0]?.note).toBeNull();
  });
});

describe("mappingProblem", () => {
  it("asks for a date column", () => {
    expect(mappingProblem({ ...single, date: null })).toBe("Choose the Date column.");
  });

  it("asks for an amount column, or both of the pair", () => {
    expect(mappingProblem({ ...single, amount: null })).toBe("Choose the Amount column.");
    expect(mappingProblem({ ...split, credit: null })).toBe(
      "Choose both the Debit and the Credit column.",
    );
  });

  it("refuses one column in two roles", () => {
    expect(mappingProblem({ ...single, amount: 0 })).toBe(
      "Each column can be used once.",
    );
    expect(mappingProblem({ ...split, credit: 2 })).toBe("Each column can be used once.");
  });

  it("is happy with a complete mapping", () => {
    expect(mappingProblem(single)).toBeNull();
    expect(mappingProblem(split)).toBeNull();
  });
});
