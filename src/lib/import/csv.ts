/**
 * CSV reading, for Import.
 *
 * Small enough to own rather than depend on (the writer in
 * `src/lib/export/csv.ts` is the same choice the other way round). RFC 4180
 * with the bends real exporters add: a byte-order mark from Excel, CRLF or a
 * lone CR, `;` where the decimal separator is a comma, and blank lines
 * anywhere, including before the header.
 */

export type CsvDelimiter = "," | ";";

export type CsvRow = {
  /** The line of the file this row starts on, header included, from 1. */
  line: number;
  cells: string[];
};

export type ParsedCsv = {
  delimiter: CsvDelimiter;
  /** The first non-blank row, trimmed. Empty for an empty file. */
  headers: string[];
  rows: CsvRow[];
};

/**
 * The delimiter, from the header line: whichever of `,` and `;` appears
 * more often outside quotes. A tie (a one-column file) is a comma.
 */
function detectDelimiter(text: string): CsvDelimiter {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;

  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) {
      // Only the header line counts, and a blank line before it is not one.
      if (commas + semicolons > 0) break;
    } else if (!quoted && char === ",") commas += 1;
    else if (!quoted && char === ";") semicolons += 1;
  }

  return semicolons > commas ? ";" : ",";
}

/** Every record of the file, blank ones included, with its first line. */
function records(text: string, delimiter: CsvDelimiter): CsvRow[] {
  const out: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let index = 0;

  const endRecord = () => {
    cells.push(cell);
    out.push({ line: startLine, cells });
    cells = [];
    cell = "";
  };

  while (index < text.length) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n" || (char === "\r" && text[index + 1] !== "\n")) {
          line += 1;
        }
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRecord();
      line += 1;
      startLine = line;
    } else {
      cell += char;
    }

    index += 1;
  }

  // A file that does not end in a newline still has its last record.
  if (cell !== "" || cells.length > 0) endRecord();

  return out;
}

const isBlank = (row: CsvRow) => row.cells.every((cell) => cell.trim() === "");

export function parseCsv(input: string): ParsedCsv {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const all = records(text, delimiter).filter((row) => !isBlank(row));

  const [header, ...rows] = all;
  if (!header) return { delimiter, headers: [], rows: [] };

  return {
    delimiter,
    headers: header.cells.map((cell) => cell.trim()),
    rows,
  };
}
