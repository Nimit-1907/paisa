import { describe, expect, it } from "vitest";

import { heatLevel } from "./spend-heat";

describe("heatLevel", () => {
  it("is 0 for a day with nothing spent", () => {
    expect(heatLevel(0, 1000)).toBe(0);
  });

  it("is at least 1 for any spending, however small", () => {
    expect(heatLevel(1, 1000)).toBe(1);
  });

  it("rises in quarters of the ordinary peak", () => {
    expect(heatLevel(250, 1000)).toBe(1);
    expect(heatLevel(251, 1000)).toBe(2);
    expect(heatLevel(500, 1000)).toBe(2);
    expect(heatLevel(750, 1000)).toBe(3);
    expect(heatLevel(1000, 1000)).toBe(4);
  });

  it("stops at 4 for a day past the peak, the rent", () => {
    expect(heatLevel(22000, 1000)).toBe(4);
  });
});
