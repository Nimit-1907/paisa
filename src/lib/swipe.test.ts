import { describe, expect, it } from "vitest";

import { settleSwipe, SWIPE_ACTION_WIDTH } from "./swipe";

const W = SWIPE_ACTION_WIDTH;

describe("settleSwipe", () => {
  it("parks one action open past half its width", () => {
    expect(settleSwipe(W / 2 + 1, { left: 1, right: 1 })).toBe(W);
    expect(settleSwipe(-(W / 2 + 1), { left: 1, right: 1 })).toBe(-W);
  });

  it("falls back closed short of half", () => {
    expect(settleSwipe(W / 2 - 1, { left: 1, right: 1 })).toBe(0);
  });

  it("parks two actions at twice the width", () => {
    expect(settleSwipe(W + 10, { left: 2, right: 1 })).toBe(2 * W);
    expect(settleSwipe(-(W + 10), { left: 2, right: 1 })).toBe(-W);
  });

  it("never opens a side that has nothing in it", () => {
    expect(settleSwipe(W * 2, { left: 0, right: 1 })).toBe(0);
  });
});
