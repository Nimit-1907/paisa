/**
 * CSV writing.
 *
 * Small enough to own rather than depend on, and the two rules that matter
 * are both easy to get wrong: quoting, and not handing a spreadsheet a
 * formula to run.
 */

/**
 * One field, quoted when it has to be.
 *
 * A leading `=`, `+`, `-`, `@`, tab or carriage return makes Excel, Sheets and
 * LibreOffice treat the cell as a formula, `=HYPERLINK(...)` in a note is a
 * phishing link in someone else's spreadsheet. Prefixing with an apostrophe
 * is the usual defence: the cell reads as text and the apostrophe is not
 * shown.
 */
export function csvField(value: string | null | undefined): string {
  const text = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return /[",\n\r]/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

/** One line, with the CRLF line ending RFC 4180 asks for. */
export function csvRow(fields: (string | null | undefined)[]): string {
  return `${fields.map(csvField).join(",")}\r\n`;
}

/**
 * The byte-order mark Excel wants before it will read UTF-8.
 *
 * Without it, a note with a rupee sign or a name in Devanagari opens as
 * mojibake on a default Windows install.
 */
export const UTF8_BOM = "﻿";

export const RECORD_COLUMNS = [
  "Date",
  "Time",
  "Type",
  "Category",
  "Account",
  "To account",
  "Amount",
  "Note",
] as const;
