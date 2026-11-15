import { describe, expect, it } from "vitest";

import {
  COLORS,
  COLOR_NAMES,
  DEFAULT_COLOR,
  FALLBACK_COLOR,
  colorForName,
  colorNamed,
  isColor,
} from "./colors";

describe("the palette", () => {
  it("keeps the names in step with the colours", () => {
    // These are two parallel arrays, which is the arrangement that goes
    // wrong silently. A swatch added to one and not the other shifts every
    // name after it onto the wrong colour.
    expect(COLOR_NAMES.length).toBe(COLORS.length);
    expect(new Set(COLOR_NAMES).size).toBe(COLOR_NAMES.length);
    expect(new Set(COLORS).size).toBe(COLORS.length);
  });

  it("is sixteen usable hex colours", () => {
    expect(COLORS).toHaveLength(16);
    for (const color of COLORS) {
      expect(isColor(color), color).toBe(true);
    }
  });

  it("points its defaults at real swatches", () => {
    expect(COLORS).toContain(DEFAULT_COLOR);
    expect(FALLBACK_COLOR).toBe(colorNamed("slate"));
  });
});

describe("colorNamed", () => {
  it("hands back the swatch that name belongs to", () => {
    expect(colorNamed("teal")).toBe(COLORS[0]);
    expect(colorNamed("slate")).toBe(COLORS[COLORS.length - 1]);
    expect(colorNamed("green")).toBe(COLORS[COLOR_NAMES.indexOf("green")]);
  });

  it("throws rather than returning undefined", () => {
    // A dot with `background: undefined` is invisible, and reads as a
    // missing category rather than as a mistake.
    // @ts-expect-error — the point is what happens when the name is not one.
    expect(() => colorNamed("chartreuse")).toThrow(/No swatch called/);
  });
});

describe("colorForName", () => {
  it("is deterministic and always lands on the palette", () => {
    for (const name of ["Food", "Rent", "", "कॉफ़ी", "a".repeat(200)]) {
      const picked = colorForName(name);
      expect(COLORS, name).toContain(picked);
      expect(colorForName(name)).toBe(picked);
    }
  });
});

describe("isColor", () => {
  it("accepts six-digit hex and nothing else", () => {
    expect(isColor("#008781")).toBe(true);
    expect(isColor("#00878G")).toBe(false);
    expect(isColor("#abc")).toBe(false);
    expect(isColor("008781")).toBe(false);
    expect(isColor("")).toBe(false);
  });
});
