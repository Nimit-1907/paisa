import { describe, expect, it } from "vitest";

import { FAQS, FEATURES, feature } from "./_content";

describe("feature", () => {
  it("finds one by id", () => {
    expect(feature("track").title).toBe(FEATURES[0].title);
    expect(feature("recurring").id).toBe("recurring");
  });

  it("throws rather than handing back nothing", () => {
    // The landing page asks for three of these by name while a Server
    // Component renders. A missing one should stop the build, not render a
    // blank card and throw on `.title` somewhere further down.
    // @ts-expect-error: the point is what happens when the id is not one.
    expect(() => feature("nope")).toThrow(/No feature called/);
  });

  it("has an id for every entry, and no duplicates", () => {
    const ids = FEATURES.map((item) => item.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("still has the three the landing page puts a crop beside", () => {
    for (const id of ["track", "budget", "recurring"] as const) {
      expect(() => feature(id)).not.toThrow();
    }
  });
});

describe("the public copy", () => {
  it("has enough questions for the landing page to show four", () => {
    // The landing page shows the first four and links to /faq for the rest.
    // Trimming the list below four would leave that section short without
    // anything else noticing.
    expect(FAQS.length).toBeGreaterThanOrEqual(4);
    for (const faq of FAQS) {
      expect(faq.question).not.toBe("");
      expect(faq.answer).not.toBe("");
    }
  });
});
