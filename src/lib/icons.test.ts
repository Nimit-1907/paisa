import { describe, expect, it } from "vitest";

import { CircleEllipsis, Wallet } from "lucide-react";

import { ICONS, ICON_NAMES, resolveIcon } from "./icons";

describe("resolveIcon", () => {
  it("returns the icon a name refers to", () => {
    expect(resolveIcon("Wallet")).toBe(Wallet);
  });

  it("falls back for a name that is not in the set", () => {
    expect(resolveIcon(null)).toBe(CircleEllipsis);
    expect(resolveIcon(undefined)).toBe(CircleEllipsis);
    expect(resolveIcon("")).toBe(CircleEllipsis);
    expect(resolveIcon("RetiredIcon")).toBe(CircleEllipsis);
  });

  it("is not fooled by inherited object keys", () => {
    // `"constructor" in ICONS` is true through the prototype chain, and what
    // it returns is not a component.
    for (const inherited of ["constructor", "toString", "hasOwnProperty"]) {
      expect(resolveIcon(inherited), inherited).toBe(CircleEllipsis);
    }
  });

  it("resolves every name the pickers offer", () => {
    for (const name of ICON_NAMES) {
      expect(resolveIcon(name), name).toBe(ICONS[name]);
    }
  });
});
