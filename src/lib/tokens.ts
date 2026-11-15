/**
 * The Phase 14 colour tokens, as data.
 *
 * `globals.css` is the source these are written to; this file exists so the
 * contrast test can read them without parsing CSS, and so a component that
 * genuinely needs a value at runtime (a chart fill, a canvas) has one place
 * to ask. Nothing here should be used to write a colour into a `style`
 * attribute that a class could set instead.
 *
 * Keep in step with `globals.css`. `tokens.test.ts` asserts the two agree.
 */

export type Theme = "light" | "dark";

/**
 * The sixteen soft tints an account or category can carry.
 *
 * Ordered around the colour wheel so the picker reads as a spectrum rather
 * than a bag of swatches, with the two greys last. Every one is pale enough
 * to take plain ink at 10:1 or better in both themes, and the set was chosen
 * by maximising the smallest distance between any two of them under that
 * constraint: no two are closer than 19 in light and 13 in dark, where the
 * eight they replace had pairs at 8. Sixteen similar pastels are only worth
 * having if a thumbnail of one is not mistakable for another.
 */
export const TINT_KEYS = [
  "rose",
  "coral",
  "peach",
  "amber",
  "butter",
  "sand",
  "sage",
  "mint",
  "teal",
  "ice",
  "sky",
  "peri",
  "lilac",
  "plum",
  "slate",
  "neutral",
] as const;

export type TintKey = (typeof TINT_KEYS)[number];

/** What a tint falls back to when a row has none. */
export const DEFAULT_TINT: TintKey = "neutral";

export function isTint(value: string): value is TintKey {
  return (TINT_KEYS as readonly string[]).includes(value);
}

/**
 * The background class each tint paints with.
 *
 * One map, exported, because the three components that paint a tint (the
 * picker, the tile and the pill) each used to carry their own copy. At
 * eight entries that was duplication; at sixteen it is a promise that one
 * of them will be edited and the others will not, and two components
 * disagreeing about which class `teal` gets is not a failure any test
 * would catch. Written out rather than interpolated so Tailwind can see
 * every class name.
 */
export const TINT_BG: Record<TintKey, string> = {
  rose: "bg-tint-rose",
  coral: "bg-tint-coral",
  peach: "bg-tint-peach",
  amber: "bg-tint-amber",
  butter: "bg-tint-butter",
  sand: "bg-tint-sand",
  sage: "bg-tint-sage",
  mint: "bg-tint-mint",
  teal: "bg-tint-teal",
  ice: "bg-tint-ice",
  sky: "bg-tint-sky",
  peri: "bg-tint-peri",
  lilac: "bg-tint-lilac",
  plum: "bg-tint-plum",
  slate: "bg-tint-slate",
  neutral: "bg-tint-neutral",
};

type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  onInk: string;
  text: string;
  textSecondary: string;
  hairline: string;
  barMuted: string;
  income: string;
  expense: string;
  transfer: string;
  accent: string;
  tints: Record<TintKey, string>;
};

export const PALETTE: Record<Theme, Palette> = {
  light: {
    background: "#F6F6F4",
    surface: "#FFFFFF",
    surfaceMuted: "#EFEEEA",
    ink: "#141414",
    onInk: "#FFFFFF",
    text: "#141414",
    textSecondary: "#6B6A66",
    hairline: "#E4E2DD",
    barMuted: "#D6D4CE",
    income: "#1E6B3A",
    expense: "#A1302A",
    transfer: "#1D5C8C",
    accent: "#C7CEFF",
    tints: {
      rose: "#F6D2D7",
      coral: "#FCE3DF",
      peach: "#FEDCC7",
      amber: "#F2F2D2",
      butter: "#EEECBA",
      sand: "#E6E0D7",
      sage: "#DFF4C6",
      mint: "#D8F6D9",
      teal: "#C9EEE9",
      ice: "#C3F2FF",
      sky: "#D9ECFD",
      peri: "#D0D8F6",
      lilac: "#EBE0FD",
      plum: "#ECD4E8",
      slate: "#DAE0E7",
      neutral: "#E9EDE7",
    },
  },
  dark: {
    background: "#111111",
    surface: "#1A1A1A",
    surfaceMuted: "#242424",
    ink: "#EDEDED",
    onInk: "#111111",
    text: "#F2F2F2",
    textSecondary: "#A3A3A3",
    hairline: "#2C2C2C",
    barMuted: "#3A3A3A",
    income: "#8FD3A4",
    expense: "#F2A9A3",
    transfer: "#9CC9EC",
    accent: "#4A5293",
    tints: {
      rose: "#3C2126",
      coral: "#452C1D",
      peach: "#342B16",
      amber: "#423914",
      butter: "#383A21",
      sand: "#322C28",
      sage: "#27371F",
      mint: "#1C3A29",
      teal: "#163C35",
      ice: "#0E2E39",
      sky: "#1D2B3E",
      peri: "#22284D",
      lilac: "#2F2140",
      plum: "#3C2039",
      slate: "#272E35",
      neutral: "#262626",
    },
  },
};

/** sRGB 0–1 from #rrggbb. */
function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
}

/** Relative luminance, the WCAG definition. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio between two opaque colours, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A tint as a CSS value, for somewhere a class cannot reach.
 *
 * Charts are the only place: recharts wants a `fill` string, not a class
 * name. It stays a `var()` rather than a resolved hex so an SVG painted with
 * it follows light and dark without a theme hook or a re-render — which is
 * also why `src/lib/colors.ts`'s hexes could never have been used here
 * safely once the palette started having two halves.
 */
export function tintVar(tint: string | null | undefined): string {
  return `var(--tint-${isTint(tint ?? "") ? tint : DEFAULT_TINT})`;
}

/** The sixteen, in order, for a chart that has to colour what it cannot name. */
export const TINT_CYCLE: string[] = TINT_KEYS.filter(
  (key) => key !== "neutral",
).map((key) => `var(--tint-${key})`);

/**
 * A tint picked from a name, so a new category starts somewhere sensible.
 *
 * Stable and spread: the same name always gets the same tint, and two names
 * typed one after another almost never get the same one. `neutral` is left
 * out — it is the fallback for a row with no tint at all, and handing it out
 * as a default would make "no colour chosen" and "grey chosen" the same
 * thing.
 */
export function tintForName(name: string): TintKey {
  const palette = TINT_KEYS.filter((key) => key !== "neutral");

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }

  return palette[hash % palette.length]!;
}
