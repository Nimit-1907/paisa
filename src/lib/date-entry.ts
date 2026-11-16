/**
 * Typing a date without typing its punctuation.
 *
 * People enter a date as the digits they see on a receipt. Asking them to
 * also find "/" or "-" on a phone's number pad (which often has neither) is
 * friction for nothing, so the field takes digits only and draws the
 * slashes itself: 1 5 1 1 2 0 2 6 becomes 15/11/2026.
 *
 * Day first, because this app's default locale is en-IN and that is how a
 * date is written there.
 */

/** Strips everything but digits, to at most eight. */
export function digitsOf(text: string): string {
  return text.replace(/\D/g, "").slice(0, 8);
}

/**
 * Digits as they should be shown while being typed.
 *
 * A slash appears only once the next digit has arrived ("15" not "15/"), so
 * backspacing never gets stuck behind a slash the user did not type.
 */
export function maskDate(digits: string): string {
  const d = digitsOf(digits);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Eight digits (DDMMYYYY) to `yyyy-mm-dd`, or null if they are not a real
 * calendar date. 31/02/2026 is null rather than quietly becoming 3 March.
 */
export function digitsToIso(digits: string): string | null {
  const d = digitsOf(digits);
  if (d.length !== 8) return null;

  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));

  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `yyyy-mm-dd` to DD/MM/YYYY, or "" for anything else. */
export function isoToMasked(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/*
 * Typing a time the same way: digits only, the colon drawn for you, on a
 * twelve-hour clock with AM and PM chosen beside it. 0 1 3 0 is 01:30.
 */

export type Meridiem = "am" | "pm";

/** Strips everything but digits, to at most four. */
export function timeDigitsOf(text: string): string {
  return text.replace(/\D/g, "").slice(0, 4);
}

/** Digits as shown while being typed: "1", "13", "13:0", "13:05". */
export function maskTime(digits: string): string {
  const d = timeDigitsOf(digits);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/**
 * Typed digits and a meridiem to `HH:MM` on the 24-hour clock, or null.
 *
 * Three digits read as h:mm ("930" is 9:30), four as hh:mm. An hour past
 * 12 is taken as the 24-hour clock and the meridiem is ignored, so somebody
 * who types 1830 gets 18:30 rather than an error. 00 is midnight.
 */
export function timeDigitsToValue(
  digits: string,
  meridiem: Meridiem,
): string | null {
  const d = timeDigitsOf(digits);
  if (d.length < 3) return null;

  const hourText = d.length === 3 ? d.slice(0, 1) : d.slice(0, 2);
  const minuteText = d.length === 3 ? d.slice(1) : d.slice(2);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return null;

  let hour24 = hour;
  if (hour >= 1 && hour <= 12) {
    if (meridiem === "am") hour24 = hour === 12 ? 0 : hour;
    else hour24 = hour === 12 ? 12 : hour + 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** `HH:MM` (24-hour) to what the field shows: "01:30" and "pm". */
export function valueToTimeParts(value: string): {
  text: string;
  meridiem: Meridiem;
} {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return { text: "", meridiem: "am" };
  const hour = Number(match[1]);
  const meridiem: Meridiem = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    text: `${String(hour12).padStart(2, "0")}:${match[2]}`,
    meridiem,
  };
}
