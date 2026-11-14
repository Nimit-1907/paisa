/**
 * The iOS launch screens.
 *
 * Safari will only use a startup image whose pixel dimensions match the
 * device exactly, so each one needs its own <link> with its own media query.
 * They are rendered on demand rather than committed as a dozen PNGs: the
 * artwork is a wordmark on a flat background, which is a few lines of code
 * and would otherwise be several megabytes of binary in the repository for
 * ever.
 *
 * Without these, an installed app opens on a white rectangle while it starts.
 */
export type Splash = {
  /** CSS pixels, as Safari reports them. */
  width: number;
  height: number;
  ratio: number;
};

/** The current iPhone sizes, plus the SE that is still sold. */
export const SPLASHES: Splash[] = [
  { width: 375, height: 667, ratio: 2 }, // SE
  { width: 390, height: 844, ratio: 3 }, // 12/13/14
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 16
  { width: 428, height: 926, ratio: 3 }, // 12/13/14 Plus
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Pro Max
];

export function splashMedia({ width, height, ratio }: Splash): string {
  return `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio})`;
}

export function splashHref({ width, height, ratio }: Splash): string {
  return `/splash?w=${width * ratio}&h=${height * ratio}`;
}

/** Guards the route against being asked for a 10000px image. */
export function isKnownSplash(width: number, height: number): boolean {
  return SPLASHES.some(
    (splash) =>
      splash.width * splash.ratio === width &&
      splash.height * splash.ratio === height,
  );
}
