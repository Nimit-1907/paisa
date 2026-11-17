import { describe, expect, it } from "vitest";

import { parseFilters } from "./filter-params";

describe("parseFilters worth", () => {
  it("reads ?worth=regret and ?worth=worth", () => {
    expect(parseFilters({ worth: "regret" }).worth).toBe("regret");
    expect(parseFilters({ worth: "worth" }).worth).toBe("worth");
  });

  it("drops anything else", () => {
    expect(parseFilters({ worth: "maybe" }).worth).toBeUndefined();
  });
});
