/**
 * `Intl.DateTimeFormat` the way this app writes dates.
 *
 * en-IN (and en-GB) give September as "Sept", the one four-letter month in
 * a column of three-letter ones, while the calendar and the date picker
 * write their months out as "Sep". Every short date goes through here so
 * the two never sit side by side on one screen.
 */
export function dateFormat(
  options: Intl.DateTimeFormatOptions,
  locale = "en-IN",
): { format: (date?: Date | number) => string } {
  const inner = new Intl.DateTimeFormat(locale, options);
  return {
    format: (date) => inner.format(date).replace(/\bSept\b/g, "Sep"),
  };
}

export type DateFormat = ReturnType<typeof dateFormat>;
