/**
 * Reading the confirmation email out of Mailpit.
 *
 * The local Supabase stack sends every email to Mailpit on port 54324 instead
 * of the internet (see README). Signup confirmation is part of the journey
 * being tested, so the test reads the real email rather than switching the
 * confirmation off — a flow that is only exercised with it disabled is a flow
 * nobody has tested.
 */

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; To: { Address: string }[]; Subject: string };

async function listMessages(): Promise<Summary[]> {
  const response = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
  if (!response.ok) throw new Error(`Mailpit said ${response.status}`);

  const body = (await response.json()) as { messages?: Summary[] };
  return body.messages ?? [];
}

/**
 * The confirmation link sent to `email`.
 *
 * Polls because the email arrives through GoTrue's own queue a moment after
 * the signup request returns.
 */
export async function confirmationLink(
  email: string,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await listMessages();
    const match = messages.find((message) =>
      message.To.some(
        (to) => to.Address.toLowerCase() === email.toLowerCase(),
      ),
    );

    if (match) {
      const response = await fetch(`${MAILPIT}/api/v1/message/${match.ID}`);

      // Checked like the listing above: without it a 404 or a 500 surfaces
      // as "no verification link", which points at the email rather than at
      // the mail server.
      if (!response.ok) {
        throw new Error(
          `Mailpit said ${response.status} for message ${match.ID}`,
        );
      }

      const body = (await response.json()) as { HTML?: string; Text?: string };
      const source = `${body.HTML ?? ""}\n${body.Text ?? ""}`;

      // GoTrue's template links to /auth/v1/verify, which redirects to the
      // app's own callback once the token is spent.
      const link = /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/i.exec(source)?.[0];
      if (link) return link.replaceAll("&amp;", "&");

      throw new Error(`No verification link in the email to ${email}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No email arrived for ${email} within ${timeoutMs}ms`);
}

/** A fresh address, so the suite can be run twice without cleaning up. */
export function uniqueEmail(): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 7);
  return `e2e-${stamp}-${noise}@example.com`;
}
