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
 * only — page titles and hero numbers. One weight, 800, at -0.03em. It
 * replaces Instrument Serif: the new design language is flat surfaces,
 * hairlines and hard shadows, and a serif anchor reads as warmth from a
 * different system. See docs/design-system.md.
 */
export const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  // 800 is the only weight used. Loading the variable range would ship the
  // whole axis for two sizes of one word.
  weight: "800",
  // Not `--font-display`: Tailwind's theme key of that name resolves to
  // this variable, and a variable pointing at itself resolves to nothing.
  variable: "--font-display-face",
  display: "swap",
});
