import { describe, expect, it } from "vitest";

import { COMFORTABLE_LENGTH, MIN_LENGTH, passwordAdvice } from "./password-hints";
import { signUpSchema } from "./schemas/auth";

const hint = (value: string, id: string) =>
  passwordAdvice(value).stronger.find((item) => item.id === id);

describe("passwordAdvice", () => {
  it("requires the length the schema requires, and nothing else", () => {
    expect(passwordAdvice("short").required.met).toBe(false);
    expect(passwordAdvice("a".repeat(MIN_LENGTH)).required.met).toBe(true);
    expect(passwordAdvice("a".repeat(MIN_LENGTH)).valid).toBe(true);
  });

  it("agrees with the schema about what passes", () => {
    // The checklist is a courtesy; the schema is the gate. They must not
    // disagree, or the form says "done" and the submit bounces.
    for (const value of ["", "abc", "a".repeat(7), "a".repeat(8), "correct horse battery"]) {
      const accepted = signUpSchema.safeParse({
        email: "a@b.com",
        password: value,
      }).success;
      expect(passwordAdvice(value).valid, JSON.stringify(value)).toBe(accepted);
    }
  });

  it("counts characters the way the person typing them does", () => {
    // Eight emoji is eight characters, not sixteen UTF-16 units.
    expect(passwordAdvice("🙂".repeat(8)).required.met).toBe(true);
    expect(passwordAdvice("🙂".repeat(7)).required.met).toBe(false);
  });

  it("suggests length without demanding it", () => {
    const advice = passwordAdvice("a".repeat(MIN_LENGTH));
    expect(advice.required.met).toBe(true);
    expect(advice.valid).toBe(true);
    // Not met, and yet the password is fine: that is the whole point of the
    // separation between "required" and "stronger".
    expect(hint("a".repeat(MIN_LENGTH), "longer")?.met).toBe(false);
    expect(hint("a".repeat(COMFORTABLE_LENGTH), "longer")?.met).toBe(true);
  });

  it("notices a number or a symbol", () => {
    expect(hint("abcdefgh", "variety")?.met).toBe(false);
    expect(hint("abcdefg1", "variety")?.met).toBe(true);
    expect(hint("abcdefg!", "variety")?.met).toBe(true);
    expect(hint("abcdefg ", "variety")?.met).toBe(true);
  });

  it("flags the passwords everyone uses, whatever the case", () => {
    expect(hint("password", "common")?.met).toBe(false);
    expect(hint("PASSWORD", "common")?.met).toBe(false);
    expect(hint("Password123", "common")?.met).toBe(false);
    expect(hint("a fairly ordinary one", "common")?.met).toBe(true);
  });

  it("says nothing is done when nothing is typed", () => {
    const advice = passwordAdvice("");
    expect(advice.required.met).toBe(false);
    expect(advice.stronger.every((item) => !item.met)).toBe(true);
  });
});
