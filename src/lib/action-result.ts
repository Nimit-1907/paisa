import type { ZodType } from "zod";

/**
 * The shape every Server Action returns (CLAUDE.md).
 *
 * Never throw across the action boundary: a thrown error reaches the client as
 * an opaque digest in production, which tells the user nothing. Return a
 * message the UI can put in a toast instead.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, field?: string): ActionResult<never> {
  return { ok: false, error, field };
}

/** Pulls the first message out of a zod flatten() result. */
export function firstIssue(
  fieldErrors: Record<string, string[] | undefined>,
): { error: string; field?: string } {
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.length) {
      return { error: messages[0], field };
    }
  }
  return { error: "Please check the form and try again." };
}

/**
 * Validates an action's input, or hands back the failure to return as-is.
 *
 *   const parsed = parseInput(signInSchema, input);
 *   if (!parsed.ok) return parsed;
 *   // parsed.data is typed and trusted from here
 */
export function parseInput<Output>(
  schema: ZodType<Output>,
  input: unknown,
): { ok: true; data: Output } | ActionResult<never> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const { error, field } = firstIssue(
      parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    );
    return fail(error, field);
  }

  return { ok: true, data: parsed.data };
}

/**
 * A database failure the user can read, without the parts they should not.
 *
 * Postgres and PostgREST messages name tables, columns and constraints. They
 * belong in the server log, not in a toast, so the caller supplies what the
 * user sees and known cases are mapped explicitly before this is reached.
 */
export function failFromDb(
  error: { message: string },
  userMessage: string,
): ActionResult<never> {
  console.error("[db]", error.message);
  return fail(userMessage);
}
