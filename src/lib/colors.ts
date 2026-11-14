/**
 * The sixteen colours an account or category can carry.
 *
 * One lightness and one chroma for all of them (OKLCH L 0.55, C 0.12; slate
 * drops to 0.02 because grey is the point of it). That is what makes them a
 * set rather than a collection: no swatch shouts louder than its neighbour,
 * and a list of eight categories reads as eight labels rather than as eight
 * alarms.
 *
 * Stored as #rrggbb, which is the shape the database CHECKs. Every one of
 * them carries a white icon at 4.4:1 or better, and stands at 3.1:1 or
 * better against both page backgrounds.
 */
export const COLORS = [
  "#008781", // teal — the brand
  "#007DAA", // sky
  "#4671B7", // blue
  "#6568B6", // indigo
  "#7D5FAD", // violet
  "#985593", // fuchsia
  "#A65175", // pink
  "#AC505B", // rose
  "#AD5349", // red
  "#AA5830", // orange
  "#9D6300", // amber
  "#8D6D00", // gold
  "#627D23", // lime
  "#3E8343", // green
  "#008760", // emerald
  "#69737D", // slate
] as const;

export type Color = (typeof COLORS)[number];

export const DEFAULT_COLOR: string = COLORS[0];

/**
 * What a dot falls back to when a row has no colour of its own.
 *
 * Slate, because a missing colour should read as "none chosen" rather than
 * as a category that happens to be grey.
 */
export const FALLBACK_COLOR: string = COLORS[15];

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isColor(value: string): boolean {
  return HEX.test(value);
}

/**
 * A deterministic swatch for a name, so a category created without picking a
 * colour still looks deliberate rather than grey.
 */
export function colorForName(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

/** sRGB 0–1 from #rrggbb, or null if it is not a colour. */
function channels(hex: string): [number, number, number] | null {
  if (!isColor(hex)) return null;

  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/** Relative luminance, the WCAG definition. */
function luminance(hex: string): number {
  const rgb = channels(hex);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Whether an icon on this colour should be light or dark.
 *
 * Every colour in the palette above answers "light", by construction. This
 * exists for everything else: a colour stored before the palette was curated,
 * or one written straight to the API. Picking by luminance means an icon is
 * never a pale shape on a pale circle, whatever ends up behind it.
 *
 * 0.45 rather than 0.5 because white text needs more room than black does —
 * contrast against white falls away faster than contrast against near-black.
 */
export function iconInkFor(hex: string): "light" | "dark" {
  return luminance(hex) > 0.45 ? "dark" : "light";
}

/**
 * The closest colour in the palette, for a value that is not in it.
 *
 * Compared in linear light rather than on the hex digits, which is the
 * difference between "nearest colour" and "nearest string".
 */
export function nearestColor(hex: string): string {
  const target = channels(hex);
  if (!target) return DEFAULT_COLOR;

  let best = DEFAULT_COLOR;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const option of COLORS) {
    const candidate = channels(option);
    if (!candidate) continue;

    const distance = candidate.reduce(
      (total, channel, index) => total + (channel - target[index]) ** 2,
      0,
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      best = option;
    }
  }

  return best;
}
