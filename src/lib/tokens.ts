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

/** The eight soft tints an account or category can carry. */
export const TINT_KEYS = [
  "rose",
  "peach",
  "sky",
  "butter",
  "mint",
  "lilac",
  "peri",
  "neutral",
] as const;

export type TintKey = (typeof TINT_KEYS)[number];

/** What a tint falls back to when a row has none. */
export const DEFAULT_TINT: TintKey = "neutral";

export function isTint(value: string): value is TintKey {
  return (TINT_KEYS as readonly string[]).includes(value);
}

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
      rose: "#FCE4E1",
      peach: "#FCE9D9",
      sky: "#E1EDF8",
      butter: "#FAF0CF",
      mint: "#E2F1E5",
      lilac: "#ECE6FA",
      peri: "#E5E8FE",
      neutral: "#EFEEEA",
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
      rose: "#3A2624",
      peach: "#3A2C20",
      sky: "#1F2B37",
      butter: "#36301B",
      mint: "#1F3125",
      lilac: "#2C2539",
      peri: "#262A45",
      neutral: "#242424",
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

/** The eight, in order, for a chart that has to colour things it cannot name. */
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
