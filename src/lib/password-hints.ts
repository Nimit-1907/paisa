/**
 * What to tell somebody about the password they are typing.
 *
 * Two kinds of thing, kept apart on purpose:
 *
 *  - **Required** is what the schema actually enforces. There is exactly
 *    one of these, because there is exactly one rule: eight characters.
 *  - **Stronger** is advice. None of it blocks anything, and the UI says so,
 *    because a checklist that looks mandatory and is not teaches people that
 *    this app's messages can be ignored.
 *
 * No score and no coloured bar. A bar turns "is this good enough?" into a
 * number nobody can act on, and the usual implementations rate `P@ssw0rd!`
 * well and `correct horse battery staple` badly — which is backwards.
 */

export const MIN_LENGTH = 8;
/** Longer than this and the advice to go longer stops being useful. */
export const COMFORTABLE_LENGTH = 12;

/**
 * The handful that show up at the top of every breach list.
 *
 * Not a security control — the real one is the length rule and the fact that
 * these are hashed. It is here so that the one person typing "password1"
 * gets told, which is the case where a warning is worth anything at all.
 */
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "princess",
  "football",
  "baseball",
  "sunshine",
  "letmein1",
  "welcome1",
  "admin123",
  "abc12345",
]);

export type PasswordHint = {
  id: string;
  label: string;
  met: boolean;
};

export type PasswordAdvice = {
  /** The rule the form will actually reject on. */
  required: PasswordHint;
  /** Advice. Never blocks a submit. */
  stronger: PasswordHint[];
  /** True when the value would pass the schema. */
  valid: boolean;
};

export function passwordAdvice(value: string): PasswordAdvice {
  // Counted in code points, not UTF-16 units, so an emoji is one character
  // to the person typing it rather than two.
  const length = [...value].length;

  const required: PasswordHint = {
    id: "length",
    label: `At least ${MIN_LENGTH} characters`,
    met: length >= MIN_LENGTH,
  };

  const stronger: PasswordHint[] = [
    {
      id: "longer",
      label: `${COMFORTABLE_LENGTH} or more is harder to guess`,
      met: length >= COMFORTABLE_LENGTH,
    },
    {
      id: "variety",
      label: "Mixes in a number or a symbol",
      met: /[0-9]/u.test(value) || /[^\p{L}\p{N}]/u.test(value),
    },
    {
      id: "common",
      label: "Not one of the passwords everyone uses",
      met: value.length > 0 && !COMMON.has(value.toLowerCase()),
    },
  ];

  // Only the length rule. The schema in src/lib/schemas/auth.ts is the gate
  // and it also caps the length; re-deriving that cap here would mean two
  // places to get it wrong, and this one would be the one nobody updates.
  // What this answers is narrower: "is the checklist satisfied yet?".
  return { required, stronger, valid: required.met };
}
