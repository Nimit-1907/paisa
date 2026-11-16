import { describe, expect, it } from "vitest";

import { emailToRestore } from "./remembered-email";

describe("emailToRestore", () => {
  it("fills an empty field nobody is typing in", () => {
    expect(
      emailToRestore({ remembered: "a@b.co", current: "", typing: false }),
    ).toBe("a@b.co");
  });

  it("leaves what somebody already typed alone", () => {
    expect(
      emailToRestore({ remembered: "a@b.co", current: "me@x", typing: false }),
    ).toBeNull();
  });

  it("does not fill the field under somebody about to type", () => {
    expect(
      emailToRestore({ remembered: "a@b.co", current: "", typing: true }),
    ).toBeNull();
  });

  it("has nothing to restore without a remembered address", () => {
    expect(
      emailToRestore({ remembered: "", current: "", typing: false }),
    ).toBeNull();
  });
});
