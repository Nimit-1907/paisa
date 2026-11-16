/**
 * A category for an imported row, from the person's own history.
 *
 * The keyword of a note is its first meaningful word: lowercased, digits
 * and punctuation stripped, at least three letters, and not one of the
 * words banks put in front of every narration. A row gets a category when
 * its keyword is one the person has used before for the same type, and the
 * category is the one they used it with most.
 */

export type GuessType = "expense" | "income";

/** Words that say how money moved, never what it was for. */
const STOP_WORDS = new Set([
  "upi",
  "pos",
  "neft",
  "imps",
  "rtgs",
  "nach",
  "ach",
  "ecs",
  "txn",
  "ref",
  "the",
  "and",
  "for",
  "via",
  "to",
  "from",
  "payment",
  "paid",
]);

export function noteKeyword(note: string | null | undefined): string | null {
  if (!note) return null;

  const words = note
    .toLowerCase()
    // An apostrophe is inside a word, not between two: "mcdonald's".
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u);

  for (const word of words) {
    const letters = word.replace(/\p{N}+/gu, "");
    if (letters.length >= 3 && !STOP_WORDS.has(letters)) return letters;
  }

  return null;
}

export type KeywordMap = Record<GuessType, Record<string, string>>;

export type HistoryRecord = {
  type: string;
  note: string | null;
  categoryId: string | null;
};

/**
 * Keyword → most used category, per type.
 *
 * `history` is newest first, and a tie goes to the category seen first, so
 * when the person changed their mind about where something belongs, the
 * newer choice wins.
 */
export function buildKeywordMap(history: HistoryRecord[]): KeywordMap {
  const counts: Record<GuessType, Map<string, Map<string, number>>> = {
    expense: new Map(),
    income: new Map(),
  };

  for (const record of history) {
    if (record.type !== "expense" && record.type !== "income") continue;
    if (!record.categoryId) continue;

    const keyword = noteKeyword(record.note);
    if (!keyword) continue;

    const byCategory = counts[record.type].get(keyword) ?? new Map();
    byCategory.set(record.categoryId, (byCategory.get(record.categoryId) ?? 0) + 1);
    counts[record.type].set(keyword, byCategory);
  }

  const map: KeywordMap = { expense: {}, income: {} };

  for (const type of ["expense", "income"] as const) {
    for (const [keyword, byCategory] of counts[type]) {
      let best: string | null = null;
      let most = 0;
      // Map keeps insertion order, so a strict ">" keeps the first seen.
      for (const [categoryId, count] of byCategory) {
        if (count > most) {
          best = categoryId;
          most = count;
        }
      }
      if (best) map[type][keyword] = best;
    }
  }

  return map;
}

export function guessCategory(
  map: KeywordMap,
  type: GuessType,
  description: string | null,
): string | null {
  const keyword = noteKeyword(description);
  if (!keyword) return null;

  return Object.hasOwn(map[type], keyword) ? map[type][keyword] : null;
}
