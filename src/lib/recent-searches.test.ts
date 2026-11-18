import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_RECENT,
  __testing,
  forgetSearches,
  recentSearches,
  rememberSearch,
} from "./recent-searches";

/** A localStorage good enough to test against, including the throwing kind. */
function installStorage(options: { throws?: boolean } = {}) {
  const store = new Map<string, string>();

  const storage = {
    getItem: (key: string) => {
      if (options.throws) throw new Error("blocked");
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (options.throws) throw new Error("blocked");
      store.set(key, value);
    },
    removeItem: (key: string) => {
      if (options.throws) throw new Error("blocked");
      store.delete(key);
    },
  };

  vi.stubGlobal("window", { localStorage: storage });
  return store;
}

describe("the shaping of whatever is in storage", () => {
  const read = __testing.read;

  it("takes an array of strings", () => {
    expect(read('["swiggy","rent"]')).toEqual(["swiggy", "rent"]);
  });

  it("survives anything that is not one", () => {
    // Written by an older version, another tab, or by hand in devtools.
    for (const raw of [null, "", "nonsense", "{}", '"a string"', "[1,2,3]"]) {
      expect(Array.isArray(read(raw)), JSON.stringify(raw)).toBe(true);
    }
    expect(read("[1,2,3]")).toEqual([]);
    expect(read('[1,"keep",null]')).toEqual(["keep"]);
  });

  it("drops blanks and trims", () => {
    expect(read('["  rent  ","","   "]')).toEqual(["rent"]);
  });

  it("never returns more than the cap", () => {
    const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => `q${i}`));
    expect(read(many)).toHaveLength(MAX_RECENT);
  });
});

describe("rememberSearch", () => {
  beforeEach(() => {
    installStorage();
  });

  it("puts the newest first", () => {
    rememberSearch("rent");
    rememberSearch("swiggy");
    expect(recentSearches()).toEqual(["swiggy", "rent"]);
  });

  it("moves a repeat up rather than duplicating it", () => {
    rememberSearch("swiggy");
    rememberSearch("rent");
    // Different case, same search.
    expect(rememberSearch("SWIGGY")).toEqual(["SWIGGY", "rent"]);
  });

  it("ignores an empty query", () => {
    rememberSearch("rent");
    expect(rememberSearch("   ")).toEqual(["rent"]);
  });

  it("keeps only the most recent few", () => {
    for (const term of ["aa", "bb", "cc", "dd", "ee", "ff", "gg"]) {
      rememberSearch(term);
    }
    const kept = recentSearches();
    expect(kept).toHaveLength(MAX_RECENT);
    expect(kept[0]).toBe("gg");
    expect(kept).not.toContain("aa");
  });

  it("ignores a single letter", () => {
    rememberSearch("rent");
    expect(rememberSearch("s")).toEqual(["rent"]);
  });

  it("replaces the same search half typed", () => {
    rememberSearch("rent");
    rememberSearch("swi");
    expect(rememberSearch("Swiggy")).toEqual(["Swiggy", "rent"]);
  });

  it("truncates a paste rather than storing it", () => {
    const long = "x".repeat(500);
    expect(rememberSearch(long)[0]).toHaveLength(80);
  });

  it("forgets everything when asked", () => {
    rememberSearch("rent");
    forgetSearches();
    expect(recentSearches()).toEqual([]);
  });
});

describe("when storage is blocked", () => {
  beforeEach(() => {
    installStorage({ throws: true });
  });

  it("reads as empty instead of throwing", () => {
    expect(recentSearches()).toEqual([]);
  });

  it("still answers when writing fails", () => {
    // A private window: the search has to work, it just will not be
    // remembered.
    expect(() => rememberSearch("rent")).not.toThrow();
    expect(() => forgetSearches()).not.toThrow();
  });
});
