import { Bricolage_Grotesque, Inter } from "next/font/google";

/**
 * The two families, loaded once.
 *
 * next/font fetches these at build time and serves them from this origin, so
 * nobody learns what you read by loading a page here.
 *
 * Inter is everything you read: lists, forms, every amount in a row, with
 * tabular figures so columns of money line up.
 *
 * Bricolage Grotesque is the display face, and Phase 14 gives it two jobs
 * only, page titles and hero numbers. One weight, 800, at -0.03em. It
 * replaces Instrument Serif: the new design language is flat surfaces,
 * hairlines and hard shadows, and a serif anchor reads as warmth from a
 * different system. See docs/design-system.md.
 *
 * The display face loads `latin-ext` as well as `latin`, because the
 * rupee sign is in it: U+20B9 sits in latin-ext's currency range, not
 * latin's. With only latin preloaded, every screen with an amount on it
 * found out it needed the second file after layout, fetched it late, and
 * swapped the hero figure when it arrived. That swap was Records' largest
 * paint, at 2.75s on a throttled phone. Listing the subset makes
 * next/font preload it with the rest. Inter is the other way round, and
 * says why below.
 */
export const body = Inter({
  // Not preloaded, and `optional` rather than `swap`. Inter is 85 kB, the
  // largest thing on the page. Preloaded, it raced the stylesheet and held
  // the first paint back 420ms on a slow phone connection; swapped in
  // late, it re-laid every paragraph at ~4s, and that repaint is what the
  // browser reported as the page's LCP. `optional` uses Inter if it is
  // already there (any visit after the first, or a fast connection) and
  // otherwise keeps the system sans for that visit. latin-ext still loads
  // on demand, through its unicode-range, for the ₹ sign.
  //
  // Measured, cold, Slow 4G and 4x CPU: LCP 908/3996/876ms on Records,
  // Analysis and Budgets before; 728/684/668ms after. Inlining the CSS
  // instead (experimental.inlineCss) was tried and lost: it ships the
  // stylesheet twice, in the HTML and in the RSC payload, and Budgets
  // went to 1040ms.
  subsets: ["latin"],
  preload: false,
  variable: "--font-body",
  display: "optional",
});

export const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  // 800 is the only weight used. Loading the variable range would ship the
  // whole axis for two sizes of one word.
  weight: "800",
  // Not `--font-display`: Tailwind's theme key of that name resolves to
  // this variable, and a variable pointing at itself resolves to nothing.
  variable: "--font-display-face",
  display: "swap",
});
