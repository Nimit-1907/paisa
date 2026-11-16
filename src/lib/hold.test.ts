import { describe, expect, it } from "vitest";

import { HOLD_SLOP, holdStarts, movedPastSlop } from "./hold";

describe("holdStarts", () => {
  it("starts on the primary button of the primary pointer", () => {
    expect(holdStarts({ button: 0, isPrimary: true })).toBe(true);
  });

  it("ignores a right or middle button", () => {
    expect(holdStarts({ button: 2, isPrimary: true })).toBe(false);
    expect(holdStarts({ button: 1, isPrimary: true })).toBe(false);
  });

  it("ignores a second finger", () => {
    expect(holdStarts({ button: 0, isPrimary: false })).toBe(false);
  });
});

describe("movedPastSlop", () => {
  const start = { x: 100, y: 100 };

  it("allows a finger's natural wobble", () => {
    expect(movedPastSlop(start, { x: 100 + HOLD_SLOP - 1, y: 100 })).toBe(
      false,
    );
  });

  it("calls it a scroll once the finger travels", () => {
    expect(movedPastSlop(start, { x: 100, y: 100 + HOLD_SLOP + 1 })).toBe(true);
    expect(movedPastSlop(start, { x: 100 + 8, y: 100 + 8 })).toBe(true);
  });
});
