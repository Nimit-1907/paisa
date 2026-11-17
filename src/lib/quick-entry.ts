import { type KeywordMap, guessCategory } from "@/lib/import/category-guess";

/**
 * One line, "250 chai cash", read as a record.
 *
 * The amount is the first money figure anywhere in the line: "250",
 * "₹250", "Rs 1,200", "1.2k". An account is a word that starts its name
 * ("icici" for ICICI Credit Card, three letters at least). A category is
 * a word that is its name ("food"), or else the one this person used
 * before for a note that starts the same way, the same guess CSV import
 * makes. A leading "+" makes it income. Whatever is left is the note.
 *
 * Anything it cannot tell is null, and the caller decides: save at once
 * when nothing is missing, otherwise open Add Record with what is known.
 */
export type QuickEntry = {
  type: "expense" | "income";
  /** Amount-field text, "250" or "99.50", or null. */
  amount: string | null;
  note: string | null;
  accountId: string | null;
  categoryId: string | null;
};

const MONEY = /^(?:₹|rs\.?|inr)?(\d[\d,]*(?:\.\d{1,2})?)(k)?$/i;
const CURRENCY_WORD = /^(?:₹|rs\.?|inr)$/i;

export function parseQuickEntry(
  text: string,
  {
    accounts,
    categories,
    keywords,
  }: {
    accounts: readonly { id: string; name: string }[];
    categories: readonly {
      id: string;
      name: string;
      kind: "expense" | "income";
    }[];
    keywords: KeywordMap;
  },
): QuickEntry {
  let line = text.trim();
  const type = line.startsWith("+") ? "income" : "expense";
  if (type === "income") line = line.slice(1).trim();

  let words = line.split(/\s+/).filter(Boolean);

  // The amount: the first word that is money.
  let amount: string | null = null;
  const at = words.findIndex((word) => MONEY.test(word));
  if (at >= 0) {
    amount = moneyText(words[at]!);
    words = words.filter((_, index) => index !== at);
  }
  words = words.filter((word) => !CURRENCY_WORD.test(word));

  // The account: a word long enough to mean one, matching exactly one.
  let accountId: string | null = null;
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const word = words[index]!.toLowerCase();
    if (word.length < 3) continue;
    const matches = accounts.filter((account) =>
      account.name.toLowerCase().startsWith(word),
    );
    if (matches.length === 1) {
      accountId = matches[0]!.id;
      words.splice(index, 1);
      break;
    }
  }

  // A category named outright, of this type.
  let categoryId: string | null = null;
  const named = words.findIndex((word) =>
    categories.some(
      (category) =>
        category.kind === type &&
        category.name.toLowerCase() === word.toLowerCase(),
    ),
  );
  if (named >= 0) {
    const word = words[named]!.toLowerCase();
    categoryId =
      categories.find(
        (category) =>
          category.kind === type && category.name.toLowerCase() === word,
      )?.id ?? null;
    words.splice(named, 1);
  }

  const note = words.join(" ").trim() || null;
  if (!categoryId) categoryId = guessCategory(keywords, type, note);

  return { type, amount, note, accountId, categoryId };
}

/** "₹1,200" → "1200", "1.2k" → "1200"; null for zero. */
function moneyText(word: string): string | null {
  const match = MONEY.exec(word);
  if (!match) return null;

  const digits = match[1]!.replace(/,/g, "");
  if (!match[2]) return Number(digits) > 0 ? digits : null;

  // Thousands, in whole paise so 1.2k is exactly 1200.
  const [whole, fraction = ""] = digits.split(".");
  const paise = BigInt(whole! + fraction.padEnd(2, "0").slice(0, 2)) * 1000n;
  if (paise <= 0n) return null;
  const rupees = paise / 100n;
  const rest = paise % 100n;
  return rest === 0n
    ? rupees.toString()
    : `${rupees}.${rest.toString().padStart(2, "0")}`;
}
