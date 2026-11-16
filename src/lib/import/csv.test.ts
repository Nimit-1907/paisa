import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/import/csv";

/**
 * The reader for whatever a bank or another app wrote.
 *
 * RFC 4180 is short and every exporter bends it a different way: Excel adds
 * a BOM and CRLF, European locales use `;`, and a narration with a comma in
 * it arrives quoted. Each of those is a file somebody will try on day one.
 */

describe("parseCsv", () => {
  it("reads a plain header and rows", () => {
    expect(parseCsv("Date,Amount,Note\n01/11/2026,-250,Tea\n")).toEqual({
      delimiter: ",",
      headers: ["Date", "Amount", "Note"],
      rows: [{ line: 2, cells: ["01/11/2026", "-250", "Tea"] }],
    });
  });

  it("keeps a delimiter, a newline and an escaped quote inside quotes", () => {
    const text = 'Date,Note\n01/11/2026,"Rent, November"\n02/11/2026,"Said ""hi""\nthen left"\n';

    expect(parseCsv(text).rows).toEqual([
      { line: 2, cells: ["01/11/2026", "Rent, November"] },
      { line: 3, cells: ["02/11/2026", 'Said "hi"\nthen left'] },
    ]);
  });

  it("handles CRLF line endings and a missing final newline", () => {
    expect(parseCsv("Date,Amount\r\n01/11/2026,10\r\n02/11/2026,20").rows).toEqual([
      { line: 2, cells: ["01/11/2026", "10"] },
      { line: 3, cells: ["02/11/2026", "20"] },
    ]);
  });

  it("drops a UTF-8 byte-order mark before the first header", () => {
    expect(parseCsv("﻿Date,Amount\n01/11/2026,10\n").headers).toEqual([
      "Date",
      "Amount",
    ]);
  });

  it("detects a semicolon delimiter from the header", () => {
    const parsed = parseCsv("Date;Amount;Note\n01/11/2026;-1,50;Bread, white\n");

    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows[0]?.cells).toEqual(["01/11/2026", "-1,50", "Bread, white"]);
  });

  it("does not count a quoted semicolon when detecting", () => {
    expect(parseCsv('"Date;Time",Amount\n1,2\n').delimiter).toBe(",");
  });

  it("skips blank lines but keeps counting them", () => {
    const parsed = parseCsv("Date,Amount\n\n01/11/2026,10\n , \n\r\n02/11/2026,20\n\n");

    expect(parsed.rows).toEqual([
      { line: 3, cells: ["01/11/2026", "10"] },
      { line: 6, cells: ["02/11/2026", "20"] },
    ]);
  });

  it("skips blank lines before the header", () => {
    expect(parseCsv("\n\nDate,Amount\n1,2\n").headers).toEqual(["Date", "Amount"]);
  });

  it("trims the header names", () => {
    expect(parseCsv(" Date , Amount \n1,2").headers).toEqual(["Date", "Amount"]);
  });

  it("answers an empty file with no headers and no rows", () => {
    expect(parseCsv("")).toEqual({ delimiter: ",", headers: [], rows: [] });
    expect(parseCsv("﻿\r\n")).toEqual({ delimiter: ",", headers: [], rows: [] });
  });

  it("reads a lone carriage return as a line ending", () => {
    expect(parseCsv("A,B\r1,2\r3,4").rows.map((row) => row.cells)).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});
