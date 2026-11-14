/**
 * The colour swatches an account or category can carry.
 *
 * Stored as #rrggbb (the DB CHECKs that shape). Each one is picked to stay
 * legible as a small filled circle on both the light and dark surfaces, which
 * rules out the very pale and the very dark ends of each hue.
 */
export const COLORS = [
  "#0F766E", // teal — the brand
  "#0EA5E9", // sky
  "#2563EB", // blue
  "#6366F1", // indigo
  "#7C3AED", // violet
  "#D946EF", // fuchsia
  "#EC4899", // pink
  "#F43F5E", // rose
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#CA8A04", // gold
  "#65A30D", // lime
  "#22C55E", // green
  "#14B8A6", // emerald
  "#64748B", // slate
] as const;

export type Color = (typeof COLORS)[number];

export const DEFAULT_COLOR: string = COLORS[0];

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
