import { Instrument_Serif, Inter } from "next/font/google";

/**
 * The two families, loaded once.
 *
 * next/font fetches these at build time and serves them from this origin, so
 * nobody learns what you read by loading a page here.
 *
 * Inter is everything you read: lists, forms, every amount in a row, with
 * tabular figures so columns of money line up. Instrument Serif is the
 * anchor, and it appears in three places — the figure on the month card,
 * page titles, and the landing headline. Phase 12 compared it against Space
 * Grotesk and against no anchor at all; docs/visual-identity.md has the
 * screenshots and the reasoning.
 */
export const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});
