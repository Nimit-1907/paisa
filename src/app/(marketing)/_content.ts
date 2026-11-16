import {
  ChartPie,
  Repeat2,
  Target,
  Wallet,
  Smartphone,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * What the public pages say, as data.
 *
 * The FAQ answers are also the FAQPage structured data, and the features are
 * also the OG description. Writing them once is the only way the page and
 * what search engines are told cannot drift apart.
 */

/**
 * `id` is how a page asks for one of these.
 *
 * The landing page wants Track, Budget and Recurring specifically, and
 * reaching for them by position would break the moment this list is
 * reordered or trimmed - silently on a type level, loudly at render.
 */
export type FeatureId =
  "track" | "budget" | "charts" | "accounts" | "recurring" | "install";

export type Feature = {
  /** A `bg-tint-*` class: the grid uses the app's own eight. */
  tint: string;
  id: FeatureId;
  icon: LucideIcon;
  title: string;
  body: string;
};

export const FEATURES: Feature[] = [
  {
    id: "track",
    tint: "bg-tint-rose",
    icon: Zap,
    title: "A spend in seconds",
    body: "Pick the account and the category, type the amount on the keypad, save. The categories you usually pick at this hour come first, and the spends you repeat sit on one-tap chips that fill in all three.",
  },
  {
    id: "budget",
    tint: "bg-tint-butter",
    icon: Target,
    title: "A budget per category",
    body: "Set a monthly limit and the screen leads with the number you came for: what is left, and what that is per day for the days remaining. Amber at 80%, red when it is gone.",
  },
  {
    id: "charts",
    tint: "bg-tint-sky",
    icon: ChartPie,
    title: "Charts that agree with the list",
    body: "Spending by category, day by day, and your running balance, all added up in the database from the same rows the Records tab shows, so the chart and the list never disagree.",
  },
  {
    id: "accounts",
    tint: "bg-tint-mint",
    icon: Wallet,
    title: "Every account in one total",
    body: "Cash, bank, cards and wallets, with transfers between them that move money without counting as income or expense.",
  },
  {
    id: "recurring",
    tint: "bg-tint-peri",
    icon: Repeat2,
    title: "Rent that logs itself",
    body: "Set up the bills that repeat and they appear on the day they are due, including the months you did not open the app. They are caught up without ever duplicating a record.",
  },
  {
    id: "install",
    tint: "bg-tint-lilac",
    icon: Smartphone,
    title: "Works on your home screen",
    body: "Install it and it opens like an app, full screen, with no app store and nothing to update.",
  },
];

export type Faq = { question: string; answer: string };

export const FAQS: Faq[] = [
  {
    question: "Is Paisa free?",
    answer: "Yes. There is no paid tier, no advertising and nothing to unlock.",
  },
  {
    question: "Who can see my records?",
    answer:
      "Only you. Every table is scoped to your account by Postgres row level security, so a query can only ever return your own rows. That is enforced by the database, not by the app.",
  },
  {
    question: "Can I get my data out?",
    answer:
      "Whenever you like. The Export screen hands you every record as a CSV for any date range, or a month as a PDF report with the category breakdown and budget against actual.",
  },
  {
    question: "Does it connect to my bank?",
    answer:
      "No. Paisa never asks for a bank login, because it never needs one. You enter what you spend, which takes a few seconds and means there is no third party holding your credentials.",
  },
  {
    question: "Which currency does it use?",
    answer:
      "Rupees by default, and you can change the symbol and the number of decimal places in Settings. Amounts are stored as whole paise rather than decimal numbers, so a total never drifts by a rupee.",
  },
  {
    question: "Does it work offline?",
    answer:
      "No. Paisa needs a connection, so every screen shows what is saved in your account right now and nothing is ever held on one phone waiting to sync.",
  },
  {
    question: "Can I use it on a computer?",
    answer:
      "Yes. It is designed for a phone first, and from a laptop width the bottom tabs become a sidebar. The amount keypad takes a physical keyboard, including Enter to save.",
  },
];

/**
 * One feature by id, or a loud failure.
 *
 * Throwing rather than returning undefined: this runs while a Server
 * Component renders, so a missing id becomes a build-time error on the page
 * that asked for it instead of a blank card in production.
 */
export function feature(id: FeatureId): Feature {
  const found = FEATURES.find((item) => item.id === id);
  if (!found) throw new Error(`No feature called "${id}"`);
  return found;
}
