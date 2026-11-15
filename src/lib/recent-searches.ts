/**
 * The last few things searched for, on this device.
 *
 * A per-device convenience, like the remembered email: it never leaves the
 * browser, nothing depends on it, and the screen is correct without it. Every
 * accessor is wrapped, because a private window or blocked site data makes
 * them throw rather than return nothing — and a search screen that crashes
 * because it could not read a history is worse than one with no history.
 *
 * Notes can hold anything somebody typed, so these strings are rendered as
 * text and only ever put back into the search box. Nothing here is trusted
 * to be a safe URL or markup.
 */

const KEY = "paisa:recent-searches";

/** Five is a list you can read; twenty is a second screen to search. */
export const MAX_RECENT = 5;

/** The longest query worth keeping — past this it is a paste, not a search. */
const MAX_LENGTH = 80;

function read(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Whatever is in storage was written by an older version of this app, by
    // another tab, or by hand in devtools. It is shaped here rather than
    // trusted.
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recentSearches(): string[] {
  try {
    return read(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

/**
 * Remembers a query, newest first, with no duplicates.
 *
 * Matched case-insensitively so "Swiggy" typed after "swiggy" moves the one
 * entry up rather than making a second.
 */
export function rememberSearch(query: string): string[] {
  const term = query.trim().slice(0, MAX_LENGTH);
  if (!term) return recentSearches();

  const next = [
    term,
    ...recentSearches().filter(
      (item) => item.toLowerCase() !== term.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT);

  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Nothing to do, and nothing lost.
  }

  return next;
}

export function forgetSearches(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}

/** Exported for the tests, which should not need a browser to check shaping. */
export const __testing = { read };
