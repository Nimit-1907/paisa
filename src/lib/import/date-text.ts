/**
 * A date as a statement prints it, into `yyyy-mm-dd`.
 *
 * Numeric dates are read in the one format the person picked, never
 * guessed (a four-digit year first is the exception, it has one reading): 05/11 is the 5th of November or the 11th of May, and a file of
 * them read the wrong way is a year of records in the wrong months. A month
 * written as a name says which it is, so those read in any format.
 *
 * Whatever follows the date (a time, a "T10:00:00Z") is ignored: a record
 * from a file is placed by its day.
 */

export type DateFormat = "dmy" | "mdy" | "ymd";

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "ymd", label: "YYYY-MM-DD" },
];

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** "Nov", "November", "Sept" → 11, 11, 9. */
function monthNumber(name: string): number | null {
  const lower = name.toLowerCase();
  if (lower.length < 3) return null;

  const index = MONTHS.indexOf(lower.slice(0, 3));
  if (index === -1) return null;

  // The whole word has to be a spelling of that month, so "Novel" is not
  // November. "Sept" is the one four-letter short form in common use.
  const full = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(2000, index, 1)))
    .toLowerCase();

  return full.startsWith(lower) ? index + 1 : null;
}

/** 26 → 2026, 99 → 1999: a statement from before 1970 is not a thing. */
function fullYear(text: string): number {
  const value = Number(text);
  if (text.length > 2) return value;
  return value < 70 ? 2000 + value : 1900 + value;
}

function build(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  if (year < 1970 || year > 9999) return null;

  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SEP = String.raw`[\/\-. ]`;

/** dd-Mon-yyyy, yyyy-Mon-dd and Mon dd, yyyy. */
function readNamed(text: string): string | null | undefined {
  let match = new RegExp(
    String.raw`^(\d{1,2})${SEP}+([A-Za-z]+)\.?,?${SEP}+(\d{2}|\d{4})(?!\d)`,
  ).exec(text);
  if (match) {
    const month = monthNumber(match[2]);
    return month ? build(fullYear(match[3]), month, Number(match[1])) : null;
  }

  match = new RegExp(
    String.raw`^(\d{4})${SEP}+([A-Za-z]+)\.?${SEP}+(\d{1,2})(?!\d)`,
  ).exec(text);
  if (match) {
    const month = monthNumber(match[2]);
    return month ? build(Number(match[1]), month, Number(match[3])) : null;
  }

  match = new RegExp(
    String.raw`^([A-Za-z]+)\.?${SEP}+(\d{1,2}),?${SEP}+(\d{2}|\d{4})(?!\d)`,
  ).exec(text);
  if (match) {
    const month = monthNumber(match[1]);
    return month ? build(fullYear(match[3]), month, Number(match[2])) : null;
  }

  // Not a named-month date at all: let the numeric reader try.
  return undefined;
}

export function readDate(input: string, format: DateFormat): string | null {
  const text = input.trim();
  if (text === "") return null;

  const named = readNamed(text);
  if (named !== undefined) return named;

  // A four-digit year first is year, month, day in every format anybody
  // writes, so it is read whichever format was chosen.
  const iso = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/.exec(text);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (format === "ymd") return null;

  const match = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?!\d)/.exec(
    text,
  );
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = fullYear(match[3]);

  return format === "dmy"
    ? build(year, second, first)
    : build(year, first, second);
}
