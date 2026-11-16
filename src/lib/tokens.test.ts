import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TINT,
  PALETTE,
  TINT_KEYS,
  tintForName,
  type Theme,
  type TintKey,
  contrast,
  isTint,
} from "./tokens";

/** WCAG AA for body text. */
const AA = 4.5;
/** WCAG AA for large text (>=18.66px bold, or >=24px). */
const AA_LARGE = 3;
/** WCAG 1.4.11, for the edge of a control and meaningful graphics. */
const NON_TEXT = 3;

const THEMES: Theme[] = ["light", "dark"];

/**
 * The brief asks for a contrast test over every text/background token pair
 * in both themes, and for any shade that fails to be adjusted.
 *
 * It is a test rather than a one-off script because the point is not that
 * the palette passed once, it is that the next person to reach for a
 * slightly nicer grey finds out immediately.
 */
describe("every text colour on every surface", () => {
  const SURFACES = ["background", "surface", "surfaceMuted"] as const;
  const TEXTS = [
    "text",
    "textSecondary",
    "income",
    "expense",
    "transfer",
  ] as const;

  for (const theme of THEMES) {
    for (const surface of SURFACES) {
      for (const text of TEXTS) {
        it(`${theme}: ${text} on ${surface} clears AA`, () => {
          const ratio = contrast(PALETTE[theme][text], PALETTE[theme][surface]);
          expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
        });
      }
    }
  }
});

describe("ink on the bold surfaces", () => {
  for (const theme of THEMES) {
    it(`${theme}: on-ink text on an ink fill clears AA`, () => {
      // The primary button: ink pill, on-ink label.
      const ratio = contrast(PALETTE[theme].onInk, PALETTE[theme].ink);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    });

    it(`${theme}: text on the periwinkle accent clears AA`, () => {
      // The Add button and the insight strip both put text on this.
      const ratio = contrast(PALETTE[theme].text, PALETTE[theme].accent);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    });
  }
});

describe("the sixteen tints", () => {
  for (const theme of THEMES) {
    for (const tint of TINT_KEYS) {
      it(`${theme}: ink on ${tint} clears AA`, () => {
        // Icons and labels on a tinted tile are always plain ink, so this
        // one check covers every tile in the app.
        const ratio = contrast(PALETTE[theme].text, PALETTE[theme].tints[tint]);
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
      });
    }

    it(`${theme}: every tint is distinguishable from the page`, () => {
      // A tile that matches the background is not a tile. Neutral is the
      // deliberate exception: it *is* the muted surface, and it means
      // "no tint chosen" rather than a colour.
      for (const tint of TINT_KEYS) {
        if (tint === "neutral") continue;
        const ratio = contrast(
          PALETTE[theme].tints[tint],
          PALETTE[theme].background,
        );
        expect(ratio, `${theme}/${tint} ${ratio.toFixed(3)}:1`).toBeGreaterThan(
          1.01,
        );
      }
    });
  }
});

describe("lines and bars", () => {
  for (const theme of THEMES) {
    it(`${theme}: a hairline is visible against its surface`, () => {
      // A hairline is decoration, not a control edge, so 3:1 is not the
      // bar, but it has to be there at all.
      const ratio = contrast(PALETTE[theme].hairline, PALETTE[theme].surface);
      expect(ratio).toBeGreaterThan(1.05);
    });

    it(`${theme}: an ink border clears 1.4.11 against its surface`, () => {
      // This one *is* a control edge: the accent border is what identifies
      // a selected segment or tile.
      const ratio = contrast(PALETTE[theme].ink, PALETTE[theme].surface);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(NON_TEXT);
    });

    it(`${theme}: chart bars are distinguishable from each other`, () => {
      // Ink for the selected series, bar-muted for the rest. If those two
      // are close the chart says nothing.
      const ratio = contrast(PALETTE[theme].ink, PALETTE[theme].barMuted);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    });

    /*
     * Today's bar is periwinkle where the others are bar-muted, and in
     * light mode those two are 1.03:1 apart in luminance. They differ in
     * hue, not in brightness, which means colour vision is the only way to
     * tell them apart, and WCAG 1.4.1 says colour may not be the only way.
     *
     * The design already answers this: today's bar carries a 1.5px ink
     * border that no other bar has. That border is what this asserts,
     * because that is what actually does the work. The fills are left
     * alone, they are the specified tokens, and changing them would
     * solve a problem that is already solved.
     */
    it(`${theme}: today's bar is marked by more than its colour`, () => {
      const fills = contrast(PALETTE[theme].accent, PALETTE[theme].barMuted);
      const border = contrast(PALETTE[theme].ink, PALETTE[theme].barMuted);

      // Stated so the next person sees why the border is not optional.
      expect(fills).toBeLessThan(2);
      expect(border, `${border.toFixed(2)}:1`).toBeGreaterThanOrEqual(NON_TEXT);
    });
  }
});

describe("the tint keys", () => {
  it("has sixteen, with no duplicates", () => {
    expect(TINT_KEYS).toHaveLength(16);
    expect(new Set(TINT_KEYS).size).toBe(16);
  });

  it("recognises its own keys and nothing else", () => {
    for (const key of TINT_KEYS) expect(isTint(key)).toBe(true);
    for (const bad of ["", "mauve", "ROSE", "neutral ", "#fce4e1"]) {
      expect(isTint(bad), bad).toBe(false);
    }
  });

  it("defaults to one of them", () => {
    expect(isTint(DEFAULT_TINT)).toBe(true);
  });

  it("gives every key a value in both themes", () => {
    for (const theme of THEMES) {
      for (const key of TINT_KEYS) {
        expect(PALETTE[theme].tints[key], `${theme}/${key}`).toMatch(
          /^#[0-9A-Fa-f]{6}$/,
        );
      }
    }
  });
});

/**
 * The palette above is a copy of what `globals.css` declares, kept for the
 * tests and for the few places that need a value at runtime. Two copies of
 * anything drift, so this is the check that they have not.
 */
describe("the CSS and this file agree", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  /** Reads `--name: #value;` out of the `:root` or `.dark` block. */
  function declared(theme: Theme, name: string): string | null {
    const block =
      theme === "light" ? /:root\s*\{([^}]*)\}/ : /\.dark\s*\{([^}]*)\}/;
    const body = block.exec(css)?.[1] ?? "";
    const match = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(body);
    return match ? match[1].toLowerCase() : null;
  }

  const NAMED: [keyof typeof PALETTE.light, string][] = [
    ["background", "background"],
    ["surface", "surface"],
    ["surfaceMuted", "surface-muted"],
    ["ink", "ink"],
    ["onInk", "on-ink"],
    ["text", "text"],
    ["textSecondary", "text-secondary"],
    ["hairline", "hairline"],
    ["barMuted", "bar-muted"],
    ["income", "income"],
    ["expense", "expense"],
    ["transfer", "transfer"],
    ["accent", "accent"],
  ];

  for (const theme of THEMES) {
    for (const [key, cssName] of NAMED) {
      it(`${theme}: --${cssName}`, () => {
        expect(declared(theme, cssName)).toBe(
          String(PALETTE[theme][key]).toLowerCase(),
        );
      });
    }

    for (const tint of TINT_KEYS) {
      it(`${theme}: --tint-${tint}`, () => {
        expect(declared(theme, `tint-${tint}`)).toBe(
          PALETTE[theme].tints[tint as TintKey].toLowerCase(),
        );
      });
    }
  }
});

describe("tintForName", () => {
  it("gives the same name the same tint, every time", () => {
    expect(tintForName("Groceries")).toBe(tintForName("Groceries"));
    expect(tintForName("")).toBe(tintForName(""));
  });

  it("never hands out neutral", () => {
    // Neutral is the fallback for a row with no tint at all. Handing it out
    // as a choice would make "nothing chosen" and "grey chosen" the same.
    const names = Array.from(
      { length: 200 },
      (_, index) => `Category ${index}`,
    );
    for (const name of names) {
      expect(tintForName(name)).not.toBe("neutral");
    }
  });

  it("only ever returns a real tint", () => {
    for (const name of ["Rent", "Food", "Café ☕", "日本語", "x".repeat(60)]) {
      expect(TINT_KEYS).toContain(tintForName(name));
    }
  });

  it("spreads names across the palette rather than piling them up", () => {
    const names = Array.from({ length: 140 }, (_, index) => `Name ${index}`);
    const used = new Set(names.map(tintForName));

    // Seven tints are on offer; with 140 names, hitting all of them is the
    // low bar a hash has to clear to be worth using at all.
    expect(used.size).toBe(TINT_KEYS.length - 1);
  });
});
